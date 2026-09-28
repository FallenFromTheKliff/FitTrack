import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { minimumUsersForPreservedTesters } from './accounts';
import type { DynamicSeedConfig } from './types';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  UserRole,
} from '@prisma/client';

export const PRESERVED_TESTER_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'icloud.com',
  'me.com',
  'mac.com',
] as const;

export const PRESERVED_TESTER_DEFAULT_PATH = resolve(
  __dirname,
  '../../../..',
  'scripts/seed-data/preserved-testers.private.json',
);

const ROOT_KEYS = ['schemaVersion', 'exportedAt', 'source', 'users'] as const;
const SOURCE_KEYS = ['projectId', 'environmentId', 'serviceId'] as const;
const USER_KEYS = ['email', 'role', 'profile'] as const;
const PROFILE_KEYS = [
  'first_name',
  'last_name',
  'phone',
  'date_of_birth',
  'gender',
  'weight_kg',
  'height_cm',
  'activity_level',
  'fitness_goal',
  'avatar_url',
] as const;
const EXPECTED_PROJECT_ID = 'local-fittrack';
const EXPECTED_ENVIRONMENT_ID = 'local-development';
const EXPECTED_SERVICE_ID = 'local-api';
const SENSITIVE_KEYS = new Set([
  'password',
  'credential_hash',
  'qr_code_token',
  'refresh_token',
  'otp',
  'session_token',
  'access_token',
]);

type JsonRecord = Record<string, unknown>;

export type PreservedTesterProfile = {
  email: string;
  role: UserRole;
  profile: {
    first_name: string;
    last_name: string;
    phone: string | null;
    date_of_birth: Date | null;
    gender: Gender | null;
    weight_kg: number | null;
    height_cm: number | null;
    activity_level: ActivityLevel | null;
    fitness_goal: FitnessGoal | null;
    avatar_url: string | null;
  };
};

export type PreservedTesterSource = {
  schemaVersion: 1;
  exportedAt: string;
  source: {
    projectId: string;
    environmentId: string;
    serviceId: string;
  };
  users: PreservedTesterProfile[];
};

function fail(message: string): never {
  throw new Error(`[preserved-testers] ${message}`);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function assertExactKeys(value: JsonRecord, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) {
    fail(`${label} has unknown or missing fields`);
  }
}

function assertString(
  value: unknown,
  label: string,
  allowEmpty = false,
  maxLength = Number.POSITIVE_INFINITY,
): string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > maxLength
  ) {
    if (typeof value === 'string' && value.length > maxLength) {
      fail(`${label} exceeds maximum length`);
    }
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function assertNullableString(
  value: unknown,
  label: string,
  maxLength = Number.POSITIVE_INFINITY,
): string | null {
  if (value === null) return null;
  return assertString(value, label, true, maxLength);
}

function assertEnum<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail(`${label} has an invalid enum value`);
  }
  return value as T;
}

function assertDate(value: unknown, label: string): Date | null {
  if (value === null) return null;
  const text = assertString(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(text);
  if (!match) fail(`${label} must be YYYY-MM-DD or an ISO timestamp`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    fail(`${label} must be a valid calendar date`);
  }
  if (!text.includes('T')) return normalized;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) fail(`${label} must be a valid date`);
  return normalized;
}

function assertNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    fail(`${label} must be a positive finite number or null`);
  }
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${label} must be a positive finite number or null`);
  }
  return parsed;
}

function assertNoSensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) fail('sensitive field is not allowed');
    assertNoSensitiveKeys(child);
  }
}

function assertEmail(value: unknown, label: string): string {
  const email = assertString(value, label, false, 255).trim();
  const match = /^[^@\s]+@([^@\s]+)$/.exec(email);
  const domain = match?.[1]?.toLowerCase();
  if (!domain || !PRESERVED_TESTER_DOMAINS.includes(domain as (typeof PRESERVED_TESTER_DOMAINS)[number])) {
    fail(`${label} must use an accepted personal domain`);
  }
  return email;
}

function normalizeUser(value: unknown, index: number): PreservedTesterProfile {
  const user = asRecord(value, `users[${index}]`);
  assertExactKeys(user, USER_KEYS, `users[${index}]`);
  const profile = asRecord(user.profile, `users[${index}].profile`);
  assertExactKeys(profile, PROFILE_KEYS, `users[${index}].profile`);
  return {
    email: assertEmail(user.email, `users[${index}].email`),
    role: assertEnum(user.role, Object.values(UserRole), `users[${index}].role`),
    profile: {
      first_name: assertString(profile.first_name, `users[${index}].profile.first_name`, false, 100),
      last_name: assertString(profile.last_name, `users[${index}].profile.last_name`, false, 100),
      phone: assertNullableString(profile.phone, `users[${index}].profile.phone`, 20),
      date_of_birth: assertDate(profile.date_of_birth, `users[${index}].profile.date_of_birth`),
      gender: profile.gender === null
        ? null
        : assertEnum(profile.gender, Object.values(Gender), `users[${index}].profile.gender`),
      weight_kg: assertNumber(profile.weight_kg, `users[${index}].profile.weight_kg`),
      height_cm: assertNumber(profile.height_cm, `users[${index}].profile.height_cm`),
      activity_level: profile.activity_level === null
        ? null
        : assertEnum(profile.activity_level, Object.values(ActivityLevel), `users[${index}].profile.activity_level`),
      fitness_goal: profile.fitness_goal === null
        ? null
        : assertEnum(profile.fitness_goal, Object.values(FitnessGoal), `users[${index}].profile.fitness_goal`),
      avatar_url: assertNullableString(profile.avatar_url, `users[${index}].profile.avatar_url`, 500),
    },
  };
}

export function validatePreservedTesterSource(value: unknown): PreservedTesterSource {
  assertNoSensitiveKeys(value);
  const root = asRecord(value, 'preserved tester source');
  assertExactKeys(root, ROOT_KEYS, 'preserved tester source');
  if (root.schemaVersion !== 1) fail('schemaVersion must be 1');
  const exportedAt = assertString(root.exportedAt, 'exportedAt');
  if (!Number.isFinite(new Date(exportedAt).getTime())) fail('exportedAt must be a valid date');

  const source = asRecord(root.source, 'source');
  assertExactKeys(source, SOURCE_KEYS, 'source');
  if (source.projectId !== EXPECTED_PROJECT_ID
    || source.environmentId !== EXPECTED_ENVIRONMENT_ID
    || source.serviceId !== EXPECTED_SERVICE_ID) {
    fail('source target identifiers do not match the local FitTrack fixture');
  }

  if (!Array.isArray(root.users) || root.users.length === 0) fail('users must be a non-empty array');
  const users = root.users.map(normalizeUser);
  const emails = new Set<string>();
  for (const user of users) {
    const normalized = user.email.toLowerCase();
    if (emails.has(normalized)) fail('duplicate email');
    emails.add(normalized);
  }
  return {
    schemaVersion: 1,
    exportedAt,
    source: {
      projectId: String(source.projectId),
      environmentId: String(source.environmentId),
      serviceId: String(source.serviceId),
    },
    users,
  };
}

export function readPreservedTesterSource(path = PRESERVED_TESTER_DEFAULT_PATH): PreservedTesterSource {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error('[preserved-testers] preserved tester source is missing or unreadable');
  }
  if (text.trim().length === 0) fail('preserved tester source is empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('preserved tester source is not valid JSON');
  }
  return validatePreservedTesterSource(parsed);
}

export function loadPreservedTesterSource(
  env: NodeJS.ProcessEnv = process.env,
  defaultPath = PRESERVED_TESTER_DEFAULT_PATH,
): PreservedTesterSource | null {
  const explicitPath = env.FITTRACK_PRESERVED_TESTERS_PATH;
  if (explicitPath !== undefined) {
    if (!existsSync(explicitPath)) {
      throw new Error('[preserved-testers] FITTRACK_PRESERVED_TESTERS_PATH is missing');
    }
    return readPreservedTesterSource(explicitPath);
  }
  if (!existsSync(defaultPath)) return null;
  return readPreservedTesterSource(defaultPath);
}

export function loadPreservedTesterConfig(
  config: DynamicSeedConfig,
  env: NodeJS.ProcessEnv = process.env,
  defaultPath = PRESERVED_TESTER_DEFAULT_PATH,
) {
  const source = loadPreservedTesterSource(env, defaultPath);
  if (!source && config.realUserData) {
    fail('--real-user-data requires a preserved tester source');
  }
  config.users = minimumUsersForPreservedTesters(
    config.users,
    source?.users,
    config.extraUsers,
  );
  config.preservedTesterProfiles = source?.users;
  return source;
}
