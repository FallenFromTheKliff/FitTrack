import { config as loadEnv } from 'dotenv';
import { localEnvFilePath } from '../../env-path';
import type {
  DynamicSeedConfig,
  DynamicSeedMode,
  DynamicSeedTarget,
} from './types';

loadEnv(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const DEFAULT_USERS = 100;
const DEFAULT_SEED = 20260523;
const DEFAULT_ANCHOR_DATE = '2026-05-23T09:00:00.000Z';
export const REMOTE_RESET_CONFIRMATION = 'RESET_REMOTE_DYNAMIC_SEED';

function getFlag(argv: readonly string[], name: string) {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function hasFlag(argv: readonly string[], name: string) {
  return argv.includes(`--${name}`);
}

function parseMode(value?: string): DynamicSeedMode {
  return value === 'reset' ? 'reset' : 'additive';
}

function parseTarget(value?: string): DynamicSeedTarget {
  return value === 'railway' ? 'railway' : 'local';
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseDynamicSeedConfig(
  argv: readonly string[] = process.argv,
): DynamicSeedConfig {
  const users = Math.max(
    11,
    parsePositiveInt(getFlag(argv, 'users'), DEFAULT_USERS),
  );
  const seed = parsePositiveInt(getFlag(argv, 'seed'), DEFAULT_SEED);
  const anchorDate = new Date(
    getFlag(argv, 'anchor-date') ?? DEFAULT_ANCHOR_DATE,
  );

  if (Number.isNaN(anchorDate.getTime())) {
    throw new Error('Invalid --anchor-date value. Use an ISO date string.');
  }

  return {
    allowRemoteReset: hasFlag(argv, 'allow-remote-reset'),
    anchorDate,
    confirmRemoteReset: getFlag(argv, 'confirm'),
    mode: parseMode(getFlag(argv, 'mode')),
    seed,
    target: parseTarget(getFlag(argv, 'target')),
    users,
  };
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required before running the dynamic seed.',
    );
  }
  return databaseUrl;
}
