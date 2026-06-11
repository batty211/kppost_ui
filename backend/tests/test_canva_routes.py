from __future__ import annotations

import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, UploadFile


TEST_RUNTIME = Path(tempfile.mkdtemp(prefix="kppost-ui-tests-"))
os.environ.setdefault("KPPPOST_UI_DATA_DIR", str(TEST_RUNTIME / "data"))
os.environ.setdefault("KPPPOST_UI_WORKSPACE_DIR", str(TEST_RUNTIME / "workspace"))
os.environ.setdefault("KPPPOST_UI_LOG_DIR", str(TEST_RUNTIME / "logs"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CanvaRouteTests(unittest.TestCase):
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
                "cli_path": "/tmp/fake-kppost",
                "app_data_dir": str(Path(self.temp_dir.name) / "data"),
            },
        )
        self.config_patch.start()

    def tearDown(self) -> None:
        self.config_patch.stop()
        self.temp_dir.cleanup()

    def _upload(self, filename: str, payload: bytes) -> UploadFile:
        return UploadFile(filename=filename, file=io.BytesIO(payload))

    def test_canva_export_targets_canvas_batch_subfolder(self) -> None:
        calls: list[tuple[str, list[str], str]] = []

        def fake_run(command: str, args: list[str], cwd: str) -> dict[str, object]:
            calls.append((command, args, cwd))
            return {
                "stdout": "ok",
                "stderr": "",
                "returncode": 0,
                "command": "fake",
                "cwd": cwd,
            }

        with patch.object(main, "run_cli_command", side_effect=fake_run):
            payload = main.export_canva(self.batch_path)

        self.assertEqual(calls[0][0], "canva")
        self.assertEqual(calls[0][1][0], "export")
        self.assertEqual(calls[0][1][1], self.batch_path)
        self.assertRegex(
            calls[0][1][2],
            r"^Canvas/batch-20260611100428/export-\d{8}-\d{6}$",
        )
        self.assertEqual(payload["output_path"], calls[0][1][2])
        self.assertTrue((self.root / "Canvas" / "batch-20260611100428").is_dir())

    def test_canva_import_requires_existing_batch(self) -> None:
        with self.assertRaises(HTTPException) as context:
            main.import_canva(
                "Batches/missing-batch",
                self._upload("feature.zip", b"feature"),
                self._upload("news.zip", b"news"),
            )

        self.assertEqual(context.exception.status_code, 404)

    def test_canva_import_rejects_missing_zip_files(self) -> None:
        with self.assertRaises(HTTPException) as context:
            main.import_canva(self.batch_path, self._upload("feature.zip", b"feature"), None)

        self.assertEqual(context.exception.status_code, 400)

    def test_canva_import_invokes_cli_with_required_flags(self) -> None:
        calls: list[tuple[str, list[str], str]] = []

        def fake_run(command: str, args: list[str], cwd: str) -> dict[str, object]:
            calls.append((command, args, cwd))
            return {
                "stdout": "imported",
                "stderr": "",
                "returncode": 0,
                "command": "fake",
                "cwd": cwd,
            }

        with patch.object(main, "run_cli_command", side_effect=fake_run):
            payload = main.import_canva(
                self.batch_path,
                self._upload("feature.zip", b"feature"),
                self._upload("news.zip", b"news"),
            )

        self.assertEqual(payload["returncode"], 0)
        self.assertEqual(calls[0][0], "canva")
        self.assertEqual(calls[0][1][0], "import")
        self.assertEqual(calls[0][1][1], self.batch_path)
        self.assertEqual(calls[0][1][2], "-f")
        self.assertTrue(calls[0][1][3].endswith("feature.zip"))
        self.assertEqual(calls[0][1][4], "-nw")
        self.assertTrue(calls[0][1][5].endswith("news.zip"))

    def test_canva_import_returns_cli_failures(self) -> None:
        with patch.object(
            main,
            "run_cli_command",
            return_value={
                "stdout": "",
                "stderr": "zip mismatch",
                "returncode": 2,
                "command": "fake",
                "cwd": str(self.root),
            },
        ):
            payload = main.import_canva(
                self.batch_path,
                self._upload("feature.zip", b"feature"),
                self._upload("news.zip", b"news"),
            )

        self.assertEqual(payload["returncode"], 2)
        self.assertEqual(payload["stderr"], "zip mismatch")


if __name__ == "__main__":
    unittest.main()
