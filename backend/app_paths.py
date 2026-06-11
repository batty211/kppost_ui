from __future__ import annotations

import os
import sys
from pathlib import Path


APP_NAME = "kppost-ui"


def get_runtime_root() -> Path:
    workspace_override = os.environ.get("KPPPOST_UI_RUNTIME_DIR")
    if workspace_override:
        return Path(workspace_override).expanduser().resolve()

    data_override = os.environ.get("KPPPOST_UI_DATA_DIR")
    if data_override:
        data_dir = Path(data_override).expanduser().resolve()
        if data_dir.name == "data":
            return data_dir.parent
        return data_dir

    return get_app_data_dir()


def get_app_data_dir() -> Path:
    override = os.environ.get("KPPPOST_UI_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()

    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    return (base / APP_NAME).expanduser().resolve()


def get_config_file() -> Path:
    return get_app_data_dir() / "config.json"


def get_cli_state_file() -> Path:
    return get_app_data_dir() / "cli_state.json"


def get_default_root_path() -> str:
    workspace_override = os.environ.get("KPPPOST_UI_WORKSPACE_DIR")
    if workspace_override:
        return str(Path(workspace_override).expanduser().resolve())

    if os.environ.get("KPPPOST_UI_DATA_DIR") or os.environ.get("KPPPOST_UI_RUNTIME_DIR"):
        return str((get_runtime_root() / "workspace").resolve())

    if sys.platform == "win32":
        return str(Path.home() / "Documents" / "kppost-workspace")
    return str(Path.home() / "Documents" / "kppost-workspace")


def get_cli_workspace_dir() -> Path:
    return get_app_data_dir() / "cli"


def get_cli_source_dir() -> Path:
    return get_cli_workspace_dir() / "kppwppost"


def get_cli_venv_dir() -> Path:
    return get_cli_workspace_dir() / ".venv"


def get_cli_executable_path() -> Path:
    if sys.platform == "win32":
        return get_cli_venv_dir() / "Scripts" / "kppost.exe"
    return get_cli_venv_dir() / "bin" / "kppost"


def get_cli_python_path() -> Path:
    if sys.platform == "win32":
        return get_cli_venv_dir() / "Scripts" / "python.exe"
    return get_cli_venv_dir() / "bin" / "python"


def get_log_dir() -> Path:
    override = os.environ.get("KPPPOST_UI_LOG_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return get_runtime_root() / "logs"


def get_backend_log_file() -> Path:
    override = os.environ.get("KPPPOST_UI_LOG_FILE")
    if override:
        return Path(override).expanduser().resolve()
    return get_log_dir() / "backend.log"


def ensure_runtime_dirs() -> None:
    get_app_data_dir().mkdir(parents=True, exist_ok=True)
    get_cli_workspace_dir().mkdir(parents=True, exist_ok=True)
    get_log_dir().mkdir(parents=True, exist_ok=True)
    Path(get_default_root_path()).mkdir(parents=True, exist_ok=True)
