#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptWorkspaceRoot = path.resolve(__dirname, '..', '..');
const cwdWorkspaceRoot = process.cwd();
const workspaceRoot =
  fs.existsSync(path.join(cwdWorkspaceRoot, 'package.json')) &&
  fs.existsSync(path.join(cwdWorkspaceRoot, 'apps', 'ai-microservice'))
    ? cwdWorkspaceRoot
    : scriptWorkspaceRoot;
const aiRoot = path.join(workspaceRoot, 'apps', 'ai-microservice');
const uvCacheDir = path.join(workspaceRoot, '.artifacts', 'uv-cache-ai');
const uvRuntimeDir = path.join(workspaceRoot, '.artifacts', 'uv-ai-runtime');
const matplotlibCacheDir = path.join(workspaceRoot, '.artifacts', 'matplotlib-cache-ai');
const yoloConfigDir = path.join(workspaceRoot, '.artifacts', 'ultralytics-config');
const bundledPython = path.join(
  aiRoot,
  '.uv-python',
  'cpython-3.11.15-windows-x86_64-none',
  'python.exe',
);
const runtimePython = path.join(uvRuntimeDir, 'Scripts', 'python.exe');
const syncOnly = process.argv.includes('--sync-only');

for (const folder of [uvCacheDir, uvRuntimeDir, matplotlibCacheDir, yoloConfigDir]) {
  fs.mkdirSync(folder, { recursive: true });
}

const env = {
  ...process.env,
  FITTRACK_ENV_FILE: path.join(workspaceRoot, '.env'),
  FITTRACK_ENV_OVERRIDE: '1',
  MPLCONFIGDIR: matplotlibCacheDir,
  UV_CACHE_DIR: uvCacheDir,
  UV_PROJECT_ENVIRONMENT: uvRuntimeDir,
  YOLO_CONFIG_DIR: yoloConfigDir,
};

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: aiRoot,
      env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

const syncArgs = ['sync', '--frozen', '--no-dev'];
if (fs.existsSync(bundledPython)) {
  syncArgs.push('--python', bundledPython);
}

const syncResult = await run('uv', syncArgs);
if (syncResult.code !== 0) {
  process.exit(syncResult.code);
}

if (syncOnly) {
  process.exit(0);
}

const server = spawn(
  runtimePython,
  ['-m', 'uvicorn', '--app-dir', '.', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
  {
    cwd: aiRoot,
    env,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!server.killed) {
      server.kill(signal);
    }
  });
}

server.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
