from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="kppost-ui-tests-"))
os.environ.setdefault("KPPPOST_UI_DATA_DIR", str(TEST_RUNTIME / "data"))
os.environ.setdefault("KPPPOST_UI_WORKSPACE_DIR", str(TEST_RUNTIME / "workspace"))
os.environ.setdefault("KPPPOST_UI_LOG_DIR", str(TEST_RUNTIME / "logs"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class RawSourceRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "workspace"
        self.raw_source = self.root / "Raws" / "2026-news-1"
        self.raw_source.mkdir(parents=True)
        self.workspace_departments = self.root / "Raws" / ".kppost" / "departments.json"
        self.batch_dir = self.root / "Batches" / "batch-20260611140354"
        self.batch_dir.mkdir(parents=True)
        self.config_patch = patch.object(
            main,
            "get_config",
            return_value={
                "root_path": str(self.root),
                "cli_path": "/tmp/fake-kppost",
                "app_data_dir": str(Path(self.temp_dir.name) / "data"),
            },
        )
        self.config_patch.start()

    def tearDown(self) -> None:
        self.config_patch.stop()
        self.temp_dir.cleanup()

    def test_batch_workspace_node_includes_workflow_status(self) -> None:
        (self.batch_dir / "batch.json").write_text("{}", encoding="utf-8")
        bulkpost = self.batch_dir / ".bulkpost"
        reports = bulkpost / "reports"
        reports.mkdir(parents=True)
        (bulkpost / "state.json").write_text("{}", encoding="utf-8")
        (reports / "import-20260611-210000.json").write_text("{}", encoding="utf-8")

        node = main.get_workspace_node("Batches/batch-20260611140354")

        status = node["workflow_status"]
        assert isinstance(status, dict)
        self.assertTrue(status["has_batch_json"])
        self.assertTrue(status["has_bulkpost_state"])
        self.assertTrue(status["has_reports_dir"])
        self.assertEqual(status["latest_generate_output"], "Batches/batch-20260611140354/batch.json")
        self.assertEqual(
            status["latest_post_report"],
            "Batches/batch-20260611140354/.bulkpost/reports/import-20260611-210000.json",
        )

    def test_get_workspace_departments_returns_empty_template_when_missing(self) -> None:
        result = main.get_workspace_departments()

        self.assertEqual(result, {"departments": []})

    def test_update_workspace_departments_writes_workspace_departments_json(self) -> None:
        payload = {
            "departments": [
                {
                    "code": "gen",
                    "id": "10",
                    "name": "General",
                    "wordpress_category_slug": "general",
                    "wordpress_category_parent_slug": None,
                    "wordpress_tag_slug": "general-tag",
                }
            ]
        }

        result = main.update_workspace_departments(payload)

        self.assertEqual(result, {"message": "Updated"})
        self.assertEqual(
            json.loads(self.workspace_departments.read_text(encoding="utf-8")),
            payload,
        )

    def test_create_raw_post_creates_folder_and_marker_file(self) -> None:
        self.workspace_departments.parent.mkdir(parents=True, exist_ok=True)
        self.workspace_departments.write_text(
            json.dumps({"departments": [{"code": "gen"}]}, ensure_ascii=False),
            encoding="utf-8",
        )

        result = main.create_raw_post(
            "Raws/2026-news-1",
            {"date": "2026-06-11", "time": "14:03", "department_code": "gen"},
        )

        folder = self.raw_source / "260611-1403-gen"
        self.assertEqual(result["path"], "Raws/2026-news-1/260611-1403-gen")
        self.assertTrue(folder.is_dir())
        self.assertTrue((folder / "260611-1403-gen.txt").is_file())

    def test_create_raw_post_requires_workspace_departments(self) -> None:
        with self.assertRaises(HTTPException) as context:
            main.create_raw_post(
                "Raws/2026-news-1",
                {"date": "2026-06-11", "time": "14:03", "department_code": "visa"},
            )

        self.assertEqual(context.exception.status_code, 400)

    def test_create_raw_post_rejects_duplicate_folder(self) -> None:
        self.workspace_departments.parent.mkdir(parents=True, exist_ok=True)
        self.workspace_departments.write_text(
            json.dumps({"departments": [{"code": "gen"}]}, ensure_ascii=False),
            encoding="utf-8",
        )
        existing = self.raw_source / "260611-1403-gen"
        existing.mkdir(parents=True)

        with self.assertRaises(HTTPException) as context:
            main.create_raw_post(
                "Raws/2026-news-1",
                {"date": "2026-06-11", "time": "14:03", "department_code": "gen"},
            )

        self.assertEqual(context.exception.status_code, 400)

    def test_create_raw_post_rejects_unknown_department_code(self) -> None:
        self.workspace_departments.parent.mkdir(parents=True, exist_ok=True)
        self.workspace_departments.write_text(
            json.dumps({"departments": [{"code": "gen"}]}, ensure_ascii=False),
            encoding="utf-8",
        )

        with self.assertRaises(HTTPException) as context:
            main.create_raw_post(
                "Raws/2026-news-1",
                {"date": "2026-06-11", "time": "14:03", "department_code": "visa"},
            )

        self.assertEqual(context.exception.status_code, 400)

    def test_update_batch_content_writes_raw_post_text_file(self) -> None:
        post_dir = self.raw_source / "260611-1403-gen"
        post_dir.mkdir(parents=True)
        text_path = post_dir / "260611-1403-gen.txt"
        text_path.write_text("old", encoding="utf-8")

        result = main.update_batch_content(
            "Raws/2026-news-1/260611-1403-gen",
            main.UpdateBatchRequest(content="updated content"),
        )

        self.assertEqual(result, {"message": "Content updated"})
        self.assertEqual(text_path.read_text(encoding="utf-8"), "updated content")

    def test_update_batch_content_rejects_missing_folder(self) -> None:
        with self.assertRaises(HTTPException) as context:
            main.update_batch_content(
                "Raws/2026-news-1/missing-post",
                main.UpdateBatchRequest(content="updated content"),
            )

        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
