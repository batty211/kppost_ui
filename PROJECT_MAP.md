# kppost-ui Project Map

`kppost-ui` is a local desktop wrapper around the `kppost` CLI workflow. The
desktop app should let users prepare content, review batches, and run the CLI
steps without manually installing Python, Node, or the CLI repo.

## Source of Truth

- `backend/cli/kppwppost/`
  - Vendored copy of the `kppost` CLI source.
  - This is the behavioral reference for `prepare`, `generate`, `preflight`,
    `post`, and Canva import/export.
- `backend/main.py`
  - Local FastAPI bridge used by the desktop UI.
  - Exposes batch/file APIs, WordPress config, and CLI install/update/execute
    endpoints.
- `frontend/src/`
  - React UI for workspace selection, batch review, and CLI controls.

## Runtime Layout

- App data is stored outside the repo, under the user profile.
- CLI source is installed and updated inside the app data directory.
- CLI executable path is stored in the app config after install/update.
- Batch files still live in the user-selected workspace root.
- WordPress credentials live in `workspace/.env`.
- Workspace-wide department mapping lives in `Raws/.kppost/departments.json`.

## Key Flows

1. Install CLI from GitHub.
2. Check installed version against the latest upstream version.
3. Update the vendored CLI source and reinstall it when a newer version exists.
4. Use the CLI through the backend command bridge, with workspace `.env` injected into subprocess runs.
5. Configure workspace-wide departments in `Settings` before creating raw posts or preparing a batch.
6. Create raw posts under `Raws/<source>/yymmddhhmm-department_code`.
7. Edit batches and prepare content in the UI, then run generate/preflight/post.

## Workspace Rules

- `Preflight` and `Post` are only enabled after `Generate` creates `batch.json`.
- `New Post` and `Prepare` depend on `Raws/.kppost/departments.json`.
- When the workspace root changes, the app attempts to migrate:
  - `workspace/.env`
  - `Raws/.kppost/departments.json`
  - cached reusable departments data referenced by `prepare-report.json`

## Generated / Local-Only Files

- `backend/config.json` is no longer the canonical config store.
- Logs, session dumps, `.DS_Store`, `node_modules`, and other scratch files are
  disposable.
- App runtime state lives in the OS app-data folder, not in the repo tree.

## How To Run Locally

- Backend: `cd backend && python3 main.py`
- Frontend: `cd frontend && npm install && npm run dev`

## Desktop Packaging Goal

- Bundle the backend, frontend, and runtime dependencies into one installable
  macOS/Windows app.
- Keep the CLI update flow inside the app so future `kppwppost` changes can be
  fetched and installed without manual user steps.
