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

    def test_create_or_repair_venv_uses_python_executable_override(self) -> None:
        venv_dir = Path(self.temp_dir.name) / "venv"
        expected_python = Path(self.temp_dir.name) / "python-runtime" / "bin" / "python3"
        expected_python.parent.mkdir(parents=True)
        expected_python.write_text("", encoding="utf-8")

        with patch.object(cli_manager, "get_cli_venv_dir", return_value=venv_dir), patch.object(
            cli_manager,
            "get_cli_python_path",
            return_value=venv_dir / "bin" / "python",
        ), patch.dict(os.environ, {"PYTHON_EXECUTABLE": str(expected_python)}, clear=False), patch.object(
            cli_manager.subprocess,
            "run",
        ) as subprocess_run:
            cli_manager._create_or_repair_venv()

        subprocess_run.assert_called_once_with(
            [str(expected_python), "-m", "venv", os.fspath(venv_dir)],
            check=True,
        )

    def test_install_from_source_adds_tzdata_on_windows(self) -> None:
        source_dir = Path(self.temp_dir.name) / "source"
        source_dir.mkdir()
        python_path = Path(self.temp_dir.name) / "venv" / "Scripts" / "python.exe"
        python_path.parent.mkdir(parents=True)
        python_path.write_text("", encoding="utf-8")

        with patch.object(cli_manager, "_create_or_repair_venv"), patch.object(
            cli_manager,
            "get_cli_python_path",
            return_value=python_path,
        ), patch.object(cli_manager.sys, "platform", "win32"), patch.object(
            cli_manager.subprocess,
            "run",
        ) as subprocess_run:
            cli_manager._install_from_source(source_dir)

        subprocess_run.assert_called_once_with(
            [
                str(python_path),
                "-m",
                "pip",
                "install",
                "--upgrade",
                "--force-reinstall",
                str(source_dir),
                "tzdata",
            ],
            check=True,
        )

    def test_install_from_source_keeps_existing_targets_on_non_windows(self) -> None:
        source_dir = Path(self.temp_dir.name) / "source"
        source_dir.mkdir()
        python_path = Path(self.temp_dir.name) / "venv" / "bin" / "python"
        python_path.parent.mkdir(parents=True)
        python_path.write_text("", encoding="utf-8")

        with patch.object(cli_manager, "_create_or_repair_venv"), patch.object(
            cli_manager,
            "get_cli_python_path",
            return_value=python_path,
        ), patch.object(cli_manager.sys, "platform", "darwin"), patch.object(
            cli_manager.subprocess,
            "run",
        ) as subprocess_run:
            cli_manager._install_from_source(source_dir)

        subprocess_run.assert_called_once_with(
            [
                str(python_path),
                "-m",
                "pip",
                "install",
                "--upgrade",
                "--force-reinstall",
                str(source_dir),
            ],
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
