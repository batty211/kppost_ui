# Bundled Python Runtimes

Put the packaged Python 3.12 runtimes used by the native app in this folder.

Expected layout:

- `native/python/macos-arm64/`
- `native/python/macos-x64/`
- `native/python/windows-x64/`

Each folder should contain a runnable Python executable:

- macOS: `bin/python3` (or `bin/python`)
- Windows: `python.exe`

Each bundled runtime must also already include the backend dependencies from
`backend/requirements.txt`, currently:

- `fastapi`
- `uvicorn`
- `python-multipart`

Windows note:

- If the bundled runtime has no `pip` or `ensurepip`, do not try to repair it in place.
- Rebuild it from a full local Python or Conda environment instead.
- Repo helper with regular Windows Python:
  `powershell -ExecutionPolicy Bypass -File scripts/native/build-local-python-runtime.ps1`
- The script copies the local Python installation into `native/python/windows-x64/`
  and installs `backend/requirements.txt` into that copied runtime.
- The CLI also needs `tzdata` on Windows so `ZoneInfo("Asia/Bangkok")` works during
  `prepare` and `post`. The app installer now adds that package into the CLI venv
  automatically, but older installs may need a reinstall/update of the CLI runtime.

The native staging step copies any runtime folders it finds into `.native-build/stage/python/`
so the Tauri shell can launch the FastAPI backend and let the app manage the CLI venv
without requiring Python to be installed on the user's machine.
