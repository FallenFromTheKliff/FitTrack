import { UserRole } from '@prisma/client';
import { resolve } from 'node:path';
import { v5 as uuidv5 } from 'uuid';

export const TEST_DATA_NAMESPACE = 'e052f4b6-1be5-4705-a3ab-a98f444f6f0e';
export const TEST_DATA_MARKER = 'fittrack-test-data';
export const TEST_DATA_EMAIL_DOMAIN = 'fittrack.com';
export const TEST_DATA_MANIFEST_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '.artifacts',
  'test-data-manifest.json',
);

export type TestDataSeedMode = 'reset' | 'additive';

export type TestAccount = {
  email: string;
  firstName: string;
  key: string;
  label: string;
  lastName: string;
  password: string;
  phone: string;
  role: UserRole;
};

export const TEST_ACCOUNTS: readonly TestAccount[] = [
  {
    key: 'admin',
    label: 'Seed Admin',
    role: UserRole.admin,
    email: `seed.admin@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedAdmin!2026',
    firstName: 'Sera',
    lastName: 'Admin',
    phone: '+639110000001',
  },
  {
    key: 'staff',
    label: 'Seed Staff',
    role: UserRole.staff,
    email: `seed.staff@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedStaff!2026',
    firstName: 'Casey',
    lastName: 'Floor',
    phone: '+639110000002',
  },
  {
    key: 'coach',
    label: 'Seed Coach',
    role: UserRole.coach,
    email: `seed.coach@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedCoach!2026',
    firstName: 'Mia',
    lastName: 'Coach',
    phone: '+639110000003',
  },
  {
    key: 'member-active',
    label: 'Member Active',
    role: UserRole.member,
    email: `seed.member.active@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Ava',
    lastName: 'Rivera',
    phone: '+639110000005',
  },
  {
    key: 'member-premium',
    label: 'Member Premium',
    role: UserRole.member,
    email: `seed.member.premium@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Luca',
    lastName: 'Dela Cruz',
    phone: '+639110000006',
  },
  {
    key: 'member-frozen',
    label: 'Member Frozen',
    role: UserRole.member,
    email: `seed.member.frozen@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Rina',
    lastName: 'Torres',
    phone: '+639110000007',
  },
  {
    key: 'member-pending',
    label: 'Member Pending Payment',
    role: UserRole.member,
    email: `seed.member.pending@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Jules',
    lastName: 'Garcia',
    phone: '+639110000008',
  },
  {
    key: 'member-nomembership',
    label: 'Member No Membership',
    role: UserRole.member,
    email: `seed.member.nomembership@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Nia',
    lastName: 'Santos',
    phone: '+639110000010',
  },
  {
    key: 'member-expired',
    label: 'Member Expired',
    role: UserRole.member,
    email: `seed.member.expired@${TEST_DATA_EMAIL_DOMAIN}`,
    password: 'SeedMember!2026',
    firstName: 'Ivy',
    lastName: 'Navarro',
    phone: '+639110000009',
  },
] as const;

export type ManualTestPath = {
  area: string;
  credentialKey: string;
  expected: string;
  route: string;
};

export const MANUAL_TEST_PATHS: readonly ManualTestPath[] = [
  {
    area: 'web-members',
    credentialKey: 'admin',
    route: '/members',
    expected:
      'Review the seeded member roster, payment review queue, and frozen-account handling.',
  },
  {
    area: 'web-inventory',
    credentialKey: 'admin',
    route: '/inventory',
    expected:
      'Search seeded products, filter low-stock and out-of-stock rows, and inspect monthly sales buckets.',
  },
  {
    area: 'web-analytics',
    credentialKey: 'admin',
    route: '/analytics',
    expected:
      'Switch periods and confirm seeded revenue, attendance, membership, and coach metrics render.',
  },
  {
    area: 'web-member-profile-only',
    credentialKey: 'member-active',
    route: '/profile',
    expected:
      'Confirm the web shell authenticates the member and shows only Profile plus Sign Out in the sidebar.',
  },
  {
    area: 'web-coach-profile-only',
    credentialKey: 'coach',
    route: '/profile',
    expected:
      'Confirm the web shell authenticates the coach and shows only Profile plus Sign Out in the sidebar.',
  },
  {
    area: 'mobile-bookings',
    credentialKey: 'member-active',
    route: '/(tabs)/bookings',
    expected:
      'Test date filters and status filters against pending, confirmed, completed, cancelled, and no-show bookings.',
  },
  {
    area: 'mobile-nutrition',
    credentialKey: 'member-active',
    route: '/(tabs)/nutrition',
    expected:
      'Review the active macro target plus today, last-7-day, and last-30-day nutrition history.',
  },
  {
    area: 'mobile-workout',
    credentialKey: 'member-active',
    route: '/(tabs)/workout',
    expected:
      'Inspect seeded plans, workout session history, and pose-session-backed exercise logs.',
  },
  {
    area: 'mobile-chat-history',
    credentialKey: 'member-active',
    route: '/(tabs)/chathistory',
    expected:
      'Verify multiple AI sessions and message history buckets are available for fetch and pagination tests.',
  },
  {
    area: 'mobile-frozen-account',
    credentialKey: 'member-frozen',
    route: '/(tabs)/profile',
    expected:
      'Confirm frozen account restrictions appear because the seeded pending termination request stays pending.',
  },
  {
    area: 'mobile-profile-no-membership',
    credentialKey: 'member-nomembership',
    route: '/(tabs)/profile',
    expected:
      'Verify the non-member purchase and upsell states without an active membership card, subscription, or payment in flight.',
  },
];

export function seedId(key: string) {
  return uuidv5(`${TEST_DATA_MARKER}:${key}`, TEST_DATA_NAMESPACE);
}

export function getTestAccount(key: string) {
  return TEST_ACCOUNTS.find((account) => account.key === key);
}
