#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(scriptDir, '..', '..');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    includeAi: false,
    restartManaged: false,
    targetNames: null,
    workspaceRoot: defaultWorkspaceRoot,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--include-ai') {
      options.includeAi = true;
      continue;
    }

    if (arg === '--restart-managed') {
      options.restartManaged = true;
      continue;
    }

    if (arg === '--workspace-root') {
      const nextValue = rest[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --workspace-root');
      }
      options.workspaceRoot = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--targets') {
      const nextValue = rest[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --targets');
      }
      options.targetNames = nextValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.command !== 'start' && options.command !== 'stop') {
    throw new Error(
      'Usage: node tasks/integration-builder/integration-host.mjs <start|stop> [--include-ai] [--restart-managed] [--workspace-root <path>]',
    );
  }

  return options;
}

function canonicalTargetName(rawName) {
  const normalized = rawName.trim().toLowerCase();
  if (normalized === 'api') {
    return 'API';
  }

  if (normalized === 'web') {
    return 'Web';
  }

  if (normalized === 'mobile' || normalized === 'mobile-web' || normalized === 'expo-web') {
    return 'Mobile Expo Web';
  }

  if (normalized === 'ai') {
    return 'AI';
  }

  throw new Error(`Unsupported target name: ${rawName}`);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function writeManifest(manifestPath, workspaceRoot, records) {
  if (records.length === 0) {
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
    return;
  }

  const payload = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    processes: records,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  const result = spawnSync(
    'taskkill.exe',
    ['/PID', String(pid), '/T', '/F'],
    { encoding: 'utf8' },
  );

  return result.status === 0;
}

function resolvePnpmCjs(repoRoot) {
  const localCandidate = path.join(
    repoRoot,
    'node_modules',
    'pnpm',
    'bin',
    'pnpm.cjs',
  );
  if (fs.existsSync(localCandidate)) {
    return localCandidate;
  }

  const appDataCandidate = process.env.APPDATA
    ? path.join(
        process.env.APPDATA,
        'npm',
        'node_modules',
        'pnpm',
        'bin',
        'pnpm.cjs',
      )
    : null;
  if (appDataCandidate && fs.existsSync(appDataCandidate)) {
    return appDataCandidate;
  }

  const whereResult = spawnSync('cmd.exe', ['/d', '/c', 'where pnpm.cmd'], {
    encoding: 'utf8',
  });
  if (whereResult.status !== 0) {
    throw new Error(
      `Unable to resolve pnpm.cmd: ${whereResult.stderr || whereResult.stdout || whereResult.error?.message || 'no output'}`,
    );
  }

  const pnpmCmdPath = whereResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!pnpmCmdPath) {
    throw new Error('Unable to resolve pnpm.cmd from where.exe output.');
  }

  const globalCandidate = path.join(
    path.dirname(pnpmCmdPath),
    'node_modules',
    'pnpm',
    'bin',
    'pnpm.cjs',
  );
  if (fs.existsSync(globalCandidate)) {
    return globalCandidate;
  }

  throw new Error(`Unable to find pnpm.cjs next to ${pnpmCmdPath}`);
}

function getListeningConnection(port) {
  const result = spawnSync('netstat.exe', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  const lines = result.stdout.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('TCP')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5 || parts[3] !== 'LISTENING') {
      continue;
    }

    const localAddress = parts[1];
    const portMatch = localAddress.match(/:(\d+)$/);
    if (!portMatch || Number(portMatch[1]) !== port) {
      continue;
    }

    const ownerPid = Number(parts[4]);
    if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
      continue;
    }

    return {
      port,
      ownerPid,
    };
  }

  return null;
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testTcpPort(port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: '127.0.0.1',
      port,
    });

    const finish = (callback) => {
      socket.removeAllListeners();
      socket.destroy();
      callback();
    };

    socket.setTimeout(1500);
    socket.once('connect', () => finish(resolve));
    socket.once('timeout', () => finish(() => reject(new Error('timeout'))));
    socket.once('error', (error) => finish(() => reject(error)));
  });

  return true;
}

async function testUrlReachability(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
    });
    return response.status >= 200;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForTarget(port, healthUrl, timeoutSeconds = 45) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (healthUrl) {
      if (await testUrlReachability(healthUrl)) {
        return true;
      }
    } else if (getListeningConnection(port)) {
      return true;
    }

    await sleep(1000);
  }

  return false;
}

function getTargetManifestRecord(manifest, targetName) {
  if (!manifest?.processes) {
    return null;
  }

  return manifest.processes.find((record) => record.target === targetName) ?? null;
}

async function getRuntimeOwnerState(targetName, port, healthUrl, manifest) {
  const record = getTargetManifestRecord(manifest, targetName);
  const connection = getListeningConnection(port);
  const ownerPid = connection?.ownerPid ?? null;
  const reachable = healthUrl
    ? await testUrlReachability(healthUrl)
    : ownerPid !== null;

  let runtimeOwner = 'none';
  if (record && processExists(Number(record.pid)) && ownerPid === Number(record.pid)) {
    runtimeOwner = 'managed';
  } else if (ownerPid !== null) {
    runtimeOwner = 'unmanaged';
  } else if (record) {
    runtimeOwner = 'stale-record';
  }

  return {
    record,
    ownerPid,
    listening: connection ? 'yes' : 'no',
    reachable: reachable ? 'yes' : 'no',
    runtimeOwner,
  };
}

function formatRows(rows, columns) {
  const widths = {};
  for (const column of columns) {
    widths[column] = column.length;
  }

  for (const row of rows) {
    for (const column of columns) {
      widths[column] = Math.max(widths[column], String(row[column] ?? '').length);
    }
  }

  const formatRow = (row) =>
    columns
      .map((column) => String(row[column] ?? '').padEnd(widths[column], ' '))
      .join('  ');

  return [
    formatRow(
      Object.fromEntries(columns.map((column) => [column, column])),
    ),
    formatRow(
      Object.fromEntries(columns.map((column) => [column, '-'.repeat(widths[column])])),
    ),
    ...rows.map((row) => formatRow(row)),
  ].join('\n');
}

function startDetachedProcess(commandPath, args, workingDirectory, stdoutPath, stderrPath) {
  ensureDirectory(path.dirname(stdoutPath));
  const stdoutFd = fs.openSync(stdoutPath, 'a');
  const stderrFd = fs.openSync(stderrPath, 'a');

  try {
    const child = spawn(commandPath, args, {
      cwd: workingDirectory,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      windowsHide: true,
      env: process.env,
    });
    child.unref();
    return child.pid;
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

async function startManagedTarget(target, manifest, options) {
  const stdoutPath = path.join(options.artifactsDir, `${target.logPrefix}.out.log`);
  const stderrPath = path.join(options.artifactsDir, `${target.logPrefix}.err.log`);
  let state = await getRuntimeOwnerState(
    target.name,
    target.port,
    target.healthUrl,
    manifest,
  );

  if (options.restartManaged && state.runtimeOwner === 'managed' && state.record) {
    killProcessTree(Number(state.record.pid));
    await sleep(1000);
    state = await getRuntimeOwnerState(
      target.name,
      target.port,
      target.healthUrl,
      manifest,
    );
  }

  if (state.runtimeOwner === 'managed' && state.reachable === 'yes') {
    return {
      row: {
        Target: target.name,
        Port: target.port,
        Managed: 'yes',
        Started: 'no',
        Listening: state.listening,
        Reachable: state.reachable,
        Status: 'managed-running',
        Notes: `reused pid=${state.record.pid}`,
        Logs: stdoutPath,
      },
      record: state.record,
    };
  }

  if ((state.runtimeOwner === 'managed' || state.runtimeOwner === 'stale-record') && state.record) {
    killProcessTree(Number(state.record.pid));
    await sleep(1000);
    state = await getRuntimeOwnerState(
      target.name,
      target.port,
      target.healthUrl,
      manifest,
    );
  }

  if (state.runtimeOwner === 'unmanaged') {
    return {
      row: {
        Target: target.name,
        Port: target.port,
        Managed: 'no',
        Started: 'no',
        Listening: state.listening,
        Reachable: state.reachable,
        Status: 'already-running-unmanaged',
        Notes: `port already had an unmanaged listener pid=${state.ownerPid}`,
        Logs: stdoutPath,
      },
      record: null,
    };
  }

  fs.writeFileSync(stdoutPath, '', 'utf8');
  fs.writeFileSync(stderrPath, '', 'utf8');

  const pid = startDetachedProcess(
    process.execPath,
    [options.pnpmCjsPath, ...target.pnpmArgs],
    target.workingDirectory,
    stdoutPath,
    stderrPath,
  );
  const reachable = await waitForTarget(target.port, target.healthUrl, target.timeoutSeconds);
  const listening = getListeningConnection(target.port) ? 'yes' : 'no';
  const record = {
    target: target.name,
    port: target.port,
    pid,
    health_url: target.healthUrl,
    working_directory: target.workingDirectory,
    command_path: process.execPath,
    arguments: [options.pnpmCjsPath, ...target.pnpmArgs],
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
    started_at: new Date().toISOString(),
  };

  return {
    row: {
      Target: target.name,
      Port: target.port,
      Managed: 'yes',
      Started: 'yes',
      Listening: listening,
      Reachable: reachable ? 'yes' : 'no',
      Status: reachable ? 'started' : 'starting-timeout',
      Notes: `pid=${pid}`,
      Logs: stdoutPath,
    },
    record,
  };
}

function getTargets(repoRoot, includeAi) {
  const targets = [
    {
      name: 'API',
      port: 3001,
      healthUrl: 'http://127.0.0.1:3001/v1/health',
      workingDirectory: repoRoot,
      pnpmArgs: ['dev:api'],
      logPrefix: 'api-host',
      timeoutSeconds: 45,
    },
    {
      name: 'Web',
      port: 8080,
      healthUrl: 'http://127.0.0.1:8080/login',
      workingDirectory: repoRoot,
      pnpmArgs: ['dev:web'],
      logPrefix: 'web-host',
      timeoutSeconds: 45,
    },
    {
      name: 'Mobile Expo Web',
      port: 8081,
      healthUrl: 'http://127.0.0.1:8081/login',
      workingDirectory: repoRoot,
      pnpmArgs: ['dev:mobile:web'],
      logPrefix: 'mobile-host',
      timeoutSeconds: 60,
    },
  ];

  if (includeAi) {
    targets.push({
      name: 'AI',
      port: 8000,
      healthUrl: 'http://127.0.0.1:8000/health',
      workingDirectory: repoRoot,
      pnpmArgs: ['dev:ai'],
      logPrefix: 'ai-host',
      timeoutSeconds: 40,
    });
  }

  return targets;
}

function filterTargets(targets, requestedTargetNames) {
  if (!requestedTargetNames || requestedTargetNames.length === 0) {
    return targets;
  }

  const allowedNames = new Set(requestedTargetNames.map(canonicalTargetName));
  return targets.filter((target) => allowedNames.has(target.name));
}

function hasGeneratedPrismaClient(workspaceRoot) {
  const pnpmDir = path.join(workspaceRoot, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    return false;
  }

  const prismaClientDirs = fs
    .readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith('@prisma+client@'))
    .sort((left, right) => right.localeCompare(left));

  for (const entry of prismaClientDirs) {
    const generatedDtsPath = path.join(
      pnpmDir,
      entry,
      'node_modules',
      '.prisma',
      'client',
      'index.d.ts',
    );
    if (fs.existsSync(generatedDtsPath)) {
      return true;
    }
  }

  return false;
}

async function runBufferedCommand(commandPath, args, workingDirectory) {
  return await new Promise((resolve, reject) => {
    const child = spawn(commandPath, args, {
      cwd: workingDirectory,
      env: process.env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function ensureApiPrerequisites(options) {
  if (hasGeneratedPrismaClient(options.workspaceRoot)) {
    return;
  }

  const result = await runBufferedCommand(
    process.execPath,
    [
      options.pnpmCjsPath,
      '--filter',
      '@fittrack/api',
      'exec',
      'prisma',
      'generate',
      '--schema=prisma/schema.prisma',
    ],
    options.workspaceRoot,
  );

  if (result.code !== 0) {
    throw new Error(
      result.stderr || result.stdout || 'Prisma generate failed',
    );
  }
}

async function ensureWorkspaceInstall(options) {
  const result = await runBufferedCommand(
    process.execPath,
    [options.pnpmCjsPath, 'install'],
    options.workspaceRoot,
  );

  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'pnpm install failed');
  }
}

async function hasHealthyLocalInfra() {
  try {
    await Promise.all([testTcpPort(5433), testTcpPort(6379)]);
    return true;
  } catch {
    return false;
  }
}

async function ensureLocalInfra(repoRoot) {
  const composePath = path.join(repoRoot, 'docker-compose.local-infra.yml');
  if (!fs.existsSync(composePath)) {
    throw new Error(`Missing local infra compose file: ${composePath}`);
  }

  if (await hasHealthyLocalInfra()) {
    return;
  }

  const result = spawnSync(
    'docker',
    ['compose', '-f', composePath, 'up', '-d'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    if (await hasHealthyLocalInfra()) {
      return;
    }

    throw new Error(
      result.stderr || result.stdout || result.error?.message || 'docker compose up failed',
    );
  }
}

async function startCommand(options) {
  ensureDirectory(options.artifactsDir);
  await ensureWorkspaceInstall(options);
  await ensureLocalInfra(options.workspaceRoot);

  const existingManifest = readManifest(options.manifestPath);
  const targets = filterTargets(
    getTargets(options.workspaceRoot, options.includeAi),
    options.targetNames,
  );
  if (targets.some((target) => target.name === 'API')) {
    await ensureApiPrerequisites(options);
  }
  const rows = [];
  const records = [];

  for (const target of targets) {
    const result = await startManagedTarget(target, existingManifest, options);
    rows.push(result.row);
    if (result.record) {
      records.push(result.record);
    }
  }

  const targetNames = new Set(targets.map((target) => target.name));
  for (const record of existingManifest?.processes ?? []) {
    if (targetNames.has(record.target)) {
      continue;
    }

    if (processExists(Number(record.pid))) {
      records.push(record);
    }
  }

  writeManifest(options.manifestPath, options.workspaceRoot, records);

  console.log('');
  console.log('## Local Host Start');
  console.log(
    formatRows(rows, [
      'Target',
      'Port',
      'Managed',
      'Started',
      'Listening',
      'Reachable',
      'Status',
      'Notes',
      'Logs',
    ]),
  );

  const failedRequired = rows.filter(
    (row) => row.Target !== 'AI' && row.Reachable !== 'yes',
  );
  if (failedRequired.length > 0) {
    console.log('');
    console.log('Host start failed:');
    for (const row of failedRequired) {
      console.log(`- ${row.Target} did not become reachable on port ${row.Port}. Check ${row.Logs}.`);
    }
    process.exit(1);
  }

  console.log('');
  console.log(`Managed runtime manifest: ${options.manifestPath}`);
  console.log('Host start passed.');
}

function stopRecord(record) {
  const stopped = killProcessTree(Number(record?.pid));
  return {
    Target: record?.target ?? 'unknown',
    Port: record?.port ?? '',
    Managed: 'yes',
    Status: stopped ? 'stopped' : 'not-running',
    Notes: Number.isInteger(Number(record?.pid)) ? `pid=${record.pid}` : 'pid missing',
  };
}

function stopCommand(options) {
  const manifest = readManifest(options.manifestPath);

  if (!manifest?.processes?.length) {
    console.log('');
    console.log('## Local Host Stop');
    console.log('No managed runtime manifest found.');
    return;
  }

  const rows = manifest.processes.map((record) => stopRecord(record));
  writeManifest(options.manifestPath, options.workspaceRoot, []);

  console.log('');
  console.log('## Local Host Stop');
  console.log(
    formatRows(rows, ['Target', 'Port', 'Managed', 'Status', 'Notes']),
  );
  console.log('');
  console.log('Managed runtime manifest cleared.');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(parsed.workspaceRoot);
  const artifactsDir = path.join(workspaceRoot, '.artifacts');
  const manifestPath = path.join(artifactsDir, 'integration-host-manifest.json');
  const options = {
    ...parsed,
    workspaceRoot,
    artifactsDir,
    manifestPath,
  };

  if (parsed.command === 'start') {
    options.pnpmCjsPath = resolvePnpmCjs(workspaceRoot);
    await startCommand(options);
    return;
  }

  stopCommand(options);
}

await main();
