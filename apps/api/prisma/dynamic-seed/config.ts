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
const DEFAULT_HISTORY_MONTHS = 12;
const DEFAULT_EXERCISE_HISTORY = 50;
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

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseRate(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

function parseDensity(value: string | undefined): 'low' | 'normal' | 'high' {
  return value === 'low' || value === 'high' ? value : 'normal';
}

function parseDateFlag(
  value: string | undefined,
  fallback: Date,
  flag: string,
) {
  const parsed = value ? new Date(value) : fallback;
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --${flag} value. Use an ISO date string.`);
  }
  return parsed;
}

function startOfUtcToday() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9),
  );
}

function monthsBefore(anchor: Date, months: number) {
  const target = new Date(anchor);
  target.setUTCMonth(target.getUTCMonth() - months);
  return target;
}

export function parseDynamicSeedConfig(
  argv: readonly string[] = process.argv,
): DynamicSeedConfig {
  const users = Math.max(
    11,
    parsePositiveInt(getFlag(argv, 'users'), DEFAULT_USERS),
  );
  const seed = parsePositiveInt(getFlag(argv, 'seed'), DEFAULT_SEED);
  const historyMonths = parsePositiveInt(
    getFlag(argv, 'history-months'),
    DEFAULT_HISTORY_MONTHS,
  );
  const anchorDate = parseDateFlag(
    getFlag(argv, 'anchor-date') ?? getFlag(argv, 'to'),
    startOfUtcToday(),
    'anchor-date',
  );
  const historyEndDate = parseDateFlag(getFlag(argv, 'to'), anchorDate, 'to');
  const historyStartDate = parseDateFlag(
    getFlag(argv, 'from'),
    monthsBefore(historyEndDate, historyMonths),
    'from',
  );

  if (historyStartDate > historyEndDate) {
    throw new Error('--from must be earlier than or equal to --to.');
  }

  const workoutDensity = parseDensity(getFlag(argv, 'workout-density'));
  const densityHistoryDefault =
    workoutDensity === 'low'
      ? Math.floor(DEFAULT_EXERCISE_HISTORY / 2)
      : workoutDensity === 'high'
        ? DEFAULT_EXERCISE_HISTORY * 2
        : DEFAULT_EXERCISE_HISTORY;
  const exerciseHistory = Math.min(
    5_000,
    parseNonNegativeInt(
      getFlag(argv, 'exercise-history') ?? getFlag(argv, 'exercise_history'),
      densityHistoryDefault,
    ),
  );

  return {
    allowRemoteReset: hasFlag(argv, 'allow-remote-reset'),
    anchorDate,
    bookingDensity: parseDensity(getFlag(argv, 'booking-density')),
    coachActiveRate: parseRate(getFlag(argv, 'coach-active-rate'), 0.35),
    coachFormerRate: parseRate(getFlag(argv, 'coach-former-rate'), 0.15),
    coachPausedRate: parseRate(getFlag(argv, 'coach-paused-rate'), 0.08),
    confirmRemoteReset: getFlag(argv, 'confirm'),
    exerciseHistory,
    historyEndDate,
    historyMonths,
    historyStartDate,
    mode: parseMode(getFlag(argv, 'mode')),
    pendingPaymentRate: parseRate(getFlag(argv, 'pending-payment-rate'), 0.12),
    seed,
    sessionDensity: parseDensity(getFlag(argv, 'session-density')),
    splitPresetsPerMember: Math.min(
      4,
      parsePositiveInt(getFlag(argv, 'split-presets-per-member'), 2),
    ),
    target: parseTarget(getFlag(argv, 'target')),
    users,
    workoutDensity,
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
