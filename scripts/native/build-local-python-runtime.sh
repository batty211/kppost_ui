#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_REQUIREMENTS="${ROOT_DIR}/backend/requirements.txt"

TARGET_SLUG="${1:-macos-arm64}"
SOURCE_PREFIX="${SOURCE_PREFIX:-/Users/theb/miniconda3}"
OUTPUT_DIR="${ROOT_DIR}/native/python/${TARGET_SLUG}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kppost-ui-python-pack.XXXXXX")"
ARCHIVE_PATH="${TMP_DIR}/python-runtime.tar.gz"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

if [ ! -x "${SOURCE_PREFIX}/bin/python3" ]; then
  echo "Missing source Python at ${SOURCE_PREFIX}/bin/python3" >&2
  exit 1
fi

if [ ! -f "${BACKEND_REQUIREMENTS}" ]; then
  echo "Missing backend requirements file at ${BACKEND_REQUIREMENTS}" >&2
  exit 1
fi

echo "== Building bundled Python runtime =="
echo "Source prefix: ${SOURCE_PREFIX}"
echo "Target slug:   ${TARGET_SLUG}"
echo "Output dir:    ${OUTPUT_DIR}"

conda run -n base python -m pip install conda-pack
echo "Installing backend Python dependencies into source runtime"
"${SOURCE_PREFIX}/bin/python3" -m pip install -r "${BACKEND_REQUIREMENTS}"
conda run -n base conda-pack -p "${SOURCE_PREFIX}" -o "${ARCHIVE_PATH}" --force --ignore-missing-files

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${OUTPUT_DIR}"

if [ -x "${OUTPUT_DIR}/bin/conda-unpack" ]; then
  "${OUTPUT_DIR}/bin/conda-unpack"
fi

echo "Bundled Python runtime ready at ${OUTPUT_DIR}"
