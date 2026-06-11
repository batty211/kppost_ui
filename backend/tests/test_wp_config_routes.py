from __future__ import annotations

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


class WordPressConfigRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "workspace"
        self.root.mkdir(parents=True)
        self.legacy_path = Path(self.temp_dir.name) / "legacy-cli" / ".env"
        self.config_patch = patch.object(
            main,
            "get_config",
            return_value={
                "root_path": str(self.root),
                "cli_path": "/tmp/fake-kppost",
                "app_data_dir": str(Path(self.temp_dir.name) / "data"),
            },
        )
        self.legacy_patch = patch.object(
            main,
            "get_legacy_wp_config_path",
            return_value=self.legacy_path,
        )
        self.config_patch.start()
        self.legacy_patch.start()

    def tearDown(self) -> None:
        self.legacy_patch.stop()
        self.config_patch.stop()
        self.temp_dir.cleanup()

    def test_read_wp_config_prefers_workspace_env(self) -> None:
        (self.root / ".env").write_text(
            "\n".join(
                [
                    "WP_URL=https://workspace.example.com",
                    "WP_USERNAME=workspace-user",
                    "WP_APPLICATION_PASSWORD=workspace-pass",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        self.legacy_path.parent.mkdir(parents=True, exist_ok=True)
        self.legacy_path.write_text(
            "\n".join(
                [
                    "WP_URL=https://legacy.example.com",
                    "WP_USERNAME=legacy-user",
                    "WP_APPLICATION_PASSWORD=legacy-pass",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        result = main.read_wp_config()

        self.assertEqual(
            result,
            {
                "WP_URL": "https://workspace.example.com",
                "WP_USERNAME": "workspace-user",
                "WP_APPLICATION_PASSWORD": "workspace-pass",
            },
        )

    def test_read_wp_config_falls_back_to_legacy_env(self) -> None:
        self.legacy_path.parent.mkdir(parents=True, exist_ok=True)
        self.legacy_path.write_text(
            "\n".join(
                [
                    "WP_URL=https://legacy.example.com",
                    "WP_USERNAME=legacy-user",
                    "WP_APPLICATION_PASSWORD=legacy-pass",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        result = main.read_wp_config()

        self.assertEqual(
            result,
            {
                "WP_URL": "https://legacy.example.com",
                "WP_USERNAME": "legacy-user",
                "WP_APPLICATION_PASSWORD": "legacy-pass",
            },
        )

    def test_update_wp_config_writes_workspace_env_only(self) -> None:
        self.legacy_path.parent.mkdir(parents=True, exist_ok=True)
        self.legacy_path.write_text(
            "WP_URL=https://legacy.example.com\n",
            encoding="utf-8",
        )

        payload = {
            "WP_URL": "https://workspace.example.com",
            "WP_USERNAME": "editor",
            "WP_APPLICATION_PASSWORD": "secret",
            "IGNORED_KEY": "nope",
        }

        result = main.update_wp_config(payload)

        self.assertEqual(result, {"message": "WP config updated"})
        self.assertEqual(
            (self.root / ".env").read_text(encoding="utf-8"),
            "\n".join(
                [
                    "WP_URL=https://workspace.example.com",
                    "WP_USERNAME=editor",
                    "WP_APPLICATION_PASSWORD=secret",
                ]
            )
            + "\n",
        )
        self.assertEqual(
            self.legacy_path.read_text(encoding="utf-8"),
            "WP_URL=https://legacy.example.com\n",
        )

    def test_read_after_update_uses_workspace_env(self) -> None:
        payload = {
            "WP_URL": "https://workspace.example.com",
            "WP_USERNAME": "editor",
            "WP_APPLICATION_PASSWORD": "secret",
        }

        main.update_wp_config(payload)

        result = main.read_wp_config()

        self.assertEqual(result, payload)

    def test_execute_command_uses_workspace_root_as_cwd(self) -> None:
        with patch.object(
            main,
            "run_cli_command",
            return_value={
                "stdout": "",
                "stderr": "",
                "returncode": 0,
                "command": "fake",
                "cwd": str(self.root),
            },
        ) as run_cli_command:
            main.execute_command("preflight", {"args": ["Batches/example-batch"]})

        run_cli_command.assert_called_once_with(
            "preflight",
            ["Batches/example-batch"],
            cwd=str(self.root),
        )


if __name__ == "__main__":
    unittest.main()
