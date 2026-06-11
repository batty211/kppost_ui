from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="kppost-ui-tests-"))
os.environ.setdefault("KPPPOST_UI_DATA_DIR", str(TEST_RUNTIME / "data"))
os.environ.setdefault("KPPPOST_UI_WORKSPACE_DIR", str(TEST_RUNTIME / "workspace"))
os.environ.setdefault("KPPPOST_UI_LOG_DIR", str(TEST_RUNTIME / "logs"))

import main


class DepartmentsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "workspace"
        self.batch_path = "Batches/batch-20260611100428"
        self.batch_dir = self.root / self.batch_path
        self.batch_dir.mkdir(parents=True)
        self.config_patch = patch.object(
            main,
            "get_config",
            return_value={
                "root_path": str(self.root),
                "cli_path": "",
                "app_data_dir": str(Path(self.temp_dir.name) / "data"),
            },
        )
        self.config_patch.start()

    def tearDown(self) -> None:
        self.config_patch.stop()
        self.temp_dir.cleanup()

    def _route_index(self, path: str, method: str) -> int:
        for index, route in enumerate(main.app.routes):
            if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
                return index
        raise AssertionError(f"Route not found: {method} {path}")

    def test_departments_routes_are_registered_before_general_batch_routes(self) -> None:
        departments_get = self._route_index("/batches/{workspace_path:path}/departments", "GET")
        departments_put = self._route_index("/batches/{workspace_path:path}/departments", "PUT")
        batch_get = self._route_index("/batches/{workspace_path:path}", "GET")
        batch_put = self._route_index("/batches/{workspace_path:path}", "PUT")

        self.assertLess(departments_get, batch_get)
        self.assertLess(departments_get, batch_put)
        self.assertLess(departments_put, batch_get)
        self.assertLess(departments_put, batch_put)

    def test_get_departments_reads_batch_json(self) -> None:
        expected = {
            "departments": [
                {
                    "code": "gen",
                    "id": "123",
                    "name": "General",
                    "wordpress_category_slug": "general",
                    "wordpress_category_parent_slug": None,
                    "wordpress_tag_slug": "general-tag",
                }
            ]
        }
        (self.batch_dir / "departments.json").write_text(
            json.dumps(expected, ensure_ascii=False),
            encoding="utf-8",
        )

        result = main.get_departments(self.batch_path)

        self.assertEqual(result, expected)

    def test_update_departments_writes_batch_json(self) -> None:
        payload = {
            "departments": [
                {
                    "code": "gen",
                    "id": "123",
                    "name": "General",
                    "wordpress_category_slug": "general",
                    "wordpress_category_parent_slug": None,
                    "wordpress_tag_slug": "general-tag",
                }
            ]
        }

        result = main.update_departments(self.batch_path, payload)

        self.assertEqual(result, {"message": "Updated"})
        saved = json.loads((self.batch_dir / "departments.json").read_text(encoding="utf-8"))
        self.assertEqual(saved, payload)

    def test_update_departments_updates_parent_cache_from_prepare_report(self) -> None:
        payload = {
            "departments": [
                {
                    "code": "gen",
                    "id": "123",
                    "name": "งานทั่วไป",
                    "wordpress_category_slug": "general",
                    "wordpress_category_parent_slug": None,
                    "wordpress_tag_slug": "general-tag",
                }
            ]
        }
        cache_file = self.root / "Raws" / ".kppost" / "departments.json"
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps(
                {
                    "departments_cache_file": str(cache_file),
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        main.update_departments(self.batch_path, payload)

        saved_batch = json.loads((self.batch_dir / "departments.json").read_text(encoding="utf-8"))
        saved_cache = json.loads(cache_file.read_text(encoding="utf-8"))
        self.assertEqual(saved_batch, payload)
        self.assertEqual(saved_cache, payload)

    def test_update_departments_ignores_cache_path_outside_workspace(self) -> None:
        payload = {
            "departments": [
                {
                    "code": "gen",
                    "id": "123",
                    "name": "General",
                    "wordpress_category_slug": "general",
                    "wordpress_category_parent_slug": None,
                    "wordpress_tag_slug": "general-tag",
                }
            ]
        }
        external_cache = Path(self.temp_dir.name).parent / "outside-departments.json"
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps(
                {
                    "departments_cache_file": str(external_cache),
                }
            ),
            encoding="utf-8",
        )

        main.update_departments(self.batch_path, payload)

        self.assertFalse(external_cache.exists())


if __name__ == "__main__":
    unittest.main()
