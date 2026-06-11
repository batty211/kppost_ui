from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="kppost-ui-tests-"))
os.environ.setdefault("KPPPOST_UI_DATA_DIR", str(TEST_RUNTIME / "data"))
os.environ.setdefault("KPPPOST_UI_WORKSPACE_DIR", str(TEST_RUNTIME / "workspace"))
os.environ.setdefault("KPPPOST_UI_LOG_DIR", str(TEST_RUNTIME / "logs"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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
        original_external_payload = {"departments": [{"code": "external", "id": "999", "name": "Outside"}]}
        external_cache.write_text(json.dumps(original_external_payload, ensure_ascii=False), encoding="utf-8")
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps(
                {
                    "departments_cache_file": str(external_cache),
                }
            ),
            encoding="utf-8",
        )

        main.update_departments(self.batch_path, payload)

        self.assertEqual(
            json.loads(external_cache.read_text(encoding="utf-8")),
            original_external_payload,
        )

    def test_update_config_migrates_departments_template_to_new_workspace(self) -> None:
        cache_file = self.root / "Raws" / ".kppost" / "departments.json"
        payload = {"departments": [{"code": "gen", "id": "123", "name": "General"}]}
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps({"departments_cache_file": str(cache_file)}, ensure_ascii=False),
            encoding="utf-8",
        )
        new_root = Path(self.temp_dir.name) / "workspace-next"

        result = main.update_config({"root_path": str(new_root)})

        migrated_cache = new_root / "Raws" / ".kppost" / "departments.json"
        self.assertEqual(result["departments_template_migration"]["status"], "copied")
        self.assertEqual(result["departments_template_migration"]["copied"], ["Raws/.kppost/departments.json"])
        self.assertEqual(
            json.loads(migrated_cache.read_text(encoding="utf-8")),
            payload,
        )

    def test_update_config_skips_migration_when_root_path_is_unchanged(self) -> None:
        result = main.update_config({"root_path": str(self.root)})

        self.assertEqual(result["departments_template_migration"]["status"], "skipped_same_root")
        self.assertEqual(result["departments_template_migration"]["copied"], [])

    def test_update_config_does_not_overwrite_existing_departments_template(self) -> None:
        cache_file = self.root / "Raws" / ".kppost" / "departments.json"
        cache_payload = {"departments": [{"code": "gen", "id": "123", "name": "General"}]}
        existing_payload = {"departments": [{"code": "news", "id": "456", "name": "News"}]}
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache_payload, ensure_ascii=False), encoding="utf-8")
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps({"departments_cache_file": str(cache_file)}, ensure_ascii=False),
            encoding="utf-8",
        )
        new_root = Path(self.temp_dir.name) / "workspace-next"
        destination_file = new_root / "Raws" / ".kppost" / "departments.json"
        destination_file.parent.mkdir(parents=True, exist_ok=True)
        destination_file.write_text(json.dumps(existing_payload, ensure_ascii=False), encoding="utf-8")

        result = main.update_config({"root_path": str(new_root)})

        self.assertEqual(result["departments_template_migration"]["status"], "skipped_existing")
        self.assertEqual(
            result["departments_template_migration"]["skipped_existing"],
            ["Raws/.kppost/departments.json"],
        )
        self.assertEqual(
            json.loads(destination_file.read_text(encoding="utf-8")),
            existing_payload,
        )

    def test_update_config_ignores_departments_template_path_outside_workspace(self) -> None:
        external_cache = Path(self.temp_dir.name).parent / "outside-departments.json"
        external_cache.write_text(json.dumps({"departments": []}), encoding="utf-8")
        (self.batch_dir / "prepare-report.json").write_text(
            json.dumps({"departments_cache_file": str(external_cache)}, ensure_ascii=False),
            encoding="utf-8",
        )
        new_root = Path(self.temp_dir.name) / "workspace-next"

        result = main.update_config({"root_path": str(new_root)})

        self.assertEqual(result["departments_template_migration"]["status"], "not_found")
        self.assertFalse((new_root / "outside-departments.json").exists())

    def test_update_config_migrates_workspace_departments_file(self) -> None:
        payload = {
            "departments": [
                {
                    "code": "gen",
                    "id": "02",
                    "name": "งานอำนวยการ",
                    "wordpress_category_slug": "generalstaff",
                    "wordpress_category_parent_slug": "activities",
                    "wordpress_tag_slug": "general_dep",
                }
            ]
        }
        workspace_departments = self.root / "Raws" / ".kppost" / "departments.json"
        workspace_departments.parent.mkdir(parents=True, exist_ok=True)
        workspace_departments.write_text(
            json.dumps(payload, ensure_ascii=False),
            encoding="utf-8",
        )
        new_root = Path(self.temp_dir.name) / "workspace-next"

        result = main.update_config({"root_path": str(new_root)})

        migrated = new_root / "Raws" / ".kppost" / "departments.json"
        self.assertEqual(result["workspace_departments_migration"]["status"], "copied")
        self.assertEqual(json.loads(migrated.read_text(encoding="utf-8")), payload)

    def test_update_config_migrates_workspace_wp_env(self) -> None:
        (self.root / ".env").write_text(
            "\n".join(
                [
                    "WP_URL=https://example.com",
                    "WP_USERNAME=admin",
                    "WP_APPLICATION_PASSWORD=secret",
                ]
            ) + "\n",
            encoding="utf-8",
        )
        new_root = Path(self.temp_dir.name) / "workspace-next"

        result = main.update_config({"root_path": str(new_root)})

        migrated_env = new_root / ".env"
        self.assertEqual(result["wp_env_migration"]["status"], "copied")
        self.assertTrue(migrated_env.is_file())
        self.assertEqual(
            migrated_env.read_text(encoding="utf-8"),
            (self.root / ".env").read_text(encoding="utf-8"),
        )

    def test_update_config_does_not_overwrite_existing_workspace_departments_or_env(self) -> None:
        workspace_departments = self.root / "Raws" / ".kppost" / "departments.json"
        workspace_departments.parent.mkdir(parents=True, exist_ok=True)
        workspace_departments.write_text(
            json.dumps({"departments": [{"code": "gen"}]}, ensure_ascii=False),
            encoding="utf-8",
        )
        (self.root / ".env").write_text("WP_URL=https://old.example.com\n", encoding="utf-8")

        new_root = Path(self.temp_dir.name) / "workspace-next"
        target_departments = new_root / "Raws" / ".kppost" / "departments.json"
        target_departments.parent.mkdir(parents=True, exist_ok=True)
        target_departments.write_text(
            json.dumps({"departments": [{"code": "visa"}]}, ensure_ascii=False),
            encoding="utf-8",
        )
        (new_root / ".env").write_text("WP_URL=https://new.example.com\n", encoding="utf-8")

        result = main.update_config({"root_path": str(new_root)})

        self.assertEqual(result["workspace_departments_migration"]["status"], "skipped_existing")
        self.assertEqual(result["wp_env_migration"]["status"], "skipped_existing")
        self.assertEqual(
            json.loads(target_departments.read_text(encoding="utf-8")),
            {"departments": [{"code": "visa"}]},
        )
        self.assertEqual(
            (new_root / ".env").read_text(encoding="utf-8"),
            "WP_URL=https://new.example.com\n",
        )


if __name__ == "__main__":
    unittest.main()
