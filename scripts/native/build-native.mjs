import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const mode = process.argv[2] === 'debug' ? 'debug' : 'release';
const nodeCommand = process.execPath;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function readNativeVersion() {
  const cargoToml = await readFile(path.join(rootDir, 'frontend', 'src-tauri', 'Cargo.toml'), 'utf8');
  const versionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return versionMatch?.[1] ?? '0.1.0';
}

function targetArchSlug() {
  if (process.arch === 'arm64') {
    return 'aarch64';
  }
  if (process.arch === 'x64') {
    return 'x86_64';
  }
  return process.arch;
}

async function main() {
  const buildArgs = ['build'];
  if (process.platform === 'darwin') {
    buildArgs.push('--bundles', 'app');
  }
  if (mode === 'debug') {
    buildArgs.push('--debug');
  }

  await run(nodeCommand, [path.join(rootDir, 'scripts', 'native', 'run-tauri-build.mjs'), ...buildArgs], {
    cwd: path.join(rootDir, 'frontend'),
  });

  if (process.platform !== 'darwin') {
    return;
  }

  const version = await readNativeVersion();
  const profileDir = mode === 'debug' ? 'debug' : 'release';
  const appPath = path.join(
    rootDir,
    'frontend',
    'src-tauri',
    'target',
    profileDir,
    'bundle',
    'macos',
    'kppost-ui.app',
  );
  const dmgPath = path.join(
    rootDir,
    'frontend',
    'src-tauri',
    'target',
    profileDir,
    'bundle',
    'dmg',
    `kppost-ui_${version}_${targetArchSlug()}.dmg`,
  );

  await run('bash', [path.join(rootDir, 'scripts', 'native', 'package-macos-dmg.sh'), appPath, dmgPath, 'kppost-ui']);
}

await main();
