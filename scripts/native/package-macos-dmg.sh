#!/usr/bin/env bash

set -euo pipefail

APP_PATH="${1:?app path is required}"
DMG_PATH="${2:?dmg path is required}"
VOLUME_NAME="${3:-kppost-ui}"

if [ ! -d "${APP_PATH}" ]; then
  echo "App bundle not found: ${APP_PATH}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kppost-ui-dmg.XXXXXX")"
STAGE_DIR="${TMP_DIR}/stage"
VOLUME_DIR="${STAGE_DIR}/${VOLUME_NAME}"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

mkdir -p "${VOLUME_DIR}"
cp -R "${APP_PATH}" "${VOLUME_DIR}/"
ln -s /Applications "${VOLUME_DIR}/Applications"

mkdir -p "$(dirname "${DMG_PATH}")"
rm -f "${DMG_PATH}"
ZIP_PATH="${DMG_PATH%.dmg}.zip"
rm -f "${ZIP_PATH}"

if hdiutil create \
  -volname "${VOLUME_NAME}" \
  -srcfolder "${VOLUME_DIR}" \
  -ov \
  -format UDZO \
  "${DMG_PATH}"; then
  echo "Created DMG at ${DMG_PATH}"
  exit 0
fi

echo "DMG creation failed; falling back to ZIP artifact" >&2
ditto -c -k --sequesterRsrc --keepParent "${APP_PATH}" "${ZIP_PATH}"
echo "Created ZIP at ${ZIP_PATH}"
