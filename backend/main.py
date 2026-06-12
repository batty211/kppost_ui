from __future__ import annotations

import json
import logging
import os
import platform
import re
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app_paths import (
    get_backend_log_file,
    ensure_runtime_dirs,
    get_app_data_dir,
    get_cli_executable_path,
    get_cli_source_dir,
    get_config_file,
    get_default_root_path,
)
from cli_manager import get_cli_info, install_cli, run_cli_command, save_state as save_cli_state, update_cli


def configure_logging() -> logging.Logger:
    logger = logging.getLogger("kppost_ui")
    if logger.handlers:
        return logger

    log_file = get_backend_log_file()
    log_file.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.propagate = False
    return logger


app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = get_config_file()
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

ensure_runtime_dirs()
logger = configure_logging()
frontend_assets_dir = FRONTEND_DIST_DIR / "assets"
if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="frontend-assets")

WORKSPACE_ZONES = ("Raws", "Batches", "Canvas")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp")
RAW_DEPARTMENTS_TEMPLATE = {
    "departments": [],
}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app_mode": os.environ.get("KPPPOST_UI_APP_MODE", "web"),
        "host": os.environ.get("KPPPOST_UI_HOST", "127.0.0.1"),
        "port": int(os.environ.get("KPPPOST_UI_PORT", "8000")),
    }


def _natural_sort_key(value: str) -> list[tuple[int, object]]:
    parts = re.split(r"(\d+)", value.casefold())
    return [(0, int(part)) if part.isdigit() else (1, part) for part in parts]


def _versioned_file_url(root: Path, path: Path) -> str:
    stat = path.stat()
    version = f"{stat.st_ino:x}-{stat.st_size:x}-{stat.st_mtime_ns:x}"
    return f"/files/{_relative_workspace_path(root, path)}?v={version}"


def _load_prepare_report(folder_path: Path) -> dict[str, object] | None:
    report_path = folder_path / "prepare-report.json"
    if not report_path.is_file():
        return None
    try:
        with report_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _departments_cache_destination(root: Path, folder_path: Path) -> Path | None:
    report = _load_prepare_report(folder_path)
    if report is None:
        return None
    cache_value = report.get("departments_cache_file")
    if not isinstance(cache_value, str) or not cache_value.strip():
        return None
    try:
        cache_path = Path(cache_value).expanduser().resolve()
    except OSError:
        return None
    workspace_root = root.resolve()
    if workspace_root not in cache_path.parents:
        return None
    return cache_path


def _departments_cache_sources(root: Path) -> list[tuple[Path, Path]]:
    workspace_root = root.resolve()
    cache_sources: list[tuple[Path, Path]] = []
    seen_rel_paths: set[str] = set()

    for report_path in workspace_root.rglob("prepare-report.json"):
        folder_path = report_path.parent
        cache_path = _departments_cache_destination(workspace_root, folder_path)
        if cache_path is None or not cache_path.is_file():
            continue

        relative_path = cache_path.relative_to(workspace_root)
        relative_key = relative_path.as_posix()
        if relative_key in seen_rel_paths:
            continue

        seen_rel_paths.add(relative_key)
        cache_sources.append((cache_path, relative_path))

    return cache_sources


def _migrate_departments_templates(previous_root: Path, next_root: Path) -> dict[str, object]:
    previous_workspace = previous_root.resolve()
    next_workspace = next_root.resolve()

    if previous_workspace == next_workspace:
        return {"status": "skipped_same_root", "copied": []}

    copied: list[str] = []
    skipped_existing: list[str] = []
    source_rel_paths = _departments_cache_sources(previous_workspace)

    if not source_rel_paths:
        return {"status": "not_found", "copied": [], "skipped_existing": []}

    for source_path, relative_path in source_rel_paths:
        destination_path = (next_workspace / relative_path).resolve()
        if next_workspace not in destination_path.parents:
            continue
        if destination_path.exists():
            skipped_existing.append(relative_path.as_posix())
            continue

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination_path)
        copied.append(relative_path.as_posix())

    if copied:
        status = "copied"
    elif skipped_existing:
        status = "skipped_existing"
    else:
        status = "not_found"

    return {
        "status": status,
        "copied": copied,
        "skipped_existing": skipped_existing,
    }


def _migrate_workspace_env(previous_root: Path, next_root: Path) -> dict[str, object]:
    previous_workspace = previous_root.resolve()
    next_workspace = next_root.resolve()

    if previous_workspace == next_workspace:
        return {"status": "skipped_same_root", "copied": False, "skipped_existing": False}

    source_path = get_wp_config_path(previous_workspace)
    destination_path = get_wp_config_path(next_workspace)

    if not source_path.is_file():
        return {"status": "not_found", "copied": False, "skipped_existing": False}
    if destination_path.exists():
        return {"status": "skipped_existing", "copied": False, "skipped_existing": True}

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)
    return {"status": "copied", "copied": True, "skipped_existing": False}


def _workspace_departments_path(root: Path) -> Path:
    return root.resolve() / "Raws" / ".kppost" / "departments.json"


def _migrate_workspace_departments(previous_root: Path, next_root: Path) -> dict[str, object]:
    previous_workspace = previous_root.resolve()
    next_workspace = next_root.resolve()

    if previous_workspace == next_workspace:
        return {"status": "skipped_same_root", "copied": False, "skipped_existing": False}

    source_path = _workspace_departments_path(previous_workspace)
    destination_path = _workspace_departments_path(next_workspace)

    if not source_path.is_file():
        return {"status": "not_found", "copied": False, "skipped_existing": False}
    if destination_path.exists():
        return {"status": "skipped_existing", "copied": False, "skipped_existing": True}

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)
    return {"status": "copied", "copied": True, "skipped_existing": False}


def get_config():
    default_config = {
        "root_path": get_default_root_path(),
        "cli_path": str(get_cli_executable_path()),
        "app_data_dir": str(get_app_data_dir()),
    }
    if CONFIG_FILE.exists():
        try:
            with CONFIG_FILE.open("r", encoding="utf-8") as handle:
                config = json.load(handle)
                if not isinstance(config, dict):
                    return default_config
                merged = {**default_config, **config}
                merged["root_path"] = str(Path(merged["root_path"]).expanduser())
                merged["cli_path"] = str(Path(merged["cli_path"]).expanduser())
                merged["app_data_dir"] = str(get_app_data_dir())
                return merged
        except Exception:
            pass
    return default_config

def save_config(config):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_FILE.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=4, ensure_ascii=False)
    logger.info("Saved config: root_path=%s app_data_dir=%s", config.get("root_path"), config.get("app_data_dir"))


WP_CONFIG_KEYS = (
    "WP_URL",
    "WP_USERNAME",
    "WP_APPLICATION_PASSWORD",
    "WP_TIMEOUT_SECONDS",
    "WP_VERIFY_SSL",
)


def get_wp_config_path(root: str | Path | None = None) -> Path:
    if root is None:
        config = get_config()
        root = config["root_path"]
    return Path(root).expanduser().resolve() / ".env"


def get_legacy_wp_config_path() -> Path:
    return get_cli_source_dir() / ".env"


def _default_wp_config() -> dict[str, str]:
    return {
        "WP_URL": "",
        "WP_USERNAME": "",
        "WP_APPLICATION_PASSWORD": "",
    }


def _read_wp_env_file(path: Path) -> dict[str, str]:
    config: dict[str, str] = {}
    if not path.exists():
        return config

    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in WP_CONFIG_KEYS:
                config[key] = value.strip()
    return config


def _write_wp_env_file(path: Path, new_config: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for key in WP_CONFIG_KEYS:
            if key in new_config:
                handle.write(f"{key}={new_config[key]}\n")


def ensure_workspace_layout(root: str | Path) -> Path:
    workspace_root = Path(root).expanduser().resolve()
    workspace_root.mkdir(parents=True, exist_ok=True)
    for zone in WORKSPACE_ZONES:
        (workspace_root / zone).mkdir(parents=True, exist_ok=True)
    return workspace_root


def _relative_workspace_path(root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except Exception:
        return path.name


def _resolve_workspace_directory(root: Path, workspace_path: str) -> Path:
    target = (root / workspace_path).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(status_code=403, detail="Invalid workspace path")
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")
    return target


def _canva_export_output_path(root: Path, batch_path: str) -> Path:
    batch_name = Path(batch_path).name
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    canvas_batch_dir = root / "Canvas" / batch_name
    canvas_batch_dir.mkdir(parents=True, exist_ok=True)
    return canvas_batch_dir / f"export-{timestamp}"


def _command_response_with_defaults(
    result: dict[str, object],
    *,
    root: Path,
    batch_path: str,
    output_path: Path | None = None,
) -> dict[str, object]:
    payload = dict(result)
    payload["batch_path"] = batch_path
    if output_path is not None:
        payload["output_path"] = _relative_workspace_path(root, output_path)
    return payload


def _list_subdirectories(root: Path, folder: Path) -> list[dict[str, object]]:
    if not folder.exists() or not folder.is_dir():
        return []
    items: list[dict[str, object]] = []
    for child in sorted(folder.iterdir(), key=lambda item: _natural_sort_key(item.name)):
        if child.is_dir() and not child.name.startswith("."):
            items.append(
                {
                    "name": child.name,
                    "path": _relative_workspace_path(root, child),
                    "has_children": any(
                        grandchild.is_dir() and not grandchild.name.startswith(".")
                        for grandchild in child.iterdir()
                    ),
                }
            )
    return items


def _openable_source_details(root: Path, folder: Path) -> dict[str, object] | None:
    if not folder.exists() or not folder.is_dir():
        return None

    text_files = sorted(folder.glob("*.txt"))
    presentations = sorted(folder.glob("*.pptx"))
    content_file = None
    if text_files:
        content_file = text_files[0]
    elif presentations:
        content_file = presentations[0]
    if content_file is None:
        return None

    content = ""
    if content_file.suffix.lower() == ".txt":
        with content_file.open("r", encoding="utf-8") as handle:
            content = handle.read()
    else:
        # Keep raw-source editor resilient even when the folder contains a PPTX.
        # The CLI still handles the definitive parsing later.
        content = content_file.name

    images = []
    for item in sorted(folder.iterdir(), key=lambda entry: _natural_sort_key(entry.name)):
        if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(
                {
                    "name": item.name,
                    "url": _versioned_file_url(root, item),
                    "size": item.stat().st_size,
                }
            )
    return {
        "content": content,
        "images": images,
    }


def _read_json_file(path: Path) -> dict[str, object] | list[object] | None:
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if isinstance(data, (dict, list)):
        return data
    return None


def _latest_matching_file(folder: Path, pattern: str) -> Path | None:
    if not folder.exists() or not folder.is_dir():
        return None
    matches = [path for path in folder.glob(pattern) if path.is_file()]
    if not matches:
        return None
    return max(matches, key=lambda path: path.stat().st_mtime_ns)


def _workflow_status_payload(root: Path, target: Path) -> dict[str, object]:
    batch_json_path = target / "batch.json"
    bulkpost_dir = target / ".bulkpost"
    reports_dir = bulkpost_dir / "reports"
    generated_preview_path = bulkpost_dir / "generated-preview.json"
    generate_candidates = [path for path in (batch_json_path, generated_preview_path) if path.is_file()]
    latest_generate_output = max(generate_candidates, key=lambda path: path.stat().st_mtime_ns) if generate_candidates else None
    latest_post_report = _latest_matching_file(reports_dir, "import-*.json")
    latest_preflight_report = _latest_matching_file(reports_dir, "preflight-*.json")

    return {
        "has_batch_json": batch_json_path.is_file(),
        "has_bulkpost_state": (bulkpost_dir / "state.json").is_file(),
        "has_reports_dir": reports_dir.is_dir(),
        "latest_generate_output": _relative_workspace_path(root, latest_generate_output) if latest_generate_output is not None else None,
        "latest_post_report": _relative_workspace_path(root, latest_post_report) if latest_post_report is not None else None,
        "latest_preflight_report": _relative_workspace_path(root, latest_preflight_report) if latest_preflight_report is not None else None,
    }


def _workspace_departments_payload(root: Path) -> dict[str, object]:
    return _read_departments_payload(_workspace_departments_path(root))


def _read_departments_payload(path: Path) -> dict[str, object]:
    data = _read_json_file(path)
    if isinstance(data, dict) and isinstance(data.get("departments"), list):
        return data
    return dict(RAW_DEPARTMENTS_TEMPLATE)


def _write_departments_payload(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def _raw_department_item(department_code: str) -> dict[str, object]:
    return {
        "code": department_code,
        "id": "",
        "name": "",
        "wordpress_category_slug": "",
        "wordpress_category_parent_slug": None,
        "wordpress_tag_slug": "",
    }


def _raw_post_folder_name(raw_date: str, raw_time: str, department_code: str) -> str:
    compact_date = raw_date.replace("-", "")
    compact_time = raw_time.replace(":", "")
    return f"{compact_date[2:]}{compact_time}-{department_code}"


def _workspace_zone_payload(root: Path, zone_name: str) -> dict[str, object]:
    zone_path = root / zone_name
    return {
        "name": zone_name,
        "path": zone_name,
        "items": _list_subdirectories(root, zone_path),
    }


def _legacy_workspace_items(root: Path) -> list[dict[str, object]]:
    excluded = set(WORKSPACE_ZONES)
    items: list[dict[str, object]] = []
    for child in sorted(root.iterdir(), key=lambda item: _natural_sort_key(item.name)):
        if child.is_dir() and child.name not in excluded and not child.name.startswith("."):
            items.append(
                {
                    "name": child.name,
                    "path": child.name,
                    "has_children": any(
                        grandchild.is_dir() and not grandchild.name.startswith(".")
                        for grandchild in child.iterdir()
                    ),
                }
            )
    return items

@app.get("/config/wp")
def read_wp_config():
    current_path = get_wp_config_path()
    config = _read_wp_env_file(current_path)
    if config:
        return {**_default_wp_config(), **config}

    legacy_config = _read_wp_env_file(get_legacy_wp_config_path())
    return {**_default_wp_config(), **legacy_config}

@app.post("/config/wp")
def update_wp_config(new_config: dict):
    path = get_wp_config_path()
    _write_wp_env_file(path, new_config)
    return {"message": "WP config updated"}

@app.get("/files/{file_path:path}")
def serve_file(file_path: str):
    config = get_config()
    root = Path(config["root_path"]).expanduser().resolve()
    target = (root / file_path).resolve()

    if root not in target.parents and target != root:
        raise HTTPException(status_code=403, detail="Invalid file path")
    if not target.exists() or target.is_dir():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        target,
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
        },
    )


@app.get("/")
def serve_frontend_index():
    index_path = FRONTEND_DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {
        "message": "kppost-ui backend is running.",
        "frontend_built": False,
        "frontend_dist": str(FRONTEND_DIST_DIR),
    }


@app.get("/favicon.svg")
def serve_frontend_favicon():
    icon_path = FRONTEND_DIST_DIR / "favicon.svg"
    if not icon_path.exists():
        raise HTTPException(status_code=404, detail="favicon not found")
    return FileResponse(icon_path)


@app.get("/icons.svg")
def serve_frontend_icons():
    icon_path = FRONTEND_DIST_DIR / "icons.svg"
    if not icon_path.exists():
        raise HTTPException(status_code=404, detail="icons not found")
    return FileResponse(icon_path)

@app.get("/config")
def read_config():
    config = get_config()
    ensure_workspace_layout(config["root_path"])
    return config

@app.post("/config")
def update_config(new_config: dict):
    config = get_config()
    previous_root = ensure_workspace_layout(config["root_path"])
    config.update(new_config)
    next_root = ensure_workspace_layout(config["root_path"])
    departments_migration = _migrate_departments_templates(previous_root, next_root)
    workspace_departments_migration = _migrate_workspace_departments(previous_root, next_root)
    wp_env_migration = _migrate_workspace_env(previous_root, next_root)
    save_config(config)
    logger.info(
        "Config updated from API: root_path=%s departments_migration=%s workspace_departments_migration=%s wp_env_migration=%s",
        config["root_path"],
        departments_migration["status"],
        workspace_departments_migration["status"],
        wp_env_migration["status"],
    )
    return {
        **config,
        "departments_template_migration": departments_migration,
        "workspace_departments_migration": workspace_departments_migration,
        "wp_env_migration": wp_env_migration,
    }

@app.get("/browse")
def browse_folder():
    system = platform.system()
    path = None
    try:
        if system == "Darwin":
            cmd = ["osascript", "-e", 'POSIX path of (choose folder with prompt "Select Root Folder")']
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                path = result.stdout.strip()
        elif system == "Windows":
            cmd = ["powershell", "-Command", "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                path = result.stdout.strip()
        else:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            path = filedialog.askdirectory()
            root.destroy()
        
        if path:
            return {"path": path}
        return {"path": None}
    except Exception as e:
        return {"path": None, "error": str(e)}

@app.get("/workspace")
def get_workspace():
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    return {
        "root_path": str(root),
        "zones": {
            zone.lower(): _workspace_zone_payload(root, zone)
            for zone in WORKSPACE_ZONES
        },
        "legacy": _legacy_workspace_items(root),
    }


@app.get("/workspace/nodes/{workspace_path:path}")
def get_workspace_node(workspace_path: str):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    target = (root / workspace_path).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(status_code=403, detail="Invalid workspace path")
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    node = {
        "name": target.name,
        "path": _relative_workspace_path(root, target),
        "children": _list_subdirectories(root, target),
        "openable": False,
        "content": "",
        "images": [],
        "workflow_status": None,
        "workspace_departments": _workspace_departments_payload(root),
    }
    details = _openable_source_details(root, target)
    if details is not None:
        node["openable"] = True
        node["content"] = details["content"]
        node["images"] = details["images"]
    if node["path"].startswith("Batches/"):
        node["workflow_status"] = _workflow_status_payload(root, target)
    return node

class UpdatePostRequest(BaseModel):
    content: str

# MOVE PREVIEW ENDPOINTS UP TO ENSURE THEY MATCH FIRST
@app.get("/batches/{batch_path:path}/preview")
def get_batch_preview(batch_path: str):
    logger.info("Preview requested for batch=%s", batch_path)
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    batch_root = (root / batch_path).resolve()
    if root not in batch_root.parents and batch_root != root:
        raise HTTPException(status_code=403, detail="Invalid workspace path")
    content_path = os.path.join(batch_root, "content")
    
    if not os.path.exists(content_path):
        logger.info("Preview content path not found: %s", content_path)
        return {"posts": []}
    
    posts = []
    try:
        for item in os.listdir(content_path):
            if item.endswith(".md"):
                post_name = item[:-3]
                md_path = os.path.join(content_path, item)
                
                with open(md_path, "r", encoding="utf-8") as f:
                    md_content = f.read()
                
                images = []
                img_folder = os.path.join(content_path, post_name)
                if os.path.exists(img_folder) and os.path.isdir(img_folder):
                    for img_item in sorted(os.listdir(img_folder), key=_natural_sort_key):
                        if img_item.lower().endswith(IMAGE_EXTENSIONS):
                            image_path = Path(content_path) / post_name / img_item
                            images.append({
                                "name": img_item,
                                "url": _versioned_file_url(root, image_path),
                            })
                
                posts.append({
                    "name": post_name,
                    "content": md_content,
                "images": images
                })
    except Exception as e:
        logger.exception("Error building preview for batch=%s", batch_path)
        raise HTTPException(status_code=500, detail=str(e))
        
    logger.info("Preview ready for batch=%s posts=%s", batch_path, len(posts))
    return {"posts": sorted(posts, key=lambda x: _natural_sort_key(str(x["name"])))}

@app.put("/batches/{batch_path:path}/content/{post_name}")
def update_prepared_post(batch_path: str, post_name: str, req: UpdatePostRequest):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    md_path = os.path.join(root, batch_path, "content", f"{post_name}.md")
    
    if not os.path.exists(md_path):
        raise HTTPException(status_code=404, detail="Post not found")
    
    try:
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"message": "Post updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/batches/{workspace_path:path}/departments")
def get_departments(workspace_path: str):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    folder_path = os.path.join(root, workspace_path)
    dept_file = os.path.join(folder_path, "departments.json")

    if not os.path.exists(dept_file):
        raise HTTPException(status_code=404, detail="departments.json not found")

    with open(dept_file, "r") as f:
        return json.load(f)


@app.get("/workspace/departments")
def get_workspace_departments():
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    return _workspace_departments_payload(root)


@app.put("/workspace/departments")
def update_workspace_departments(data: dict):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    if "departments" not in data or not isinstance(data["departments"], list):
        raise HTTPException(status_code=400, detail="Invalid format")
    path = _workspace_departments_path(root)
    _write_departments_payload(path, data)
    return {"message": "Updated"}


@app.post("/raws/{workspace_path:path}/posts")
def create_raw_post(workspace_path: str, req: dict):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    source_root = _resolve_workspace_directory(root, workspace_path)
    raw_date = str(req.get("date", "")).strip()
    raw_time = str(req.get("time", "")).strip()
    department_code = str(req.get("department_code", "")).strip()

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    if not re.fullmatch(r"\d{2}:\d{2}", raw_time):
        raise HTTPException(status_code=400, detail="time must be HH:MM")
    if not re.fullmatch(r"[a-z0-9]+", department_code):
        raise HTTPException(status_code=400, detail="Invalid department code")

    departments_path = _workspace_departments_path(root)
    departments_payload = _read_departments_payload(departments_path)
    departments = departments_payload.get("departments", [])
    if not isinstance(departments, list):
        departments = []

    department_codes = {
        item.get("code", "").strip()
        for item in departments
        if isinstance(item, dict) and isinstance(item.get("code"), str)
    }
    if department_code not in department_codes:
        raise HTTPException(status_code=400, detail="Department code is not defined in workspace departments.json")

    folder_name = _raw_post_folder_name(raw_date, raw_time, department_code)
    folder_path = source_root / folder_name
    if folder_path.exists():
        raise HTTPException(status_code=400, detail="Raw post already exists")

    folder_path.mkdir(parents=True, exist_ok=False)
    text_path = folder_path / f"{folder_name}.txt"
    text_path.write_text("", encoding="utf-8")
    return {
        "name": folder_name,
        "path": _relative_workspace_path(root, folder_path),
    }

@app.put("/batches/{workspace_path:path}/departments")
def update_departments(workspace_path: str, data: dict):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    folder_path = root / workspace_path
    dept_file = folder_path / "departments.json"
    
    if "departments" not in data:
        raise HTTPException(status_code=400, detail="Invalid format")

    with dept_file.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)

    cache_file = _departments_cache_destination(root, folder_path)
    if cache_file is not None:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with cache_file.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
    return {"message": "Updated"}

@app.get("/batches/{workspace_path:path}")
def get_batch(workspace_path: str):
    return get_workspace_node(workspace_path)

class UpdateBatchRequest(BaseModel):
    content: str

@app.put("/batches/{workspace_path:path}")
def update_batch_content(workspace_path: str, req: UpdateBatchRequest):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    folder_path = os.path.join(root, workspace_path)
    
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail="Batch not found")
    txt_files = sorted(
        [name for name in os.listdir(folder_path) if name.lower().endswith(".txt")]
    )
    if txt_files:
        text_path = os.path.join(folder_path, txt_files[0])
    else:
        text_path = os.path.join(folder_path, f"{Path(folder_path).name}.txt")

    with open(text_path, "w", encoding="utf-8") as f:
        f.write(req.content)
        
    return {"message": "Content updated"}

def _canonical_image_name(folder_name: str, index: int, extension: str, use_prefix: bool):
    if use_prefix:
        return f"{folder_name}-{index:02d}{extension}"
    return f"{index}{extension}"


def reindex_images(folder_path: str, use_prefix: bool = False):
    """Renames images in a folder to a stable ordered sequence."""
    if not os.path.exists(folder_path):
        return
    
    image_extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp")
    items = sorted(
        [f for f in os.listdir(folder_path) if f.lower().endswith(image_extensions)],
        key=_natural_sort_key,
    )
    folder_name = os.path.basename(folder_path)
    
    # We use a temp name to avoid collisions during rename
    temp_files = []
    for i, filename in enumerate(items, 1):
        old_path = os.path.join(folder_path, filename)
        ext = os.path.splitext(filename)[1]
        temp_name = f"temp_{i}{ext}"
        temp_path = os.path.join(folder_path, temp_name)
        os.rename(old_path, temp_path)
        temp_files.append((temp_path, _canonical_image_name(folder_name, i, ext, use_prefix)))
    
    for temp_path, final_name in temp_files:
        final_path = os.path.join(folder_path, final_name)
        os.rename(temp_path, final_path)

@app.delete("/batches/{workspace_path:path}/images/{image_name}")
def delete_image(workspace_path: str, image_name: str):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    img_path = os.path.join(root, workspace_path, image_name)
    
    if os.path.exists(img_path):
        os.remove(img_path)
        # Auto re-index after delete
        reindex_images(os.path.join(root, workspace_path), use_prefix=workspace_path.startswith("Batches/"))
        return {"message": "Image deleted and re-indexed"}
    raise HTTPException(status_code=404, detail="Image not found")

@app.post("/batches/{workspace_path:path}/reorder")
def reorder_images(workspace_path: str, req: dict, post_name: Optional[str] = Query(None)):
    # req: {"order": ["1.jpg", "3.jpg", "2.jpg"]} (current names in desired order)
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    
    folder_path = os.path.join(root, workspace_path)
    if post_name:
        folder_path = os.path.join(folder_path, "content", post_name)
        
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail="Folder not found")
        
    order = req.get("order", [])
    if not order:
        return {"message": "Empty order"}

    image_extensions = IMAGE_EXTENSIONS
    current_images = [
        name
        for name in os.listdir(folder_path)
        if os.path.isfile(os.path.join(folder_path, name))
        and name.lower().endswith(image_extensions)
    ]
    if set(current_images) != set(order) or len(current_images) != len(order):
        raise HTTPException(
            status_code=400,
            detail="Reorder order must match the current image files exactly",
        )
        
    # Temporary rename to avoid collisions
    temp_renames = []
    for i, current_name in enumerate(order, 1):
        old_path = os.path.join(folder_path, current_name)
        ext = os.path.splitext(current_name)[1]
        temp_name = f"reorder_temp_{i}{ext}"
        temp_path = os.path.join(folder_path, temp_name)
        os.rename(old_path, temp_path)
        temp_renames.append((temp_path, i, ext))
        
    # Final rename
    use_prefix = workspace_path.startswith("Batches/") or post_name is not None
    folder_name = os.path.basename(folder_path)
    for temp_path, index, ext in temp_renames:
        final_name = _canonical_image_name(folder_name, index, ext, use_prefix)
        final_path = os.path.join(folder_path, final_name)
        os.rename(temp_path, final_path)
        
    return {"message": "Reordered successfully"}

@app.post("/batches/{workspace_path:path}/images")
async def upload_images(workspace_path: str, file: UploadFile = File(...)):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    folder_path = os.path.join(root, workspace_path)
    
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Save the file with its original name first
    file_path = os.path.join(folder_path, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Re-index to ensure it follows 1, 2, 3...
    reindex_images(folder_path, use_prefix=workspace_path.startswith("Batches/"))
    return {"message": "Uploaded and re-indexed"}

@app.post("/batches")
async def create_batch(
    date: str = Form(...),
    dept: str = Form(...),
    text: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None)
):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    
    folder_name = f"{date}-{dept}"
    folder_path = os.path.join(root, "Batches", folder_name)
    
    if os.path.exists(folder_path):
        raise HTTPException(status_code=400, detail="Folder already exists")
    
    os.makedirs(folder_path)
    
    text_filename = f"{date}.txt"
    with open(os.path.join(folder_path, text_filename), "w") as f:
        f.write(text or "")
    
    if images:
        for image in images:
            if image.filename:
                image_path = os.path.join(folder_path, image.filename)
                with open(image_path, "wb") as buffer:
                    shutil.copyfileobj(image.file, buffer)
            
    return {"message": "Batch created successfully", "name": folder_name}

class RenameBatchRequest(BaseModel):
    new_name: str

@app.patch("/batches/{workspace_path:path}")
def rename_batch(workspace_path: str, req: RenameBatchRequest):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    old_path = os.path.join(root, workspace_path)
    if os.sep in req.new_name or "/" in req.new_name:
        new_path = os.path.join(root, req.new_name)
    else:
        new_path = os.path.join(os.path.dirname(old_path), req.new_name)
    
    if not os.path.exists(old_path):
        raise HTTPException(status_code=404, detail="Batch not found")
    if os.path.exists(new_path):
        raise HTTPException(status_code=400, detail="New folder name already exists")
    
    try:
        os.rename(old_path, new_path)
        old_name = os.path.basename(old_path)
        new_name = os.path.basename(new_path)
        old_parts = old_name.split("-")
        new_parts = new_name.split("-")
        
        if len(old_parts) > 0 and len(new_parts) > 0:
            old_date = old_parts[0]
            new_date = new_parts[0]
            old_txt = os.path.join(new_path, f"{old_date}.txt")
            new_txt = os.path.join(new_path, f"{new_date}.txt")
            if os.path.exists(old_txt):
                os.rename(old_txt, new_txt)
                
        return {"message": "Batch renamed", "name": _relative_workspace_path(root, Path(new_path))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rename failed: {str(e)}")

def _start_cli_job(action: str, worker):
    current = get_cli_info()
    if current["status"] in {"installing", "updating"}:
        logger.info("Ignored CLI %s request because current status is %s", action, current["status"])
        return {"message": f"CLI is already {current['status']}."}

    def run_worker():
        try:
            logger.info("Starting CLI %s job", action)
            worker()
            config = get_config()
            state = get_cli_info(force_remote=False)
            config["cli_path"] = state.get("cli_path", config.get("cli_path", ""))
            save_config(config)
            logger.info("CLI %s job completed with status=%s", action, state.get("status"))
        except Exception as exc:
            logger.exception("CLI %s job failed", action)
            save_cli_state(
                {
                    "status": "error",
                    "message": f"{action.capitalize()} failed: {exc}",
                }
            )

    thread = threading.Thread(target=run_worker, daemon=True)
    thread.start()
    return {"message": f"CLI {action} started"}


@app.get("/cli/status")
def get_cli_status():
    return get_cli_info(force_remote=False)


@app.get("/cli/info")
def get_cli_info_endpoint():
    return get_cli_info(force_remote=True)


@app.post("/cli/install")
def install_cli_endpoint():
    return _start_cli_job("install", install_cli)


@app.post("/cli/setup")
def setup_cli():
    return _start_cli_job("install", install_cli)


@app.post("/cli/update")
def update_cli_endpoint():
    return _start_cli_job("update", update_cli)

@app.post("/commands/{cmd_name}")
def execute_command(cmd_name: str, args: dict):
    cmd_args = args.get("args", [])
    config = get_config()
    cli_path = config.get("cli_path", "")

    if not cli_path:
        raise HTTPException(status_code=400, detail="CLI not configured.")

    try:
        result = run_cli_command(cmd_name, cmd_args, cwd=config["root_path"])
        logger.info(
            "Command API completed: name=%s returncode=%s cwd=%s",
            cmd_name,
            result.get("returncode"),
            result.get("cwd"),
        )
        if result.get("stderr", "").strip():
            logger.warning("Command stderr for %s: %s", cmd_name, result["stderr"].strip())
        return result
    except FileNotFoundError as exc:
        logger.warning("Command API failed because CLI is missing: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Command API crashed for %s", cmd_name)
        return {
            "stdout": "",
            "stderr": str(exc),
            "returncode": 1,
            "command": f"{cli_path} {cmd_name} {' '.join(cmd_args)}".strip(),
            "cwd": config["root_path"],
        }


@app.post("/canva/export")
def export_canva(batch_path: str = Form(...)):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    cli_path = config.get("cli_path", "")
    if not cli_path:
        raise HTTPException(status_code=400, detail="CLI not configured.")

    _resolve_workspace_directory(root, batch_path)
    output_path = _canva_export_output_path(root, batch_path)

    try:
        result = run_cli_command(
            "canva",
            ["export", batch_path, _relative_workspace_path(root, output_path)],
            cwd=config["root_path"],
        )
        logger.info(
            "Canva export completed: batch=%s returncode=%s output=%s",
            batch_path,
            result.get("returncode"),
            output_path,
        )
        if result.get("stderr", "").strip():
            logger.warning("Canva export stderr for %s: %s", batch_path, result["stderr"].strip())
        return _command_response_with_defaults(result, root=root, batch_path=batch_path, output_path=output_path)
    except FileNotFoundError as exc:
        logger.warning("Canva export failed because CLI is missing: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Canva export crashed for %s", batch_path)
        return {
            "stdout": "",
            "stderr": str(exc),
            "returncode": 1,
            "command": f"{cli_path} canva export {batch_path} {_relative_workspace_path(root, output_path)}",
            "cwd": config["root_path"],
            "batch_path": batch_path,
            "output_path": _relative_workspace_path(root, output_path),
        }


@app.post("/canva/import")
def import_canva(
    batch_path: str = Form(...),
    feature_zip: UploadFile = File(...),
    news_watermark_zip: UploadFile = File(...),
):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    cli_path = config.get("cli_path", "")
    if not cli_path:
        raise HTTPException(status_code=400, detail="CLI not configured.")
    if feature_zip is None or news_watermark_zip is None:
        raise HTTPException(status_code=400, detail="Both Canva ZIP files are required.")

    _resolve_workspace_directory(root, batch_path)

    with tempfile.TemporaryDirectory(prefix="canva-import-", dir=root) as temp_dir:
        temp_root = Path(temp_dir)
        feature_path = temp_root / (feature_zip.filename or "feature.zip")
        news_path = temp_root / (news_watermark_zip.filename or "news-watermark.zip")
        feature_path.write_bytes(feature_zip.file.read())
        news_path.write_bytes(news_watermark_zip.file.read())

        try:
            result = run_cli_command(
                "canva",
                [
                    "import",
                    batch_path,
                    "-f",
                    os.fspath(feature_path),
                    "-nw",
                    os.fspath(news_path),
                ],
                cwd=config["root_path"],
            )
            logger.info(
                "Canva import completed: batch=%s returncode=%s",
                batch_path,
                result.get("returncode"),
            )
            if result.get("stderr", "").strip():
                logger.warning("Canva import stderr for %s: %s", batch_path, result["stderr"].strip())
            return _command_response_with_defaults(result, root=root, batch_path=batch_path)
        except FileNotFoundError as exc:
            logger.warning("Canva import failed because CLI is missing: %s", exc)
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Canva import crashed for %s", batch_path)
            return {
                "stdout": "",
                "stderr": str(exc),
                "returncode": 1,
                "command": f"{cli_path} canva import {batch_path} -f {feature_path} -nw {news_path}",
                "cwd": config["root_path"],
                "batch_path": batch_path,
            }

active_batch = None

@app.post("/batches/create_dir")
def create_batch_dir(req: dict):
    parent_path = Path(req["parent_path"]).expanduser().resolve()
    path = parent_path / req["folder_name"]
    path.mkdir(parents=True, exist_ok=True)
    return {"path": str(path)}


@app.post("/workspace/raws")
def create_raw_source(req: dict):
    config = get_config()
    root = ensure_workspace_layout(config["root_path"])
    raw_root = root / "Raws"
    folder_name = str(req.get("folder_name", "")).strip()
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")
    path = raw_root / folder_name
    if path.exists():
        raise HTTPException(status_code=400, detail="Raw source already exists")
    path.mkdir(parents=True, exist_ok=False)
    return {
        "name": path.name,
        "path": _relative_workspace_path(root, path),
    }

@app.post("/session/active-batch")
def set_active_batch(req: dict):
    global active_batch
    active_batch = req.get("batch_name")
    return {"batch_name": active_batch}

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("KPPPOST_UI_HOST", "127.0.0.1")
    port = int(os.environ.get("KPPPOST_UI_PORT", "8000"))
    config = get_config()
    logger.info(
        "Backend starting at %s | host=%s port=%s | config=%s | app_data=%s | root_path=%s | log=%s",
        datetime.now().isoformat(),
        host,
        port,
        CONFIG_FILE,
        get_app_data_dir(),
        config["root_path"],
        get_backend_log_file(),
    )
    uvicorn.run(app, host=host, port=port)
