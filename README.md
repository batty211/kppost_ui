# kppost-ui

Desktop wrapper for the `kppost` WordPress batch workflow.

## What this repo is

- A local FastAPI backend plus React frontend for batch review and CLI control.
- A bundled workspace around the `kppost` CLI source in
  `backend/cli/kppwppost/`.
- A desktop-app foundation for macOS and Windows that should not require users
  to install Python, Node, or the CLI manually.

## Start locally

```bash
cd backend
python3 main.py
```

```bash
cd frontend
npm install
npm run dev
```

## Read first

- [Work log](./WORKLOG.md)
- [Project map](./PROJECT_MAP.md)
- [Local testing guide](./TESTING.md)
- [CLI spec](./backend/cli/kppwppost/SPEC.md)
- [CLI architecture](./backend/cli/kppwppost/ARCHITECTURE.md)
