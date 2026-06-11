$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$RuntimeDir = if ($env:KPPPOST_UI_RUNTIME_DIR) { $env:KPPPOST_UI_RUNTIME_DIR } else { Join-Path $RootDir ".local-runtime" }
$DataDir = if ($env:KPPPOST_UI_DATA_DIR) { $env:KPPPOST_UI_DATA_DIR } else { Join-Path $RuntimeDir "data" }
$WorkspaceDir = if ($env:KPPPOST_UI_WORKSPACE_DIR) { $env:KPPPOST_UI_WORKSPACE_DIR } else { Join-Path $RuntimeDir "workspace" }
$LogDir = if ($env:KPPPOST_UI_LOG_DIR) { $env:KPPPOST_UI_LOG_DIR } else { Join-Path $RuntimeDir "logs" }
$HostName = if ($env:KPPPOST_UI_HOST) { $env:KPPPOST_UI_HOST } else { "127.0.0.1" }
$Port = if ($env:KPPPOST_UI_PORT) { $env:KPPPOST_UI_PORT } else { "8000" }

$BackendLogFile = Join-Path $LogDir "backend.log"
$LauncherLogFile = Join-Path $LogDir "launcher.log"
$PidFile = Join-Path $RuntimeDir "backend.pid"
$Url = "http://${HostName}:${Port}"

New-Item -ItemType Directory -Force -Path $RuntimeDir, $DataDir, $WorkspaceDir, $LogDir | Out-Null
Add-Content -Path $LauncherLogFile -Value "== kppost-ui local test launcher $(Get-Date -Format s) =="
Add-Content -Path $LauncherLogFile -Value "Project root: $RootDir"
Add-Content -Path $LauncherLogFile -Value "Runtime dir: $RuntimeDir"
Add-Content -Path $LauncherLogFile -Value "Data dir: $DataDir"
Add-Content -Path $LauncherLogFile -Value "Workspace dir: $WorkspaceDir"
Add-Content -Path $LauncherLogFile -Value "Log dir: $LogDir"
Add-Content -Path $LauncherLogFile -Value "URL: $Url"

Write-Host "== kppost-ui local test launcher =="
Write-Host "Project root: $RootDir"
Write-Host "Runtime dir: $RuntimeDir"
Write-Host "Data dir: $DataDir"
Write-Host "Workspace dir: $WorkspaceDir"
Write-Host "Log dir: $LogDir"
Write-Host "URL: $Url"

if (-not (Test-Path (Join-Path $RootDir "frontend/dist/index.html"))) {
    Write-Error "Missing frontend build at frontend/dist/index.html. Build the frontend first with: cd frontend; npm run build"
}

$env:KPPPOST_UI_RUNTIME_DIR = $RuntimeDir
$env:KPPPOST_UI_DATA_DIR = $DataDir
$env:KPPPOST_UI_WORKSPACE_DIR = $WorkspaceDir
$env:KPPPOST_UI_LOG_DIR = $LogDir
$env:KPPPOST_UI_LOG_FILE = $BackendLogFile
$env:KPPPOST_UI_HOST = $HostName
$env:KPPPOST_UI_PORT = $Port
$env:PYTHONPATH = (Join-Path $RootDir "backend")

$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    $PythonCmd = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $PythonCmd) {
    Write-Error "Python is required but was not found."
}

$ConfigScript = @"
import json
import os
from pathlib import Path

data_dir = Path(os.environ["KPPPOST_UI_DATA_DIR"])
workspace_dir = Path(os.environ["KPPPOST_UI_WORKSPACE_DIR"])
config_path = data_dir / "config.json"

config = {
    "root_path": str(workspace_dir),
    "cli_path": "",
    "app_data_dir": str(data_dir),
}

if config_path.exists():
    try:
        current = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(current, dict):
            config.update(current)
    except Exception:
        pass

config["root_path"] = str(workspace_dir)
config["app_data_dir"] = str(data_dir)
config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
"@

& $PythonCmd.Source -c $ConfigScript

if (Test-Path $PidFile) {
    $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($OldPid) {
        try {
            Stop-Process -Id ([int]$OldPid) -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } catch {
        }
    }
}

Set-Content -Path $BackendLogFile -Value ""

$Process = Start-Process -FilePath $PythonCmd.Source `
    -ArgumentList "`"$RootDir/backend/main.py`"" `
    -RedirectStandardOutput $BackendLogFile `
    -RedirectStandardError $BackendLogFile `
    -PassThru

Set-Content -Path $PidFile -Value $Process.Id
Write-Host "Backend PID: $($Process.Id)"
Add-Content -Path $LauncherLogFile -Value "Backend PID: $($Process.Id)"

$ReadyScript = @"
import os
import sys
import time
from urllib.request import urlopen

url = f"http://{os.environ['KPPPOST_UI_HOST']}:{os.environ['KPPPOST_UI_PORT']}/"
for _ in range(50):
    try:
        with urlopen(url, timeout=1) as response:
            if response.status == 200:
                print(url)
                sys.exit(0)
    except Exception:
        time.sleep(0.2)
sys.exit(1)
"@

& $PythonCmd.Source -c $ReadyScript | Out-Null

Start-Process $Url | Out-Null
Write-Host "Browser target: $Url"
Write-Host "Backend log: $BackendLogFile"
Write-Host "Launcher log: $LauncherLogFile"
Write-Host "Use Stop-Process -Id $($Process.Id) to stop the backend if needed."
