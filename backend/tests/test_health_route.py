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


class HealthRouteTests(unittest.TestCase):
    def test_health_check_reports_runtime_contract(self) -> None:
        with patch.dict(
            os.environ,
            {
                "KPPPOST_UI_APP_MODE": "native",
                "KPPPOST_UI_HOST": "127.0.0.1",
                "KPPPOST_UI_PORT": "45678",
            },
            clear=False,
        ):
            payload = main.health_check()

        self.assertEqual(
            payload,
            {
                "status": "ok",
                "app_mode": "native",
                "host": "127.0.0.1",
                "port": 45678,
            },
        )


if __name__ == "__main__":
    unittest.main()
