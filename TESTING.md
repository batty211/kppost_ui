# kppost-ui Local Testing

Use the local launcher when you want to test the app on a real machine before packaging it as a native desktop app.

## Start

macOS:

```bash
chmod +x scripts/run-local-test.sh
./scripts/run-local-test.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local-test.ps1
```

The launcher opens the browser at `http://127.0.0.1:8000` by default and keeps runtime files outside the repo logic.

## Runtime Layout

The launcher creates `.local-runtime/` with:

- `data/` for `config.json`, `cli_state.json`, and bundled CLI runtime files
- `workspace/` for batches you want to test in the UI
- `logs/backend.log` for backend output and command failures
- `logs/launcher.log` for launcher startup details

You can override locations with:

- `KPPPOST_UI_RUNTIME_DIR`
- `KPPPOST_UI_DATA_DIR`
- `KPPPOST_UI_WORKSPACE_DIR`
- `KPPPOST_UI_LOG_DIR`
- `KPPPOST_UI_LOG_FILE`
- `KPPPOST_UI_HOST`
- `KPPPOST_UI_PORT`

## Recommended Test Flow

1. Open `Settings` and confirm the workspace path points to `.local-runtime/workspace`.
2. Check `CLI Status` and confirm the app shows `not installed` on a clean runtime.
3. Run `Install CLI` and watch the status move through `installing` to `ready` or `error`.
4. Copy or prepare a sample batch under `.local-runtime/workspace`.
5. Test the normal workflow: `prepare`, review/edit, reorder images, `generate`, `preflight`, `post`.
6. If something fails, inspect `logs/backend.log` first.

## Quick Checklists

### Backend

1. Use Miniconda first for Python tests.
2. Run the targeted backend test that matches the change.
3. If the change touches routing, API, or file I/O, include at least one test that exercises the real behavior.
4. For broader backend changes, run the full backend suite.

Example:

```bash
conda run -n base python -m unittest backend.tests.test_departments_routes
conda run -n base python -m unittest discover -s backend/tests -p 'test_*.py'
```

### Frontend

1. Run a quick build first.
2. Run lint if the change touches logic, types, or shared UI code.
3. For broader frontend changes, run both build and lint.

Example:

```bash
cd frontend && npm run build
cd frontend && npm run lint
```

### Full Project

1. Run backend tests first.
2. Run frontend build next.
3. Run frontend lint last.

Example:

```bash
conda run -n base python -m unittest discover -s backend/tests -p 'test_*.py'
cd frontend && npm run build
cd frontend && npm run lint
```

## Stop And Restart

macOS:

- Keep the launcher terminal open while testing.
- Press `Ctrl+C` in that terminal to stop the backend.

Windows:

- The launcher prints the backend PID after startup.
- Stop it with `Stop-Process -Id <PID>` if needed.

Restarting the launcher reuses the same `.local-runtime/` directory unless you change the environment variables.
