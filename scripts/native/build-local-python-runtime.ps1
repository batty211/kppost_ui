param(
  [string]$TargetSlug = "windows-x64",
  [string]$PythonExePath = "",
  [string]$PythonLauncher = "py"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackendRequirements = Join-Path $RootDir "backend\requirements.txt"
$OutputDir = Join-Path $RootDir "native\python\$TargetSlug"
$TempDir = Join-Path $env:TEMP ("kppost-ui-python-copy-" + [guid]::NewGuid().ToString())
$StagingDir = Join-Path $TempDir "python-runtime"

function Cleanup {
  if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
  }
}

function Resolve-PythonExe {
  param(
    [string]$RequestedPath,
    [string]$Launcher
  )

  if ($RequestedPath) {
    if (-not (Test-Path $RequestedPath)) {
      throw "Missing source Python at $RequestedPath"
    }

    return (Resolve-Path $RequestedPath).Path
  }

  $resolved = & $Launcher -3 -c "import sys; print(sys.executable)" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($resolved)) {
    throw "Could not resolve Python executable from launcher '$Launcher'. Pass -PythonExePath explicitly."
  }

  return $resolved.Trim()
}

trap {
  Cleanup
  throw
}

if (-not (Test-Path $BackendRequirements)) {
  throw "Missing backend requirements file at $BackendRequirements"
}

$ResolvedPythonExe = Resolve-PythonExe -RequestedPath $PythonExePath -Launcher $PythonLauncher
$SourcePrefix = Split-Path -Parent $ResolvedPythonExe

New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

Write-Host "== Building bundled Python runtime =="
Write-Host "Python exe:    $ResolvedPythonExe"
Write-Host "Source prefix: $SourcePrefix"
Write-Host "Target slug:   $TargetSlug"
Write-Host "Output dir:    $OutputDir"

Write-Host "Copying local Python installation into staging runtime"
Copy-Item -Path (Join-Path $SourcePrefix "*") -Destination $StagingDir -Recurse -Force

$StagedPythonExe = Join-Path $StagingDir "python.exe"
if (-not (Test-Path $StagedPythonExe)) {
  throw "Copied runtime is missing python.exe at $StagedPythonExe"
}

Write-Host "Installing backend Python dependencies into staged runtime"
& $StagedPythonExe -m pip install --upgrade pip
& $StagedPythonExe -m pip install -r $BackendRequirements

if (Test-Path $OutputDir) {
  Remove-Item $OutputDir -Recurse -Force
}

Move-Item -Path $StagingDir -Destination $OutputDir

Write-Host "Bundled Python runtime ready at $OutputDir"

Cleanup
