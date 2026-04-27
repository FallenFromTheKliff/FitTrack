#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const defaultWorkspaceRoot = path.resolve(scriptDir, '..', '..');
const defaultRestartDelayMs = 3000;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    includeAi: false,
    skipMobileWeb: false,
    workspaceRoot: defaultWorkspaceRoot,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--include-ai') {
      options.includeAi = true;
      continue;
    }

    if (arg === '--no-mobile-web') {
      options.skipMobileWeb = true;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['start', 'run', 'stop', 'status'].includes(options.command)) {
    throw new Error(
      'Usage: node tasks/integration-builder/dev-stack-supervisor.mjs <start|run|stop|status> [--include-ai] [--workspace-root <path>]',
    );
  }

  return options;
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

function writeManifest(manifestPath, payload) {
  ensureDirectory(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function removeManifest(manifestPath) {
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
  }
}

function createBootstrapManifest(workspaceRoot, supervisorPid, includeAi) {
  return {
    schema_version: 1,
    mode: 'dev-stack-supervisor',
    workspace_root: workspaceRoot,
    updated_at: new Date().toISOString(),
    supervisor: {
      pid: supervisorPid,
      started_at: new Date().toISOString(),
      include_ai: includeAi,
    },
    processes: [],
  };
}

function readLogTail(logPath, maxChars = 4000) {
  if (!fs.existsSync(logPath)) {
    return '';
  }

  const content = fs.readFileSync(logPath, 'utf8').trim();
  if (content.length <= maxChars) {
    return content;
  }

  return content.slice(-maxChars);
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

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
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

function getTargets(repoRoot, includeAi, skipMobileWeb = false) {
  const targets = [
    {
      name: 'API',
      port: 3001,
      healthUrl: 'http://127.0.0.1:3001/v1/health',
      pnpmArgs: ['dev:api'],
      logPrefix: 'api-stack',
      restartDelayMs: defaultRestartDelayMs,
    },
    {
      name: 'Web',
      port: 8080,
      healthUrl: 'http://127.0.0.1:8080/login',
      pnpmArgs: ['dev:web'],
      logPrefix: 'web-stack',
      restartDelayMs: defaultRestartDelayMs,
    },
  ];

  if (!skipMobileWeb) {
    targets.push({
      name: 'Mobile Expo Web',
      port: 8081,
      healthUrl: 'http://127.0.0.1:8081/login',
      pnpmArgs: ['dev:mobile:web'],
      logPrefix: 'mobile-stack',
      restartDelayMs: defaultRestartDelayMs,
    });
  }

  if (includeAi) {
    targets.push({
      name: 'AI',
      port: 8000,
      healthUrl: 'http://127.0.0.1:8000/health',
      pnpmArgs: ['dev:ai'],
      logPrefix: 'ai-stack',
      restartDelayMs: defaultRestartDelayMs,
    });
  }

  return targets.map((target) => ({
    ...target,
    workingDirectory: repoRoot,
  }));
}

function startBackgroundProcess(commandPath, args, workingDirectory, stdoutPath, stderrPath) {
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

function spawnManagedChild(commandPath, args, workingDirectory, stdoutPath, stderrPath) {
  ensureDirectory(path.dirname(stdoutPath));
  const stdoutFd = fs.openSync(stdoutPath, 'a');
  const stderrFd = fs.openSync(stderrPath, 'a');

  const child = spawn(commandPath, args, {
    cwd: workingDirectory,
    stdio: ['ignore', stdoutFd, stderrFd],
    windowsHide: true,
    env: process.env,
  });

  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);
  return child;
}

function buildArtifactsPaths(artifactsDir, logPrefix) {
  return {
    stdoutPath: path.join(artifactsDir, `${logPrefix}.out.log`),
    stderrPath: path.join(artifactsDir, `${logPrefix}.err.log`),
  };
}

function createRuntimeState(options) {
  return {
    options,
    shuttingDown: false,
    targets: new Map(),
  };
}

function currentManifestPayload(runtimeState) {
  const processes = [...runtimeState.targets.values()].map((entry) => ({
    owner: entry.owner ?? 'managed',
    target: entry.target.name,
    port: entry.target.port,
    pid: entry.child?.pid ?? null,
    health_url: entry.target.healthUrl,
    working_directory: entry.target.workingDirectory,
    command_path: process.execPath,
    arguments: [runtimeState.options.pnpmCjsPath, ...entry.target.pnpmArgs],
    stdout_path: entry.stdoutPath,
    stderr_path: entry.stderrPath,
    restart_count: entry.restartCount,
    started_at: entry.startedAt,
    last_exit_at: entry.lastExitAt,
    last_exit_code: entry.lastExitCode,
    last_exit_signal: entry.lastExitSignal,
  }));

  return {
    schema_version: 1,
    mode: 'dev-stack-supervisor',
    workspace_root: runtimeState.options.workspaceRoot,
    updated_at: new Date().toISOString(),
    supervisor: {
      pid: process.pid,
      started_at: runtimeState.options.startedAt,
      include_ai: runtimeState.options.includeAi,
    },
    processes,
  };
}

function flushManifest(runtimeState) {
  writeManifest(
    runtimeState.options.manifestPath,
    currentManifestPayload(runtimeState),
  );
}

async function isTargetHealthy(target) {
  if (target.healthUrl) {
    return testUrlReachability(target.healthUrl);
  }

  if (target.port) {
    try {
      await testTcpPort(target.port);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function testTcpPort(port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });

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
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runBufferedCommand(commandPath, args, workingDirectory, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandPath, args, {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...envOverrides },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
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

async function ensureWorkspaceInstall(options) {
  const localStoreRoot = path.resolve(options.workspaceRoot, '..', '.pnpm-store');
  const installArgs = [
    options.pnpmCjsPath,
    'install',
    '--frozen-lockfile',
  ];
  if (fs.existsSync(localStoreRoot)) {
    installArgs.push('--store-dir', localStoreRoot);
  }

  const result = await runBufferedCommand(
    process.execPath,
    installArgs,
    options.workspaceRoot,
    {
      CI: process.env.CI || 'true',
      npm_config_cache:
        process.env.npm_config_cache || path.join(options.workspaceRoot, '.npm-cache'),
    },
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
    return;
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

  if (result.status !== 0 && !(await hasHealthyLocalInfra())) {
    throw new Error(
      result.stderr || result.stdout || result.error?.message || 'docker compose up failed',
    );
  }
}

async function ensureApiPrerequisites(options) {
  const apiRoot = path.join(options.workspaceRoot, 'apps', 'api');
  if (!fs.existsSync(apiRoot)) {
    return;
  }

  const result = await runBufferedCommand(
    process.execPath,
    [options.pnpmCjsPath, 'db:generate'],
    options.workspaceRoot,
    {
      CI: process.env.CI || 'true',
    },
  );

  if (result.code !== 0) {
    throw new Error(
      result.stderr || result.stdout || 'pnpm db:generate failed',
    );
  }
}

function startTarget(target, runtimeState, existingEntry = null) {
  const entry = existingEntry ?? {
    target,
    owner: 'managed',
    restartCount: 0,
    startedAt: null,
    lastExitAt: null,
    lastExitCode: null,
    lastExitSignal: null,
    child: null,
    restartTimer: null,
    ...buildArtifactsPaths(runtimeState.options.artifactsDir, target.logPrefix),
  };

  entry.target = target;
  entry.owner = 'managed';
  entry.startedAt = new Date().toISOString();
  entry.lastExitAt = null;
  entry.lastExitCode = null;
  entry.lastExitSignal = null;

  const child = spawnManagedChild(
    process.execPath,
    [runtimeState.options.pnpmCjsPath, ...target.pnpmArgs],
    target.workingDirectory,
    entry.stdoutPath,
    entry.stderrPath,
  );

  entry.child = child;
  runtimeState.targets.set(target.name, entry);
  flushManifest(runtimeState);

  child.once('exit', (code, signal) => {
    entry.child = null;
    entry.lastExitAt = new Date().toISOString();
    entry.lastExitCode = code;
    entry.lastExitSignal = signal;
    flushManifest(runtimeState);

    if (runtimeState.shuttingDown) {
      return;
    }

    void (async () => {
      if (await isTargetHealthy(target)) {
        entry.owner = 'external';
        flushManifest(runtimeState);
        return;
      }

      entry.restartCount += 1;
      flushManifest(runtimeState);
      entry.restartTimer = setTimeout(() => {
        entry.restartTimer = null;
        if (runtimeState.shuttingDown) {
          return;
        }
        startTarget(target, runtimeState, entry);
      }, target.restartDelayMs ?? defaultRestartDelayMs);
    })();
  });
}

function stopAllTargets(runtimeState) {
  runtimeState.shuttingDown = true;

  for (const entry of runtimeState.targets.values()) {
    if (entry.restartTimer) {
      clearTimeout(entry.restartTimer);
      entry.restartTimer = null;
    }

    if (entry.child?.pid) {
      killProcessTree(entry.child.pid);
    }
  }
}

function attachShutdownHandlers(runtimeState) {
  const stop = () => {
    stopAllTargets(runtimeState);
    removeManifest(runtimeState.options.manifestPath);
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('exit', () => {
    removeManifest(runtimeState.options.manifestPath);
  });
}

async function startCommand(options) {
  const manifest = readManifest(options.manifestPath);
  const supervisorPid = manifest?.supervisor?.pid;

  if (processExists(Number(supervisorPid))) {
    console.log(`Dev stack already running under pid=${supervisorPid}.`);
    console.log(`Manifest: ${options.manifestPath}`);
    return;
  }

  await ensureLocalInfra(options.workspaceRoot);

  const { stdoutPath, stderrPath } = buildArtifactsPaths(
    options.artifactsDir,
    'dev-stack-supervisor',
  );
  fs.writeFileSync(stdoutPath, '', 'utf8');
  fs.writeFileSync(stderrPath, '', 'utf8');
  const pid = startBackgroundProcess(
    process.execPath,
    [scriptPath, 'run', ...(options.includeAi ? ['--include-ai'] : [])],
    options.workspaceRoot,
    stdoutPath,
    stderrPath,
  );

  writeManifest(
    options.manifestPath,
    createBootstrapManifest(options.workspaceRoot, pid, options.includeAi),
  );

  await sleep(2500);
  if (!processExists(pid)) {
    removeManifest(options.manifestPath);
    const logTail = readLogTail(stderrPath);
    throw new Error(
      `Dev stack failed during bootstrap.\nCheck ${stderrPath}.${logTail ? `\n\nRecent stderr:\n${logTail}` : ''}`,
    );
  }

  console.log(`Dev stack supervisor started with pid=${pid}.`);
  console.log(`Manifest: ${options.manifestPath}`);
  console.log(`Logs: ${stdoutPath}`);
}

async function runCommand(options) {
  options.pnpmCjsPath = resolvePnpmCjs(options.workspaceRoot);
  options.startedAt = new Date().toISOString();
  ensureDirectory(options.artifactsDir);

  await ensureWorkspaceInstall(options);
  await ensureLocalInfra(options.workspaceRoot);
  await ensureApiPrerequisites(options);

  const runtimeState = createRuntimeState(options);
  attachShutdownHandlers(runtimeState);

  for (const target of getTargets(options.workspaceRoot, options.includeAi, options.skipMobileWeb)) {
    if (await isTargetHealthy(target)) {
      runtimeState.targets.set(target.name, {
        target,
        owner: 'external',
        restartCount: 0,
        startedAt: new Date().toISOString(),
        lastExitAt: null,
        lastExitCode: null,
        lastExitSignal: null,
        child: null,
        restartTimer: null,
        ...buildArtifactsPaths(runtimeState.options.artifactsDir, target.logPrefix),
      });
      flushManifest(runtimeState);
      continue;
    }

    startTarget(target, runtimeState);
  }

  flushManifest(runtimeState);

  await new Promise(() => {});
}

async function statusCommand(options) {
  const manifest = readManifest(options.manifestPath);
  if (!manifest) {
    console.log('Dev stack is not running.');
    const stderrPath = buildArtifactsPaths(
      options.artifactsDir,
      'dev-stack-supervisor',
    ).stderrPath;
    const logTail = readLogTail(stderrPath, 1600);
    if (logTail) {
      console.log('');
      console.log(`Last bootstrap error: ${stderrPath}`);
      console.log(logTail);
    }
    return;
  }

  const supervisorRunning = processExists(Number(manifest.supervisor?.pid));
  console.log(`Supervisor: ${supervisorRunning ? 'running' : 'stale'} pid=${manifest.supervisor?.pid ?? 'unknown'}`);
  console.log(`Manifest: ${options.manifestPath}`);

  if ((manifest.processes ?? []).length === 0) {
    console.log('- bootstrap: no managed targets registered yet');
  }

  for (const record of manifest.processes ?? []) {
    const owner = record.owner === 'external' ? 'external' : 'managed';
    const alive = owner === 'managed'
      ? processExists(Number(record.pid))
      : false;
    const reachable = record.health_url
      ? await testUrlReachability(record.health_url)
      : false;

    const statusBits = [
      `owner=${owner}`,
      `pid=${record.pid ?? 'none'}`,
      owner === 'managed' ? `alive=${alive ? 'yes' : 'no'}` : null,
      `reachable=${reachable ? 'yes' : 'no'}`,
      `restarts=${record.restart_count ?? 0}`,
    ].filter(Boolean);

    console.log(`- ${record.target}: ${statusBits.join(' ')}`);
  }
}

function stopCommand(options) {
  const manifest = readManifest(options.manifestPath);
  const supervisorPid = Number(manifest?.supervisor?.pid);

  if (!processExists(supervisorPid)) {
    removeManifest(options.manifestPath);
    console.log('Dev stack is not running.');
    return;
  }

  const stopped = killProcessTree(supervisorPid);
  if (stopped) {
    removeManifest(options.manifestPath);
  }

  console.log(stopped ? 'Dev stack stopped.' : 'Unable to stop dev stack.');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(parsed.workspaceRoot);
  const artifactsDir = path.join(workspaceRoot, '.artifacts');
  const manifestPath = path.join(artifactsDir, 'dev-stack-manifest.json');
  const options = {
    ...parsed,
    workspaceRoot,
    artifactsDir,
    manifestPath,
  };

  if (parsed.command === 'start') {
    await startCommand(options);
    return;
  }

  if (parsed.command === 'run') {
    await runCommand(options);
    return;
  }

  if (parsed.command === 'status') {
    await statusCommand(options);
    return;
  }

  stopCommand(options);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
