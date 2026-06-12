from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import sys
from urllib.request import Request, urlopen

from app_paths import (
    get_cli_executable_path,
    get_cli_python_path,
    get_cli_source_dir,
    get_cli_state_file,
    get_cli_venv_dir,
    get_app_data_dir,
)


CLI_REPO_URL = "https://github.com/batty211/kppwppost"
CLI_API_RELEASE_LATEST = "https://api.github.com/repos/batty211/kppwppost/releases/latest"
CLI_API_TAGS = "https://api.github.com/repos/batty211/kppwppost/tags?per_page=100"
CLI_TAG_ZIP_TEMPLATE = "https://github.com/batty211/kppwppost/archive/refs/tags/{tag}.zip"
CLI_BRANCH_ZIP_TEMPLATE = "https://github.com/batty211/kppwppost/archive/refs/heads/{branch}.zip"
CLI_RAW_PYPROJECT_MAIN = "https://raw.githubusercontent.com/batty211/kppwppost/main/pyproject.toml"

_STATE_LOCK = threading.Lock()
_VERSION_RE = re.compile(r"^v?(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)(?P<suffix>.*)?$")
logger = logging.getLogger("kppost_ui.cli")
WP_ENV_KEYS = (
    "WP_URL",
    "WP_USERNAME",
    "WP_APPLICATION_PASSWORD",
    "WP_TIMEOUT_SECONDS",
    "WP_VERIFY_SSL",
)
WINDOWS_CLI_EXTRA_DEPENDENCIES = ("tzdata",)


def _default_state() -> dict[str, Any]:
    return {
        "status": "not_installed",
        "message": "CLI not installed yet.",
        "installed_version": "",
        "latest_version": "",
        "update_available": False,
        "repo_url": CLI_REPO_URL,
        "cli_path": str(get_cli_executable_path()),
        "source_path": str(get_cli_source_dir()),
        "venv_path": str(get_cli_venv_dir()),
        "last_checked": "",
        "installed_at": "",
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback.copy()
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return {**fallback, **data}
    except Exception:
        pass
    return fallback.copy()


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)


def load_state() -> dict[str, Any]:
    state = _read_json(get_cli_state_file(), _default_state())
    state.setdefault("status", "not_installed")
    state.setdefault("message", "CLI not installed yet.")
    state.setdefault("repo_url", CLI_REPO_URL)
    state.setdefault("cli_path", str(get_cli_executable_path()))
    state.setdefault("source_path", str(get_cli_source_dir()))
    state.setdefault("venv_path", str(get_cli_venv_dir()))
    state.setdefault("installed_version", "")
    state.setdefault("latest_version", "")
    state.setdefault("update_available", False)
    state.setdefault("last_checked", "")
    state.setdefault("installed_at", "")
    return state


def save_state(updates: dict[str, Any]) -> dict[str, Any]:
    with _STATE_LOCK:
        state = load_state()
        previous_status = state.get("status", "")
        state.update(updates)
        _write_json(get_cli_state_file(), state)
        if previous_status != state.get("status") or updates.get("message"):
            logger.info(
                "CLI state updated: %s -> %s | %s",
                previous_status or "unknown",
                state.get("status", "unknown"),
                state.get("message", ""),
            )
        return state


def _parse_version(version: str) -> tuple[int, int, int] | None:
    match = _VERSION_RE.match(version.strip())
    if not match:
        return None
    return (
        int(match.group("major")),
        int(match.group("minor")),
        int(match.group("patch")),
    )


def compare_versions(left: str, right: str) -> int:
    left_parsed = _parse_version(left)
    right_parsed = _parse_version(right)
    if left_parsed and right_parsed:
        if left_parsed < right_parsed:
            return -1
        if left_parsed > right_parsed:
            return 1
        return 0
    if left == right:
        return 0
    return -1 if left < right else 1


def _http_get_json(url: str) -> Any:
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "kppost-ui",
        },
    )
    with urlopen(request, timeout=20) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def _download_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={"User-Agent": "kppost-ui"},
    )
    with urlopen(request, timeout=60) as response:
        return response.read()


def _download_text(url: str) -> str:
    request = Request(
        url,
        headers={"User-Agent": "kppost-ui"},
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def _extract_archive_to_source(archive_bytes: bytes, source_dir: Path) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kppost-ui-cli-") as temp_dir:
        archive_path = Path(temp_dir) / "cli.zip"
        archive_path.write_bytes(archive_bytes)
        with zipfile.ZipFile(archive_path) as zip_handle:
            zip_handle.extractall(temp_dir)

        extracted_root: Path | None = None
        for child in Path(temp_dir).iterdir():
            if child.is_dir() and child.name != "__MACOSX" and child.name != source_dir.name:
                extracted_root = child
                break

        if extracted_root is None:
            raise RuntimeError("Unable to locate extracted CLI source.")

        for item in source_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

        for item in extracted_root.iterdir():
            destination = source_dir / item.name
            if item.is_dir():
                shutil.copytree(item, destination, dirs_exist_ok=True)
            else:
                shutil.copy2(item, destination)


def _read_version_from_source(source_dir: Path) -> str:
    version_file = source_dir / "src" / "kppost" / "__init__.py"
    if not version_file.exists():
        return ""
    content = version_file.read_text(encoding="utf-8")
    match = re.search(r'__version__\s*=\s*"([^"]+)"', content)
    return match.group(1) if match else ""


def _load_local_install_state() -> dict[str, Any]:
    state = load_state()
    source_dir = Path(state["source_path"])
    cli_path = Path(state["cli_path"])
    installed_version = _read_version_from_source(source_dir) if source_dir.exists() else ""

    if cli_path.exists() and installed_version:
        state["installed_version"] = installed_version
        state["status"] = "ready"
        state["message"] = f"CLI ready ({installed_version})."
    elif source_dir.exists():
        state["status"] = "installing" if state["status"] in {"installing", "updating"} else "error"
        state["message"] = state.get("message") or "CLI source exists but executable is missing."
    else:
        state["status"] = "not_installed"
        state["message"] = "CLI not installed yet."

    return state


def _get_latest_remote_info() -> dict[str, str]:
    info: dict[str, str] = {"latest_version": "", "latest_tag": ""}
    try:
        release = _http_get_json(CLI_API_RELEASE_LATEST)
        tag_name = str(release.get("tag_name", "")).strip()
        if tag_name:
            info["latest_version"] = tag_name.removeprefix("v")
            info["latest_tag"] = tag_name.removeprefix("v")
            logger.info("Resolved latest CLI version from release API: %s", info["latest_version"])
            return info
    except Exception as exc:
        logger.warning("Failed to resolve latest CLI version from release API: %s", exc)

    try:
        tags = _http_get_json(CLI_API_TAGS)
        candidates: list[str] = []
        if isinstance(tags, list):
            for tag in tags:
                name = str(tag.get("name", "")).strip()
                if name:
                    candidates.append(name)
        candidates.sort(key=lambda value: _parse_version(value.removeprefix("v")) or (0, 0, 0), reverse=True)
        if candidates:
            latest_tag = candidates[0]
            info["latest_version"] = latest_tag.removeprefix("v")
            info["latest_tag"] = latest_tag.removeprefix("v")
            logger.info("Resolved latest CLI version from tags API: %s", info["latest_version"])
    except Exception as exc:
        logger.warning("Failed to resolve latest CLI version from tags API: %s", exc)

    try:
        pyproject = _download_text(CLI_RAW_PYPROJECT_MAIN)
        match = re.search(r'^\s*version\s*=\s*"([^"]+)"\s*$', pyproject, re.MULTILINE)
        if match:
            info["latest_version"] = match.group(1).strip()
            info["latest_tag"] = "main"
            logger.info("Resolved latest CLI version from main branch pyproject: %s", info["latest_version"])
    except Exception as exc:
        logger.warning("Failed to resolve latest CLI version from main branch pyproject: %s", exc)

    return info


def refresh_cli_state(force_remote: bool = False) -> dict[str, Any]:
    state = _load_local_install_state()
    state["cli_path"] = str(get_cli_executable_path())
    state["source_path"] = str(get_cli_source_dir())
    state["venv_path"] = str(get_cli_venv_dir())
    state["repo_url"] = CLI_REPO_URL

    if force_remote or not state.get("latest_version"):
        remote_info = _get_latest_remote_info()
        state["latest_version"] = remote_info.get("latest_version", "")
        state["last_checked"] = _now_iso()

    installed_version = state.get("installed_version", "")
    latest_version = state.get("latest_version", "")
    if installed_version and latest_version:
        state["update_available"] = compare_versions(installed_version, latest_version) < 0
        if state["update_available"] and state.get("status") == "ready":
            state["status"] = "update_available"
            state["message"] = f"Update available: {installed_version} -> {latest_version}"
        elif not state["update_available"] and state.get("status") in {"update_available", "error"}:
            state["status"] = "ready"
            state["message"] = f"CLI ready ({installed_version})."
    else:
        state["update_available"] = False

    _write_json(get_cli_state_file(), state)
    return state


def _create_or_repair_venv() -> None:
    venv_dir = get_cli_venv_dir()
    python_path = get_cli_python_path()
    if python_path.exists():
        return
    venv_dir.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Creating bundled CLI virtual environment at %s", venv_dir)
    subprocess.run([os.environ.get("PYTHON_EXECUTABLE") or sys.executable, "-m", "venv", os.fspath(venv_dir)], check=True)


def _install_from_source(source_dir: Path) -> None:
    _create_or_repair_venv()
    python_path = get_cli_python_path()
    logger.info("Installing CLI from %s", source_dir)
    install_targets = [os.fspath(source_dir)]
    if sys.platform == "win32":
        install_targets.extend(WINDOWS_CLI_EXTRA_DEPENDENCIES)
    subprocess.run(
        [
            os.fspath(python_path),
            "-m",
            "pip",
            "install",
            "--upgrade",
            "--force-reinstall",
            *install_targets,
        ],
        check=True,
    )


def _sync_source_from_remote(force_refresh: bool = False) -> str:
    remote_info = _get_latest_remote_info() if force_refresh else _get_latest_remote_info()
    latest_version = remote_info.get("latest_version", "")
    latest_tag = remote_info.get("latest_tag", "")
    if not latest_tag:
        raise RuntimeError("Unable to determine the latest CLI version from GitHub.")
    if latest_tag == "main":
        archive_url = CLI_BRANCH_ZIP_TEMPLATE.format(branch="main")
    else:
        archive_url = CLI_TAG_ZIP_TEMPLATE.format(tag=latest_tag)
    logger.info("Downloading CLI source archive from %s", archive_url)
    archive_bytes = _download_bytes(archive_url)
    _extract_archive_to_source(archive_bytes, get_cli_source_dir())
    logger.info("CLI source refreshed into %s", get_cli_source_dir())
    return latest_version or latest_tag


def _finalize_install_state(message_prefix: str = "CLI ready") -> dict[str, Any]:
    source_dir = get_cli_source_dir()
    cli_path = get_cli_executable_path()
    installed_version = _read_version_from_source(source_dir)
    remote_info = _get_latest_remote_info()
    latest_version = remote_info.get("latest_version", "")
    update_available = bool(installed_version and latest_version and compare_versions(installed_version, latest_version) < 0)

    state = save_state(
        {
            "status": "update_available" if update_available else "ready",
            "message": (
                f"Update available: {installed_version} -> {latest_version}"
                if update_available
                else f"{message_prefix} ({installed_version})."
            ),
            "installed_version": installed_version,
            "latest_version": latest_version,
            "update_available": update_available,
            "installed_at": _now_iso(),
            "last_checked": _now_iso(),
            "cli_path": os.fspath(cli_path),
            "source_path": os.fspath(source_dir),
            "venv_path": os.fspath(get_cli_venv_dir()),
            "repo_url": CLI_REPO_URL,
        }
    )
    return state


def install_cli() -> dict[str, Any]:
    save_state(
        {
            "status": "installing",
            "message": "Downloading CLI source from GitHub...",
            "repo_url": CLI_REPO_URL,
            "cli_path": os.fspath(get_cli_executable_path()),
            "source_path": os.fspath(get_cli_source_dir()),
            "venv_path": os.fspath(get_cli_venv_dir()),
        }
    )
    source_dir = get_cli_source_dir()
    latest_version = _sync_source_from_remote(force_refresh=True)
    save_state({"message": f"Installing CLI {latest_version} into bundled runtime..."})
    _install_from_source(source_dir)
    return _finalize_install_state("CLI installed")


def update_cli() -> dict[str, Any]:
    current_state = refresh_cli_state(force_remote=True)
    installed_version = current_state.get("installed_version", "")
    latest_version = current_state.get("latest_version", "")

    if not current_state.get("installed_version"):
        return install_cli()

    if installed_version and latest_version and compare_versions(installed_version, latest_version) >= 0:
        return save_state(
            {
                "status": "ready",
                "message": f"CLI is already up to date ({installed_version}).",
                "update_available": False,
                "installed_version": installed_version,
                "latest_version": latest_version,
                "last_checked": _now_iso(),
            }
        )

    save_state(
        {
            "status": "updating",
            "message": "Downloading the latest CLI update from GitHub...",
        }
    )
    latest_version = _sync_source_from_remote(force_refresh=True)
    save_state({"message": f"Installing CLI update {latest_version}..."})
    _install_from_source(get_cli_source_dir())
    return _finalize_install_state("CLI updated")


def run_cli_command(command: str, args: list[str], cwd: str) -> dict[str, Any]:
    state = refresh_cli_state(force_remote=False)
    cli_path = Path(state["cli_path"])

    if not cli_path.exists():
        raise FileNotFoundError("CLI is not installed.")

    cli_cmd = [os.fspath(cli_path), command, *args]
    env = _build_cli_env(command, args, cwd)
    logger.info("Running CLI command: %s | cwd=%s", " ".join(cli_cmd), cwd)
    result = subprocess.run(
        cli_cmd,
        capture_output=True,
        text=True,
        cwd=cwd,
        env=env,
    )
    logger.info(
        "CLI command finished: returncode=%s stderr=%s",
        result.returncode,
        bool(result.stderr.strip()),
    )
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
        "command": " ".join(cli_cmd),
        "cwd": cwd,
    }


def get_cli_info(force_remote: bool = False) -> dict[str, Any]:
    return refresh_cli_state(force_remote=force_remote)


def ensure_cli_workspace() -> None:
    get_app_data_dir().mkdir(parents=True, exist_ok=True)
    get_cli_source_dir().parent.mkdir(parents=True, exist_ok=True)


def _read_env_overrides(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in WP_ENV_KEYS:
                values[key] = value.strip()
    return values


def _resolve_batch_env_path(command: str, args: list[str], cwd: str) -> Path | None:
    batch_arg: str | None = None
    if command in {"generate", "validate", "preflight", "post"} and args:
        batch_arg = args[0]
    elif command == "canva" and len(args) >= 2 and args[0] in {"export", "import"}:
        batch_arg = args[1]

    if not batch_arg:
        return None

    batch_path = (Path(cwd) / batch_arg).resolve()
    if not batch_path.exists() or not batch_path.is_dir():
        return None
    return batch_path / ".env"


def _build_cli_env(command: str, args: list[str], cwd: str) -> dict[str, str]:
    env = os.environ.copy()
    env.update(_read_env_overrides(Path(cwd) / ".env"))

    batch_env_path = _resolve_batch_env_path(command, args, cwd)
    if batch_env_path is not None:
        env.update(_read_env_overrides(batch_env_path))

    return env
