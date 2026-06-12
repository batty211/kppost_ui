import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const npmCacheDir = path.join(rootDir, '.native-build', 'npm-cache');
const cargoHomeDir = path.join(rootDir, '.native-build', 'cargo-home');
const userHomeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
const rustupBinDir = path.join(userHomeDir, '.cargo', 'bin');
const isWindows = process.platform === 'win32';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const cargoCommand = isWindows ? 'cargo.exe' : 'cargo';

await mkdir(npmCacheDir, { recursive: true });
await mkdir(cargoHomeDir, { recursive: true });

const args = process.argv.slice(2);
const commandArgs = ['--yes', '--cache', npmCacheDir, '@tauri-apps/cli@2', ...args];
const childEnv = {
  ...process.env,
  CARGO_HOME: cargoHomeDir,
  PATH: `${rustupBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
};

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, options);

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

async function ensureCargoAvailable() {
  try {
    await run(cargoCommand, ['--version'], {
      stdio: 'ignore',
      windowsHide: isWindows,
      env: childEnv,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(
      [
        'Rust toolchain not found: `cargo` is required for Tauri native builds.',
        `Checked PATH with expected rustup bin at: ${rustupBinDir}`,
        'Install Rust from https://rustup.rs/ and restart the terminal before retrying.',
        `Details: ${details}`,
      ].join('\n'),
    );
    process.exit(1);
  }
}

function createTauriSpawn() {
  if (!isWindows) {
    return {
      command: npxCommand,
      args: commandArgs,
    };
  }

  return {
    command: process.env.comspec || 'cmd.exe',
    args: ['/d', '/s', '/c', npxCommand, ...commandArgs],
  };
}

await ensureCargoAvailable();

const tauriSpawn = createTauriSpawn();
await run(tauriSpawn.command, tauriSpawn.args, {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'inherit',
  windowsHide: isWindows,
  env: childEnv,
});
