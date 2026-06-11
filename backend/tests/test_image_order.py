from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="kppost-ui-tests-"))
os.environ.setdefault("KPPPOST_UI_DATA_DIR", str(TEST_RUNTIME / "data"))
os.environ.setdefault("KPPPOST_UI_WORKSPACE_DIR", str(TEST_RUNTIME / "workspace"))
os.environ.setdefault("KPPPOST_UI_LOG_DIR", str(TEST_RUNTIME / "logs"))

import main


class ImageOrderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "workspace"
        self.folder = self.root / "Raws" / "260603-gen"
        self.folder.mkdir(parents=True)
        (self.folder / "260603.txt").write_text("heading\nbody", encoding="utf-8")
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

    def test_workspace_images_follow_filename_order(self) -> None:
        for name in ("6.jpg", "2.jpg", "10.jpg", "1.jpg", "3.jpg"):
            (self.folder / name).write_bytes(name.encode("ascii"))

        node = main.get_workspace_node("Raws/260603-gen")

        self.assertEqual(
            [image["name"] for image in node["images"]],
            ["1.jpg", "2.jpg", "3.jpg", "6.jpg", "10.jpg"],
        )
        self.assertTrue(all("?v=" in image["url"] for image in node["images"]))

    def test_reorder_renames_real_files_and_changes_versioned_urls(self) -> None:
        (self.folder / "1.jpg").write_bytes(b"first-image")
        (self.folder / "2.jpg").write_bytes(b"second-image")
        before = main.get_workspace_node("Raws/260603-gen")
        before_urls = {image["name"]: image["url"] for image in before["images"]}

        main.reorder_images(
            "Raws/260603-gen",
            {"order": ["2.jpg", "1.jpg"]},
            post_name=None,
        )

        self.assertEqual((self.folder / "1.jpg").read_bytes(), b"second-image")
        self.assertEqual((self.folder / "2.jpg").read_bytes(), b"first-image")

        after = main.get_workspace_node("Raws/260603-gen")
        after_urls = {image["name"]: image["url"] for image in after["images"]}
        self.assertNotEqual(after_urls["1.jpg"], before_urls["1.jpg"])
        self.assertNotEqual(after_urls["2.jpg"], before_urls["2.jpg"])

    def test_reorder_rejects_incomplete_or_unknown_file_lists(self) -> None:
        (self.folder / "1.jpg").write_bytes(b"first-image")
        (self.folder / "2.jpg").write_bytes(b"second-image")

        with self.assertRaises(HTTPException) as missing:
            main.reorder_images(
                "Raws/260603-gen",
                {"order": ["1.jpg"]},
                post_name=None,
            )
        self.assertEqual(missing.exception.status_code, 400)

        with self.assertRaises(HTTPException) as unknown:
            main.reorder_images(
                "Raws/260603-gen",
                {"order": ["1.jpg", "missing.jpg"]},
                post_name=None,
            )
        self.assertEqual(unknown.exception.status_code, 400)

    def test_file_response_disables_stale_browser_cache(self) -> None:
        (self.folder / "1.jpg").write_bytes(b"image")

        response = main.serve_file("Raws/260603-gen/1.jpg")

        self.assertEqual(response.headers["cache-control"], "no-store, max-age=0")
        self.assertEqual(response.headers["pragma"], "no-cache")


if __name__ == "__main__":
    unittest.main()
