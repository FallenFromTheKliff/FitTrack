import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

const REMOTE_RESET_CONFIRMATION = 'RESET_RAILWAY_DATABASE';
const DYNAMIC_SEED_CONFIRMATION = 'RESET_REMOTE_DYNAMIC_SEED';
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_SEED_USERS = 100;

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

function fail(message) {
  console.error(`\n[railway-deploy] ${message}`);
  process.exit(1);
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

function run(command, args, { allowFailure = false } = {}) {
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
      stdio: 'inherit',
      shell: false,
    },
  );

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

  return status;
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
}

const deployMessage = `FitTrack CLI deploy ${new Date().toISOString()}`;
const shouldDeploy =
  !hasFlag('skip-api') || !hasFlag('skip-ai') || !hasFlag('skip-web');
const deploymentSource = shouldDeploy ? createDeploymentSnapshot() : undefined;

if (!hasFlag('skip-api')) {
  run('railway', [
    'up',
    deploymentSource,
    '--path-as-root',
    '--service',
    'api',
    '--environment',
    environment,
    '--ci',
    '--message',
    deployMessage,
  ]);
}

if (!hasFlag('skip-ai')) {
  run('railway', [
    'up',
    deploymentSource,
    '--path-as-root',
    '--service',
    'ai',
    '--environment',
    environment,
    '--ci',
    '--message',
    deployMessage,
  ]);
}

if (!hasFlag('skip-web')) {
  run('railway', [
    'up',
    deploymentSource,
    '--path-as-root',
    '--service',
    'web',
    '--environment',
    environment,
    '--ci',
    '--message',
    deployMessage,
  ]);
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
