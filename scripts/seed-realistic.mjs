import { spawnSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const forwardedArgs = [];
let positionalUsers;

for (const arg of rawArgs) {
  if (!arg.startsWith('-') && /^\d+$/.test(arg) && !positionalUsers) {
    positionalUsers = arg;
    continue;
  }
  forwardedArgs.push(arg);
}

if (positionalUsers && !forwardedArgs.some((arg) => arg.startsWith('--users'))) {
  forwardedArgs.unshift(`--users=${positionalUsers}`);
}

if (!forwardedArgs.some((arg) => arg.startsWith('--mode'))) {
  forwardedArgs.unshift('--mode=reset');
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const modeArg = forwardedArgs.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.slice('--mode='.length) ?? 'reset';

if (mode === 'reset') {
  const migrationArgs = [
    '--filter',
    '@fittrack/api',
    'exec',
    'npx',
    'prisma',
    'migrate',
    'deploy',
    '--schema=prisma/schema.prisma',
  ];
  console.log(`[seed:realistic] pnpm ${migrationArgs.join(' ')}`);
  const migrationResult = spawnSync(pnpmCommand, migrationArgs, {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (migrationResult.error) {
    throw migrationResult.error;
  }

  if ((migrationResult.status ?? 1) !== 0) {
    process.exitCode = migrationResult.status ?? 1;
    process.exit();
  }
}

const seedArgs = [
  '--filter',
  '@fittrack/api',
  'exec',
  'node',
  '-r',
  'ts-node/register',
  'prisma/seed-dynamic.ts',
  ...forwardedArgs,
];

console.log(`[seed:realistic] pnpm ${seedArgs.join(' ')}`);

const result = spawnSync(pnpmCommand, seedArgs, {
  cwd: process.cwd(),
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
