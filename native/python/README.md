# Bundled Python Runtimes

Put the packaged Python 3.12 runtimes used by the native app in this folder.

Expected layout:

- `native/python/macos-arm64/`
- `native/python/macos-x64/`
- `native/python/windows-x64/`

Each folder should contain a runnable Python executable:

- macOS: `bin/python3` (or `bin/python`)
- Windows: `python.exe`

The native staging step copies any runtime folders it finds into `.native-build/stage/python/`
so the Tauri shell can launch the FastAPI backend and let the app manage the CLI venv
without requiring Python to be installed on the user's machine.
