#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUNTIME_DIR="${KPPPOST_UI_RUNTIME_DIR:-${ROOT_DIR}/.local-runtime}"
DATA_DIR="${KPPPOST_UI_DATA_DIR:-${RUNTIME_DIR}/data}"
WORKSPACE_DIR="${KPPPOST_UI_WORKSPACE_DIR:-${RUNTIME_DIR}/workspace}"
LOG_DIR="${KPPPOST_UI_LOG_DIR:-${RUNTIME_DIR}/logs}"
HOST="${KPPPOST_UI_HOST:-127.0.0.1}"
PORT="${KPPPOST_UI_PORT:-8000}"

BACKEND_LOG_FILE="${LOG_DIR}/backend.log"
LAUNCHER_LOG_FILE="${LOG_DIR}/launcher.log"
PID_FILE="${RUNTIME_DIR}/backend.pid"
URL="http://${HOST}:${PORT}"

mkdir -p "${RUNTIME_DIR}" "${DATA_DIR}" "${WORKSPACE_DIR}" "${LOG_DIR}"

exec > >(tee -a "${LAUNCHER_LOG_FILE}") 2>&1

echo "== kppost-ui local test launcher =="
echo "Project root: ${ROOT_DIR}"
echo "Runtime dir: ${RUNTIME_DIR}"
echo "Data dir: ${DATA_DIR}"
echo "Workspace dir: ${WORKSPACE_DIR}"
echo "Log dir: ${LOG_DIR}"
echo "URL: ${URL}"

if [ ! -f "${ROOT_DIR}/frontend/dist/index.html" ]; then
  echo "Missing frontend build at frontend/dist/index.html"
  echo "Build the frontend first with: cd frontend && npm run build"
  exit 1
fi

export KPPPOST_UI_RUNTIME_DIR="${RUNTIME_DIR}"
export KPPPOST_UI_DATA_DIR="${DATA_DIR}"
export KPPPOST_UI_WORKSPACE_DIR="${WORKSPACE_DIR}"
export KPPPOST_UI_LOG_DIR="${LOG_DIR}"
export KPPPOST_UI_LOG_FILE="${BACKEND_LOG_FILE}"
export KPPPOST_UI_HOST="${HOST}"
export KPPPOST_UI_PORT="${PORT}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python is required but was not found."
  exit 1
fi

export PYTHONPATH="${ROOT_DIR}/backend${PYTHONPATH:+:${PYTHONPATH}}"

"${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path

data_dir = Path(os.environ["KPPPOST_UI_DATA_DIR"])
workspace_dir = Path(os.environ["KPPPOST_UI_WORKSPACE_DIR"])
config_path = data_dir / "config.json"

config = {
    "root_path": str(workspace_dir),
    "cli_path": "",
    "app_data_dir": str(data_dir),
}

if config_path.exists():
    try:
        current = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(current, dict):
            config.update(current)
    except Exception:
        pass

config["root_path"] = str(workspace_dir)
config["app_data_dir"] = str(data_dir)
config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
PY

if [ -f "${PID_FILE}" ]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "Stopping existing backend process ${OLD_PID}"
    kill "${OLD_PID}" 2>/dev/null || true
    sleep 1
  fi
fi

: > "${BACKEND_LOG_FILE}"

"${PYTHON_BIN}" "${ROOT_DIR}/backend/main.py" >> "${BACKEND_LOG_FILE}" 2>&1 &
BACKEND_PID=$!
echo "${BACKEND_PID}" > "${PID_FILE}"
echo "Backend PID: ${BACKEND_PID}"

cleanup() {
  if kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo "Stopping backend ${BACKEND_PID}"
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
}

trap cleanup EXIT INT TERM

"${PYTHON_BIN}" - <<'PY'
import os
import sys
import time
from urllib.request import urlopen

url = f"http://{os.environ['KPPPOST_UI_HOST']}:{os.environ['KPPPOST_UI_PORT']}/"

for _ in range(50):
    try:
        with urlopen(url, timeout=1) as response:
            if response.status == 200:
                print(f"Backend ready at {url}")
                sys.exit(0)
    except Exception:
        time.sleep(0.2)

print(f"Backend did not become ready at {url}", file=sys.stderr)
sys.exit(1)
PY

if command -v open >/dev/null 2>&1; then
  open "${URL}" || true
fi

echo "Browser target: ${URL}"
echo "Backend log: ${BACKEND_LOG_FILE}"
echo "Launcher log: ${LAUNCHER_LOG_FILE}"
echo "Press Ctrl+C to stop."

wait "${BACKEND_PID}"
