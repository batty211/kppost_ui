import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const stageRoot = path.join(rootDir, '.native-build', 'stage');
const backendSourceDir = path.join(rootDir, 'backend');
const backendStageDir = path.join(stageRoot, 'backend');
const frontendDistSourceDir = path.join(rootDir, 'frontend', 'dist');
const frontendStageDir = path.join(stageRoot, 'frontend', 'dist');
const pythonSourceDir = path.join(rootDir, 'native', 'python');
const pythonStageDir = path.join(stageRoot, 'python');
const metadataPath = path.join(stageRoot, 'manifest.json');

const backendIgnoreNames = new Set([
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.DS_Store',
  '.git',
  '.venv',
  'tests',
  'test_raw',
]);

const backendIgnoreSuffixes = ['.pyc', '.pyo', '.tmp', '.log'];

async function ensureCleanDir(targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
}

function shouldCopyBackendEntry(entryName) {
  if (backendIgnoreNames.has(entryName)) {
    return false;
  }

  return !backendIgnoreSuffixes.some((suffix) => entryName.endsWith(suffix));
}

async function copyDirectory(sourceDir, targetDir, filter) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    if (filter && !filter(entry.name, entry)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isSymbolicLink()) {
      const linkTarget = await fs.readlink(sourcePath);
      await fs.symlink(linkTarget, targetPath);
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, filter);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function listPythonRuntimeSlugs() {
  try {
    const entries = await fs.readdir(pythonSourceDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function stagePythonRuntimes() {
  const runtimeSlugs = await listPythonRuntimeSlugs();
  await ensureCleanDir(pythonStageDir);

  for (const slug of runtimeSlugs) {
    await copyDirectory(
      path.join(pythonSourceDir, slug),
      path.join(pythonStageDir, slug),
    );
  }

  return runtimeSlugs;
}

async function stageBackend() {
  await ensureCleanDir(backendStageDir);
  await copyDirectory(backendSourceDir, backendStageDir, shouldCopyBackendEntry);
}

async function stageFrontendDist() {
  await ensureCleanDir(frontendStageDir);
  await copyDirectory(frontendDistSourceDir, frontendStageDir);
}

async function main() {
  await fs.mkdir(stageRoot, { recursive: true });
  await stageBackend();
  await stageFrontendDist();
  const pythonRuntimes = await stagePythonRuntimes();

  const manifest = {
    generated_at: new Date().toISOString(),
    backend: path.relative(rootDir, backendStageDir),
    frontend_dist: path.relative(rootDir, frontendStageDir),
    python_runtimes: pythonRuntimes,
  };

  await fs.writeFile(metadataPath, JSON.stringify(manifest, null, 2));

  if (pythonRuntimes.length === 0) {
    console.warn(
      '[native-stage] No bundled Python runtimes were found under native/python/. Native packaging will fail until at least one target runtime is added.',
    );
  } else {
    console.log(`[native-stage] Staged Python runtimes: ${pythonRuntimes.join(', ')}`);
  }

  console.log(`[native-stage] Backend staged at ${path.relative(rootDir, backendStageDir)}`);
  console.log(`[native-stage] Frontend dist staged at ${path.relative(rootDir, frontendStageDir)}`);
}

await main();
