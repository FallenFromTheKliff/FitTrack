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

if (!forwardedArgs.some((arg) => arg.startsWith('--target'))) {
  forwardedArgs.unshift('--target=local');
}

if (!forwardedArgs.some((arg) => arg.startsWith('--mode'))) {
  forwardedArgs.unshift('--mode=reset');
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
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
