import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REMOTE_RESET_CONFIRMATION = 'RESET_RAILWAY_DATABASE';
const DYNAMIC_SEED_CONFIRMATION = 'RESET_REMOTE_DYNAMIC_SEED';
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_SEED_USERS = 100;
const DEFAULT_LINK_SERVICE = 'api';
const DEPLOYMENT_LIST_LIMIT = 100;
const DEPLOYMENT_STATUS_MAX_ATTEMPTS = 30;
const DEPLOYMENT_STATUS_INTERVAL_MS = 30_000;
const CAPTURED_COMMAND_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const PENDING_DEPLOYMENT_STATUSES = new Set([
  'BUILDING',
  'DEPLOYING',
  'INITIALIZING',
  'WAITING',
  'QUEUED',
]);
const DEPLOYMENT_ID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const argv = process.argv.slice(2).filter((arg) => arg !== '--');

function getOption(...names) {
  for (const name of names) {
    const prefixes = [`--${name}:`, `--${name}=`];
    const inline = argv.find((arg) =>
      prefixes.some((prefix) => arg.startsWith(prefix)),
    );

    if (inline) {
      const prefix = prefixes.find((candidate) => inline.startsWith(candidate));
      return inline.slice(prefix.length);
    }

    const index = argv.indexOf(`--${name}`);
    if (index >= 0) {
      return argv[index + 1];
    }
  }

  return undefined;
}

function hasFlag(...names) {
  return names.some((name) => argv.includes(`--${name}`));
}

function printHelp() {
  console.log(`
Deploy FitTrack's API, AI, and web services to an existing Railway project.

Usage:
  pnpm deploy:railway -- --project_name:<project-name> [options]

Required:
  --project_name:<name>       Existing Railway project name or ID

Options:
  --environment:<name>       Railway environment (default: production)
  --reauth                   Clear cached CLI credentials and log in again
  --browserless              Use Railway's device-code login flow
  --reset-db                 Reset and reseed Postgres after successful deploys
  --confirm:${REMOTE_RESET_CONFIRMATION}
                             Required together with --reset-db
  --seed-users:<count>       Dynamic seed user count (default: ${DEFAULT_SEED_USERS})
  --skip-schema              Do not apply the Prisma schema
  --skip-api                 Do not deploy the api service
  --skip-ai                  Do not deploy the ai service
  --skip-web                 Do not deploy the web service
  --check-cli                Verify Railway CLI resolution, then exit
  --check-snapshot           Verify the deployment source snapshot, then exit
  --help                     Show this help

Examples:
  pnpm deploy:railway -- --project_name:fittrack-full-system --reauth
  pnpm deploy:railway -- --project_name:fittrack-full-system --reset-db --confirm:${REMOTE_RESET_CONFIRMATION}
`);
}

export function isPostUploadGraphqlTimeout(output) {
  const text = String(output ?? '');
  const hasRailwayTransportMarker =
    /reqwest/i.test(text) || /backboard\.railway\.com\/graphql/i.test(text);
  const hasGraphqlMarker = /graphql/i.test(text);
  const hasTimeoutMarker =
    /(?:operation\s+timed\s+out|timed\s*out|timeout|timed_out)/i.test(text);
  const hasBuildLogStreamFailureMarker = /failed\s+to\s+(?:stream|retrieve)\s+(?:build\s+)?logs?/i.test(
    text,
  );

  return (
    (hasRailwayTransportMarker && hasGraphqlMarker && hasTimeoutMarker) ||
    hasBuildLogStreamFailureMarker
  );
}

export function parseDeploymentList(output) {
  const text = String(output ?? '').trim();
  if (!text) {
    throw new Error('Railway returned an empty deployment list.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Railway returned invalid deployment JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const deployments = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.deployments)
      ? parsed.deployments
      : Array.isArray(parsed?.data?.deployments)
        ? parsed.data.deployments
        : undefined;

  if (!deployments) {
    throw new Error('Railway deployment JSON did not contain a deployment array.');
  }

  return deployments.map((deployment) => {
    const value = deployment && typeof deployment === 'object' ? deployment : {};
    const id = value.id ?? value.deploymentId ?? value.deployment_id;
    const rawStatus = value.status ?? value.deploymentStatus;

    return {
      ...value,
      id: id === undefined || id === null ? undefined : String(id),
      status:
        rawStatus === undefined || rawStatus === null
          ? undefined
          : String(rawStatus).trim().toUpperCase(),
    };
  });
}

function extractDeploymentId(output) {
  const text = String(output ?? '');
  const buildLogsId = text.match(
    /Build Logs:\s*https?:\/\/[^\s]+[?&]id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (buildLogsId?.[1]) {
    return buildLogsId[1];
  }

  const labelledId = text.match(
    /(?:deployment[_\s-]*id|deploymentId)\s*[:=]\s*["']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (labelledId?.[1]) {
    return labelledId[1];
  }

  const ids = [...text.matchAll(DEPLOYMENT_ID_PATTERN)].map(([id]) => id);
  return ids.length === 1 ? ids[0] : undefined;
}

function deploymentMessage(deployment) {
  const values = [
    deployment?.message,
    deployment?.description,
    deployment?.meta?.message,
    deployment?.meta?.commitMessage,
    deployment?.meta?.deploymentMessage,
  ];

  return values.filter((value) => value !== undefined && value !== null).join(' ');
}

export function identifyUploadedDeployment({
  output,
  priorDeployments,
  currentDeployments,
  deployMessage,
}) {
  const outputId = extractDeploymentId(output);
  if (outputId) {
    return outputId;
  }

  if (!Array.isArray(priorDeployments) || !Array.isArray(currentDeployments)) {
    return undefined;
  }

  const priorIds = new Set(
    priorDeployments.map((deployment) => deployment?.id).filter(Boolean),
  );
  let candidates = currentDeployments.filter(
    (deployment) => deployment?.id && !priorIds.has(deployment.id),
  );

  if (deployMessage) {
    const messageMatches = candidates.filter((deployment) =>
      deploymentMessage(deployment).includes(deployMessage),
    );
    return messageMatches.length === 1 ? messageMatches[0].id : undefined;
  }

  return candidates.length === 1 ? candidates[0].id : undefined;
}

export function classifyDeploymentStatus(status) {
  const normalized = String(status ?? '').trim().toUpperCase();
  if (normalized === 'SUCCESS') {
    return 'success';
  }
  if (normalized === 'FAILED' || normalized === 'CRASHED') {
    return 'failure';
  }
  if (PENDING_DEPLOYMENT_STATUSES.has(normalized)) {
    return 'pending';
  }
  return 'unknown';
}

function fail(message) {
  console.error(`\n[railway-deploy] ${message}`);
  process.exit(1);
}

function restoreTerminalTitle() {
  if (process.platform === 'win32') {
    process.title = 'FitTrack Railway Deploy';
  }
}

let railwayInvocation;
let deploymentSnapshot;

const DEPLOYMENT_ROOT_FILES = [
  '.dockerignore',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.railwayignore',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'turbo.json',
];

const DEPLOYMENT_DIRECTORIES = [
  'apps/api',
  'apps/web',
  'packages',
  'patches',
];

const EXCLUDED_DEPLOYMENT_NAMES = new Set([
  '.artifacts',
  '.git',
  '.next',
  '.next-dev',
  '.next-runtime',
  '.pytest_cache',
  '.turbo',
  '.uv-cache',
  '.uv-python',
  '.uv-runtime',
  '.venv',
  '__pycache__',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'playwright-report',
  'test-results',
]);

function isExcludedDeploymentEntry(name) {
  const lowerName = name.toLowerCase();
  return (
    EXCLUDED_DEPLOYMENT_NAMES.has(name) ||
    lowerName === '.env' ||
    lowerName.startsWith('.env.') ||
    lowerName.endsWith('.log') ||
    lowerName.endsWith('.pem') ||
    lowerName.endsWith('.key')
  );
}

function copyDeploymentDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (isExcludedDeploymentEntry(entry.name)) {
      continue;
    }

    const sourceEntry = path.join(source, entry.name);
    const destinationEntry = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDeploymentDirectory(sourceEntry, destinationEntry);
    } else if (entry.isFile()) {
      copyFileSync(sourceEntry, destinationEntry);
    }
  }
}

function cleanupDeploymentSnapshot() {
  if (!deploymentSnapshot || !existsSync(deploymentSnapshot)) {
    return;
  }

  const workspace = path.resolve(process.cwd());
  const snapshot = path.resolve(deploymentSnapshot);
  const snapshotRoot = path.join(workspace, '.railway-upload');
  if (!snapshot.startsWith(`${snapshotRoot}${path.sep}`)) {
    console.error(`[railway-deploy] Refusing to clean unexpected path: ${snapshot}`);
    return;
  }

  rmSync(snapshot, { force: true, recursive: true });
  console.log('\n[railway-deploy] Removed temporary source snapshot.');
}

process.on('exit', cleanupDeploymentSnapshot);

function createDeploymentSnapshot() {
  const workspace = path.resolve(process.cwd());
  const snapshot = path.join(
    workspace,
    '.railway-upload',
    `cli-source-${process.pid}`,
  );
  mkdirSync(snapshot, { recursive: true });
  deploymentSnapshot = snapshot;

  for (const relativePath of DEPLOYMENT_ROOT_FILES) {
    const source = path.join(workspace, relativePath);
    if (existsSync(source)) {
      const destination = path.join(snapshot, relativePath);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    }
  }

  for (const relativePath of DEPLOYMENT_DIRECTORIES) {
    copyDeploymentDirectory(
      path.join(workspace, relativePath),
      path.join(snapshot, relativePath),
    );
  }

  const aiRoot = path.join(workspace, 'apps', 'ai-microservice');
  const aiSnapshot = path.join(snapshot, 'apps', 'ai-microservice');
  for (const relativePath of [
    'Dockerfile',
    'pyproject.toml',
    'railway.toml',
    'uv.lock',
  ]) {
    const source = path.join(aiRoot, relativePath);
    if (existsSync(source)) {
      const destination = path.join(aiSnapshot, relativePath);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    }
  }
  copyDeploymentDirectory(
    path.join(aiRoot, 'app'),
    path.join(aiSnapshot, 'app'),
  );

  const prismaLinkTask = path.join(
    workspace,
    'tasks',
    'ensure-prisma-client-link.mjs',
  );
  const prismaLinkDestination = path.join(
    snapshot,
    'tasks',
    'ensure-prisma-client-link.mjs',
  );
  mkdirSync(path.dirname(prismaLinkDestination), { recursive: true });
  copyFileSync(prismaLinkTask, prismaLinkDestination);

  console.log('\n[railway-deploy] Prepared allowlisted source snapshot.');
  return snapshot;
}

function resolveRailwayInvocation() {
  if (railwayInvocation) {
    return railwayInvocation;
  }

  if (process.platform !== 'win32') {
    railwayInvocation = { command: 'railway', prefixArgs: [] };
    return railwayInvocation;
  }

  const searchDirectories = [
    ...(process.env.PATH ?? '').split(path.delimiter),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : undefined,
  ].filter(Boolean);
  const executable = searchDirectories
    .map((directory) => path.join(directory, 'railway.exe'))
    .find((candidate) => existsSync(candidate));

  if (executable) {
    railwayInvocation = { command: executable, prefixArgs: [] };
    return railwayInvocation;
  }

  const commandShim = searchDirectories
    .map((directory) => path.join(directory, 'railway.cmd'))
    .find((candidate) => existsSync(candidate));
  if (commandShim) {
    const cliEntry = path.join(
      path.dirname(commandShim),
      'node_modules',
      '@railway',
      'cli',
      'bin',
      'railway.js',
    );

    if (existsSync(cliEntry)) {
      railwayInvocation = {
        command: process.execPath,
        prefixArgs: [cliEntry],
      };
      return railwayInvocation;
    }
  }

  fail(
    'Could not resolve the Railway CLI executable. Install it with ' +
      '`npm install --global @railway/cli`, open a new terminal, and rerun this command.',
  );
}

function run(
  command,
  args,
  {
    allowFailure = false,
    captureOutput = false,
    echoCapturedOutput = true,
  } = {},
) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const invocation =
    command === 'railway'
      ? resolveRailwayInvocation()
      : { command, prefixArgs: [] };
  const result = spawnSync(
    invocation.command,
    [...invocation.prefixArgs, ...args],
    {
      cwd: process.cwd(),
      encoding: captureOutput ? 'utf8' : undefined,
      maxBuffer: captureOutput ? CAPTURED_COMMAND_MAX_BUFFER_BYTES : undefined,
      stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    },
  );

  const stdout = captureOutput ? String(result.stdout ?? '') : '';
  const stderr = captureOutput ? String(result.stderr ?? '') : '';
  if (captureOutput && echoCapturedOutput) {
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
  }

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail(
        `Could not find ${command}. Install or update the Railway CLI with ` +
          '`npm install --global @railway/cli`, then rerun this command.',
      );
    }
    throw result.error;
  }

  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) {
    fail(`Command failed with exit code ${status}. Deployment stopped.`);
  }

  return captureOutput ? { status, stdout, stderr } : status;
}

function appendBoundedOutput(current, chunk) {
  const next = current + String(chunk);
  if (next.length <= CAPTURED_COMMAND_MAX_BUFFER_BYTES) {
    return next;
  }

  const half = Math.floor(CAPTURED_COMMAND_MAX_BUFFER_BYTES / 2);
  return `${next.slice(0, half)}\n[railway-deploy] captured output truncated\n${next.slice(-half)}`;
}

function runStreamingCaptured(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const invocation =
    command === 'railway'
      ? resolveRailwayInvocation()
      : { command, prefixArgs: [] };

  return new Promise((resolve, reject) => {
    const child = spawn(
      invocation.command,
      [...invocation.prefixArgs, ...args],
      {
        cwd: process.cwd(),
        shell: false,
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      stdout = appendBoundedOutput(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      stderr = appendBoundedOutput(stderr, chunk);
    });
    child.on('error', reject);
    child.on('close', (status) => {
      restoreTerminalTitle();
      resolve({ status: status ?? 1, stdout, stderr });
    });
  });
}

function deploymentListArgs(service, environment) {
  return [
    'deployment',
    'list',
    '--service',
    service,
    '--environment',
    environment,
    '--limit',
    `${DEPLOYMENT_LIST_LIMIT}`,
    '--json',
  ];
}

function queryDeployments(service, environment) {
  const result = run(
    'railway',
    deploymentListArgs(service, environment),
    {
      allowFailure: true,
      captureOutput: true,
      echoCapturedOutput: false,
    },
  );

  if (result.status !== 0) {
    return {
      deployments: undefined,
      error: `deployment list exited with code ${result.status}`,
    };
  }

  try {
    return { deployments: parseDeploymentList(result.stdout) };
  } catch (error) {
    return {
      deployments: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function requireDeployments(service, environment, reason) {
  const result = queryDeployments(service, environment);
  if (result.error) {
    fail(
      `Could not inspect ${service} deployment after ${reason}: ${result.error}. ` +
        'The uploaded deployment identity could not be verified.',
    );
  }
  return result.deployments;
}

function sleep(milliseconds) {
  if (milliseconds <= 0) {
    return;
  }

  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, milliseconds);
}

function waitForDeploymentSuccess({
  service,
  environment,
  deploymentId,
  initialDeployments,
}) {
  let lastStatus;

  for (let attempt = 1; attempt <= DEPLOYMENT_STATUS_MAX_ATTEMPTS; attempt += 1) {
    const deployments =
      attempt === 1
        ? initialDeployments
        : requireDeployments(service, environment, `status check ${attempt}`);
    const deployment = deployments.find((candidate) => candidate.id === deploymentId);
    if (!deployment) {
      if (attempt === DEPLOYMENT_STATUS_MAX_ATTEMPTS) {
        fail(
          `Deployment ${deploymentId} for ${service} was not present after ` +
            `${DEPLOYMENT_STATUS_MAX_ATTEMPTS} bounded status checks.`,
        );
      }
      sleep(DEPLOYMENT_STATUS_INTERVAL_MS);
      continue;
    }

    lastStatus = deployment.status;
    const outcome = classifyDeploymentStatus(lastStatus);
    if (outcome === 'success') {
      console.log(
        `[railway-deploy] Recovered ${service} deployment ${deploymentId}: SUCCESS.`,
      );
      return;
    }

    if (outcome === 'failure') {
      fail(
        `Deployment ${deploymentId} for ${service} reached ${lastStatus}; ` +
          'the Railway up failure was not recovered.',
      );
    }

    if (outcome === 'unknown') {
      fail(
        `Deployment ${deploymentId} for ${service} reported unknown status ` +
          `"${lastStatus ?? 'missing'}"; deployment stopped.`,
      );
    }

    if (attempt < DEPLOYMENT_STATUS_MAX_ATTEMPTS) {
      console.log(
        `[railway-deploy] ${service} deployment ${deploymentId} is ${lastStatus}; ` +
          `waiting for status (${attempt}/${DEPLOYMENT_STATUS_MAX_ATTEMPTS}).`,
      );
      sleep(DEPLOYMENT_STATUS_INTERVAL_MS);
    }
  }

  fail(
    `Deployment ${deploymentId} for ${service} did not reach SUCCESS after ` +
      `${DEPLOYMENT_STATUS_MAX_ATTEMPTS} bounded status checks; last status ` +
      `was ${lastStatus ?? 'missing'}.`,
  );
}

async function deployService({
  service,
  environment,
  deploymentSource,
  deployMessage,
}) {
  const priorLookup = queryDeployments(service, environment);
  const upResult = await runStreamingCaptured(
    'railway',
    [
      'up',
      deploymentSource,
      '--path-as-root',
      '--service',
      service,
      '--environment',
      environment,
      '--ci',
      '--message',
      deployMessage,
    ],
  );

  if (upResult.status === 0) {
    return;
  }

  const output = `${upResult.stdout}\n${upResult.stderr}`;
  if (!isPostUploadGraphqlTimeout(output)) {
    fail(
      `Railway up for ${service} failed with exit code ${upResult.status}; ` +
        'the failure was not the bounded post-upload recovery case. ' +
        'Deployment stopped.',
    );
  }

  console.log(
    `[railway-deploy] Railway up for ${service} reported a post-upload connectivity ` +
      'issue; verifying the uploaded deployment before continuing.',
  );
  const currentDeployments = requireDeployments(
    service,
    environment,
    'post-upload timeout recovery',
  );
  const deploymentId = identifyUploadedDeployment({
    output,
    priorDeployments: priorLookup.deployments,
    currentDeployments,
    deployMessage,
  });

  if (!deploymentId) {
    fail(
      `Could not identify the uploaded ${service} deployment after the post-upload ` +
        'GraphQL timeout; deployment stopped.',
    );
  }

  waitForDeploymentSuccess({
    service,
    environment,
    deploymentId,
    initialDeployments: currentDeployments,
  });
}

function authenticate({ browserless, reauth }) {
  const tokenAuth = Boolean(
    process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN,
  );

  if (reauth && tokenAuth) {
    fail(
      '--reauth cannot replace credentials while RAILWAY_TOKEN or ' +
        'RAILWAY_API_TOKEN is set. Remove it from this terminal first, or omit --reauth.',
    );
  }

  if (reauth) {
    run('railway', ['logout'], { allowFailure: true });
  }

  const authenticated = run('railway', ['whoami'], { allowFailure: true }) === 0;
  if (!authenticated) {
    run('railway', ['login', ...(browserless ? ['--browserless'] : [])]);
  }

  run('railway', ['whoami']);
}

async function main() {
  restoreTerminalTitle();
  if (hasFlag('help', 'h')) {
    printHelp();
    process.exit(0);
  }

  if (hasFlag('check-cli')) {
    run('railway', ['--version']);
    console.log('\n[railway-deploy] Railway CLI resolution succeeded.');
    process.exit(0);
  }

  if (hasFlag('check-snapshot')) {
    createDeploymentSnapshot();
    console.log('\n[railway-deploy] Deployment snapshot validation succeeded.');
    process.exit(0);
  }

  const projectName = getOption('project_name', 'project-name', 'project');
  const environment =
    getOption('environment', 'environment_name', 'environment-name') ??
    DEFAULT_ENVIRONMENT;
  const seedUsersValue = getOption('seed-users', 'seed_users');
  const seedUsers = Number.parseInt(seedUsersValue ?? `${DEFAULT_SEED_USERS}`, 10);
  const resetDatabase = hasFlag('reset-db', 'reset_db');
  const confirmation = getOption('confirm');

  if (!projectName) {
    printHelp();
    fail('--project_name:<project-name> is required.');
  }

  if (!Number.isSafeInteger(seedUsers) || seedUsers < 11 || seedUsers > 10_000) {
    fail('--seed-users must be an integer from 11 to 10000.');
  }

  if (resetDatabase && confirmation !== REMOTE_RESET_CONFIRMATION) {
    fail(
      `Destructive reset requires --confirm:${REMOTE_RESET_CONFIRMATION}.`,
    );
  }

  console.log(
    `[railway-deploy] project=${projectName} environment=${environment} ` +
      `resetDb=${resetDatabase ? 'yes' : 'no'}`,
  );

  run('railway', ['--version']);
  authenticate({
    browserless: hasFlag('browserless'),
    reauth: hasFlag('reauth'),
  });

  run('railway', [
    'link',
    '--project',
    projectName,
    '--environment',
    environment,
    '--service',
    DEFAULT_LINK_SERVICE,
  ]);
  run('railway', ['status']);

  if (!hasFlag('skip-schema')) {
    run('railway', [
      'run',
      '--service',
      'Postgres',
      '--environment',
      environment,
      '--no-local',
      'node',
      'tasks/run-with-railway-public-database.mjs',
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      'db:push',
    ]);
    restoreTerminalTitle();
  }

  const deployMessage = `FitTrack CLI deploy ${new Date().toISOString()}`;
  const shouldDeploy =
    !hasFlag('skip-api') || !hasFlag('skip-ai') || !hasFlag('skip-web');
  const deploymentSource = shouldDeploy ? createDeploymentSnapshot() : undefined;

  if (!hasFlag('skip-api')) {
    await deployService({
      service: 'api',
      environment,
      deploymentSource,
      deployMessage,
    });
  }

  if (!hasFlag('skip-ai')) {
    await deployService({
      service: 'ai',
      environment,
      deploymentSource,
      deployMessage,
    });
  }

  if (!hasFlag('skip-web')) {
    await deployService({
      service: 'web',
      environment,
      deploymentSource,
      deployMessage,
    });
  }

  if (resetDatabase) {
    run('railway', [
      'run',
      '--service',
      'Postgres',
      '--environment',
      environment,
      '--no-local',
      'node',
      'tasks/run-with-railway-public-database.mjs',
      'node',
      'tasks/seed-realistic.mjs',
      '--target=railway',
      '--mode=reset',
      `--users=${seedUsers}`,
      '--allow-remote-reset',
      `--confirm=${DYNAMIC_SEED_CONFIRMATION}`,
    ]);
  }

  console.log('\n[railway-deploy] Completed successfully.');
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `\n[railway-deploy] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
