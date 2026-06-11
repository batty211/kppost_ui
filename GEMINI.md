# Project Overview: kppost-ui

`kppost-ui` is a web-based dashboard and data preparation tool for the `kppwppost` Python CLI. It simplifies the process of creating raw post data and provides a visual interface for the entire WordPress posting workflow.

## 🏗 Architecture

- **Backend:** FastAPI (Python) - Acts as a file system bridge and CLI command executor.
- **Frontend:** React + TypeScript + Vite + Tailwind CSS - Provides a modern UI for data entry and workflow management.

## 🚀 Key Commands

### Backend
- **Location:** `backend/`
- **Run:** `python3 main.py` (Runs on port 8000)
- **Deps:** `pip install -r requirements.txt`

### Frontend
- **Location:** `frontend/`
- **Run:** `npm run dev` (Runs on port 5173)
- **Build:** `npm run build`
- **Deps:** `npm install`

## 📐 Development Conventions

- **Frontend:** Use Tailwind CSS for all styling. Icons provided by `lucide-react`. State management is handled via React hooks.
- **Backend:** Keep logic in `main.py` for simplicity in this local-first tool. Use `subprocess` for CLI execution.
- **Folder Naming:** Raw folders follow `YYMMDD-dept` or `YYMMDDHHMM-dept`. The UI now provides a date/time picker to ensure precision.
- **File Naming:** Text files inside folders match the date/time prefix (`YYMMDD.txt` or `YYMMDDHHMM.txt`).
- **Folder Management:** Folders can be renamed directly in the UI header. Renaming a folder also updates the corresponding internal text file to maintain consistency.

## 📅 Roadmap

- [x] Initial FastAPI backend with folder/file creation.
- [x] React dashboard with workflow buttons.
- [x] Tailwind CSS styling for a modern look.
- [x] Date/Time picker for folder creation.
- [x] Folder renaming functionality (syncs with internal file).
- [x] Implement real-time log streaming via Console Logs.
- [x] Add ability to edit existing raw text files in the UI.
- [x] **New: Image reordering and auto-naming (1, 2, 3...).**
- [x] **New: Dedicated Batch Preview page with MD and image review.**
- [x] **New: Categorized Sidebar (Raw vs Prepared).**
