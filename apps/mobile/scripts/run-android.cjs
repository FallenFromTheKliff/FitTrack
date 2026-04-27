#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(appRoot, 'android');
const expoCliPath = path.join(appRoot, 'node_modules', 'expo', 'bin', 'cli');

const generatedTargets = [
  path.join(androidRoot, 'build', 'generated', 'autolinking'),
  path.join(androidRoot, 'app', 'build', 'generated', 'autolinking'),
  path.join(androidRoot, 'app', 'build', 'intermediates', 'source_set_path_map'),
];

for (const target of generatedTargets) {
  fs.rmSync(target, { recursive: true, force: true });
}

const result = spawnSync(
  process.execPath,
  [
    '--max-old-space-size=8192',
    expoCliPath,
    'run:android',
    '--no-install',
    '--no-bundler',
    '--no-build-cache',
    ...process.argv.slice(2),
  ],
  {
    cwd: appRoot,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  },
);

process.exit(result.status ?? 1);
