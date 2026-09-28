import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const ANNUAL_PLAN_ID = '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3004';
const MEMBERSHIP_PLAN_FEATURES = {
  perks: ['gym_access', 'attendance_tracking'],
} as const;

const CANONICAL_PLANS = [
  {
    aliases: [] as const,
    fallbackId: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3002',
    name: '1-Day Pass',
    description:
      'One gym visit with attendance check-in; consumed after the first successful entry. Coaching services are purchased separately.',
    durationDays: 1,
    price: '150',
    sortOrder: 0,
  },
  {
    aliases: ['Performance Monthly', 'Strength Monthly'] as const,
    fallbackId: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3000',
    name: 'Weekly Membership',
    description:
      'Seven consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 7,
    price: '499',
    sortOrder: 1,
  },
  {
    aliases: ['Starter Monthly'] as const,
    fallbackId: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3001',
    name: 'Monthly Membership',
    description:
      'Thirty consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 30,
    price: '1499',
    sortOrder: 2,
  },
  {
    aliases: ['Premium Coaching', 'Coaching Plus'] as const,
    fallbackId: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3003',
    name: '3-Month Membership',
    description:
      'Ninety consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 90,
    price: '3499',
    sortOrder: 3,
  },
  {
    aliases: ['Annual Membership'] as const,
    fallbackId: ANNUAL_PLAN_ID,
    name: '1-Year Membership',
    description:
      'Three hundred sixty-five consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 365,
    price: '11999',
    sortOrder: 4,
  },
] as const;

type CanonicalPlan = (typeof CANONICAL_PLANS)[number];

function parseMode(args: readonly string[]): 'apply' | 'check' {
  const normalizedArgs = args.filter((arg) => arg !== '--');
  if (
    normalizedArgs.length !== 1 ||
    (normalizedArgs[0] !== '--apply' && normalizedArgs[0] !== '--check')
  ) {
    throw new Error(
      'Usage: pnpm db:seed:membership-plans -- --check|--apply',
    );
  }
  return normalizedArgs[0].slice(2) as 'apply' | 'check';
}

function requireLocalDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL is required for membership plan reconciliation.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error(
      'Refusing membership plan reconciliation: DATABASE_URL must point to localhost, 127.0.0.1, or ::1.',
    );
  }

  return rawUrl;
}

function planData(plan: CanonicalPlan) {
  return {
    name: plan.name,
    description: plan.description,
    price: new Prisma.Decimal(plan.price),
    currency: 'PHP',
    duration_days: plan.durationDays,
    features: MEMBERSHIP_PLAN_FEATURES as unknown as Prisma.InputJsonValue,
    sort_order: plan.sortOrder,
    includes_coaching: false,
    is_active: true,
  };
}

async function findExistingPlan(
  tx: Prisma.TransactionClient,
  plan: CanonicalPlan,
) {
  const exact = await tx.membershipPlan.findFirst({
    where: { name: plan.name },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
  if (exact) return exact;

  for (const alias of plan.aliases) {
    const legacy = await tx.membershipPlan.findFirst({
      where: { name: alias },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    if (legacy) return legacy;
  }

  return null;
}

async function applyCanonicalPlans(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    const selectedIds: string[] = [];

    for (const plan of CANONICAL_PLANS) {
      const existing = await findExistingPlan(tx, plan);
      const id = existing?.id ?? plan.fallbackId;
      const data = planData(plan);

      if (existing) {
        await tx.membershipPlan.update({ where: { id }, data });
      } else {
        await tx.membershipPlan.create({
          data: { id, ...data },
        });
      }
      selectedIds.push(id);
    }

    const deactivated = await tx.membershipPlan.updateMany({
      where: {
        id: { notIn: selectedIds },
        is_active: true,
      },
      data: { is_active: false },
    });

    return { deactivatedCount: deactivated.count, selectedIds };
  });
}

function decimalValue(value: unknown) {
  return new Prisma.Decimal(String(value)).toFixed(2);
}

function jsonValue(value: unknown) {
  return JSON.stringify(value);
}

async function checkCanonicalPlans(prisma: PrismaClient) {
  const activePlans = await prisma.membershipPlan.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      duration_days: true,
      features: true,
      sort_order: true,
      includes_coaching: true,
      is_active: true,
    },
  });
  const mismatches: string[] = [];

  if (activePlans.length !== CANONICAL_PLANS.length) {
    mismatches.push(
      `expected ${CANONICAL_PLANS.length} active plans, found ${activePlans.length}`,
    );
  }

  for (const plan of CANONICAL_PLANS) {
    const matches = activePlans.filter((candidate) => candidate.name === plan.name);
    if (matches.length === 0) {
      mismatches.push(`missing active plan: ${plan.name}`);
      continue;
    }
    if (matches.length > 1) {
      mismatches.push(`duplicate active plan name: ${plan.name}`);
      continue;
    }

    const candidate = matches[0];
    const expected = planData(plan);
    if (candidate.description !== expected.description) {
      mismatches.push(`${plan.name}: description mismatch`);
    }
    if (decimalValue(candidate.price) !== decimalValue(expected.price)) {
      mismatches.push(`${plan.name}: price mismatch`);
    }
    if (candidate.currency !== expected.currency) {
      mismatches.push(`${plan.name}: currency mismatch`);
    }
    if (candidate.duration_days !== expected.duration_days) {
      mismatches.push(`${plan.name}: duration mismatch`);
    }
    if (jsonValue(candidate.features) !== jsonValue(expected.features)) {
      mismatches.push(`${plan.name}: features mismatch`);
    }
    if (candidate.sort_order !== expected.sort_order) {
      mismatches.push(`${plan.name}: sort order mismatch`);
    }
    if (candidate.includes_coaching !== false || candidate.is_active !== true) {
      mismatches.push(`${plan.name}: active/coaching flags mismatch`);
    }
  }

  const canonicalNames = new Set<string>(
    CANONICAL_PLANS.map((plan) => plan.name),
  );
  for (const plan of activePlans) {
    if (!canonicalNames.has(plan.name)) {
      mismatches.push(`unexpected active plan: ${plan.name}`);
    }
  }

  if (mismatches.length > 0) {
    console.error(
      `[membership-plans] check failed:\n- ${mismatches.join('\n- ')}`,
    );
    return false;
  }

  console.log(
    `[membership-plans] check passed: ${CANONICAL_PLANS.length} canonical active plans.`,
  );
  return true;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const databaseUrl = requireLocalDatabaseUrl();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    if (mode === 'check') {
      if (!(await checkCanonicalPlans(prisma))) {
        process.exitCode = 1;
      }
      return;
    }

    const result = await applyCanonicalPlans(prisma);
    console.log(
      `[membership-plans] applied ${CANONICAL_PLANS.length} canonical plans; deactivated ${result.deactivatedCount} noncanonical active plans.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    `[membership-plans] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
