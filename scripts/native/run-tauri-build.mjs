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
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

await mkdir(npmCacheDir, { recursive: true });
await mkdir(cargoHomeDir, { recursive: true });

const args = process.argv.slice(2);
const commandArgs = ['--cache', npmCacheDir, '@tauri-apps/cli@2', ...args];

const child = spawn(npxCommand, commandArgs, {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    CARGO_HOME: cargoHomeDir,
    PATH: `${rustupBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
