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

import cli_manager


class CliManagerEnvTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "workspace"
        self.root.mkdir(parents=True)
        self.batch_dir = self.root / "Batches" / "batch-20260611140354"
        self.batch_dir.mkdir(parents=True)
        self.cli_path = Path(self.temp_dir.name) / "bin" / "kppost"
        self.cli_path.parent.mkdir(parents=True)
        self.cli_path.write_text("#!/bin/sh\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_run_cli_command_injects_workspace_wp_env(self) -> None:
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

        completed_process = cli_manager.subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="ok",
            stderr="",
        )

        with patch.object(
            cli_manager,
            "refresh_cli_state",
            return_value={"cli_path": str(self.cli_path)},
        ), patch.object(
            cli_manager.subprocess,
            "run",
            return_value=completed_process,
        ) as subprocess_run:
            cli_manager.run_cli_command("preflight", ["Batches/batch-20260611140354"], cwd=str(self.root))

        env = subprocess_run.call_args.kwargs["env"]
        self.assertEqual(env["WP_URL"], "https://workspace.example.com")
        self.assertEqual(env["WP_USERNAME"], "workspace-user")
        self.assertEqual(env["WP_APPLICATION_PASSWORD"], "workspace-pass")

    def test_run_cli_command_allows_batch_env_override(self) -> None:
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
        (self.batch_dir / ".env").write_text(
            "\n".join(
                [
                    "WP_URL=https://batch.example.com",
                    "WP_USERNAME=batch-user",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        completed_process = cli_manager.subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="ok",
            stderr="",
        )

        with patch.object(
            cli_manager,
            "refresh_cli_state",
            return_value={"cli_path": str(self.cli_path)},
        ), patch.object(
            cli_manager.subprocess,
            "run",
            return_value=completed_process,
        ) as subprocess_run:
            cli_manager.run_cli_command("preflight", ["Batches/batch-20260611140354"], cwd=str(self.root))

        env = subprocess_run.call_args.kwargs["env"]
        self.assertEqual(env["WP_URL"], "https://batch.example.com")
        self.assertEqual(env["WP_USERNAME"], "batch-user")
        self.assertEqual(env["WP_APPLICATION_PASSWORD"], "workspace-pass")


if __name__ == "__main__":
    unittest.main()
