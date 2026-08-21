import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { bootstrapDefaults } from './defaults';
import { getDatabaseUrl, parseDynamicSeedConfig } from './dynamic-seed/config';
import {
  buildSeedAccounts,
  populateAccountState,
} from './dynamic-seed/accounts';
import {
  runSeedIntegrityAudit,
  SeedIntegrityError,
} from './dynamic-seed/integrity';
import {
  buildModelCounts,
  invalidateDynamicSeedManifest,
  writeDynamicSeedManifest,
} from './dynamic-seed/manifest';
import type { DynamicSeedIntegritySummary } from './dynamic-seed/manifest';
import { SeedRandom } from './dynamic-seed/random';
import {
  assertLocalDatabaseAllowed,
  resetDatabaseForDynamicSeed,
} from './dynamic-seed/reset';
import {
  createInitialSeedState,
  type DynamicSeedContext,
  type SeedDomainResult,
} from './dynamic-seed/types';
import { seedAiGymAnalytics } from './dynamic-seed/domains/ai-gym-analytics';
import {
  repairSeededCoachingBilling,
  seedFacilitiesCoaching,
} from './dynamic-seed/domains/facilities-coaching';
import {
  reconcileSeedGamification,
  seedFitnessGamification,
} from './dynamic-seed/domains/fitness-gamification';
import { seedMembershipPayments } from './dynamic-seed/domains/membership-payments';
import {
  seedBodyNutrition,
  seedNutritionInventory,
} from './dynamic-seed/domains/nutrition-inventory';
import { seedUsersAuthProfiles } from './dynamic-seed/domains/users-auth-profiles';
import { reconcileCoachingContracts } from './dynamic-seed/reconcile';

const config = parseDynamicSeedConfig();
const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function runDomain<T extends SeedDomainResult | void>(
  label: string,
  fn: (ctx: DynamicSeedContext) => Promise<T>,
  ctx: DynamicSeedContext,
): Promise<T> {
  const startedAt = Date.now();
  const result = await fn(ctx);
  const elapsedMs = Date.now() - startedAt;
  console.log(`[dynamic-seed] ${label} complete in ${elapsedMs}ms`);

  if (result && result.notableIds) {
    Object.assign(ctx.notableIds, result.notableIds);
  }

  return result;
}

async function runBodyNutritionScope() {
  const scopeStartedAt = Date.now();
  if (config.mode === 'reset') {
    throw new Error(
      '[dynamic-seed] body-nutrition scope is additive-only; omit --mode=reset to preserve unrelated rows.',
    );
  }
  if (config.target !== 'local') {
    throw new Error(
      '[dynamic-seed] body-nutrition scope is local-only; use --target=local.',
    );
  }
  assertLocalDatabaseAllowed();
  const state = createInitialSeedState();
  populateAccountState(state, buildSeedAccounts(config));
  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma,
    rng: new SeedRandom(config.seed),
    state,
  };

  console.log(
    `[dynamic-seed][body-nutrition] target=${config.target} mode=${config.mode} ` +
      `users=${config.users} seed=${config.seed}`,
  );
  await runDomain('body-nutrition', seedBodyNutrition, ctx);
  const integrity = await runSeedIntegrityAudit(ctx, {
    categories: ['body-nutrition'],
  });
  const [nutritionRows, tdeeRows, macroRows] = await Promise.all([
    prisma.nutritionLog.count(),
    prisma.tdeeProfile.count(),
    prisma.macroTarget.count(),
  ]);
  console.log(
    `[dynamic-seed][body-nutrition] PASS checks=${integrity.checks} ` +
      `nutrition=${nutritionRows} tdee=${tdeeRows} macros=${macroRows}`,
  );
  console.log(
    `[dynamic-seed][body-nutrition] elapsedMs=${Date.now() - scopeStartedAt}`,
  );
  console.log('BODY-NUTRITION VALIDATION PASSED');
}

async function runCoachingPaymentsScope() {
  const scopeStartedAt = Date.now();
  if (config.mode === 'reset') {
    throw new Error(
      '[dynamic-seed] coaching-payments scope is additive-only; omit --mode=reset to preserve unrelated rows.',
    );
  }
  if (config.target !== 'local') {
    throw new Error(
      '[dynamic-seed] coaching-payments scope is local-only; use --target=local.',
    );
  }
  assertLocalDatabaseAllowed();
  const state = createInitialSeedState();
  populateAccountState(state, buildSeedAccounts(config));
  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma,
    rng: new SeedRandom(config.seed),
    state,
  };

  console.log(
    `[dynamic-seed][coaching-payments] target=${config.target} mode=${config.mode} ` +
      `users=${config.users} seed=${config.seed}`,
  );
  const repair = await runDomain(
    'coaching-payment-cycle-repair',
    repairSeededCoachingBilling,
    ctx,
  );
  await runDomain(
    'coaching-contract-reconciliation',
    reconcileCoachingContracts,
    ctx,
  );
  const integrity = await runSeedIntegrityAudit(ctx, {
    categories: ['payment'],
  });
  const [appointmentRows, billingCycleRows, paymentRows] = await Promise.all([
    prisma.coachAppointment.count({
      where: { recurring_plan_id: { not: null } },
    }),
    prisma.recurringCoachingBillingCycle.count(),
    prisma.payment.count(),
  ]);
  console.log(
    `[dynamic-seed][coaching-payments] PASS checks=${integrity.checks} ` +
      `repairs=cycles:${repair?.counts?.billingCycles ?? 0}/payments:${
        repair?.counts?.payments ?? 0
      } ` +
      `appointments=${appointmentRows} billingCycles=${billingCycleRows} payments=${paymentRows}`,
  );
  console.log(
    `[dynamic-seed][coaching-payments] elapsedMs=${Date.now() - scopeStartedAt}`,
  );
  console.log('COACHING-PAYMENTS VALIDATION PASSED');
}

async function main() {
  if (config.scope === 'body-nutrition') {
    await runBodyNutritionScope();
    return;
  }
  if (config.scope === 'coaching-payments') {
    await runCoachingPaymentsScope();
    return;
  }
  const seedStartedAt = Date.now();
  await invalidateDynamicSeedManifest();
  console.log(
    [
      `[dynamic-seed] target=${config.target}`,
      `mode=${config.mode}`,
      `users=${config.users}`,
      `seed=${config.seed}`,
      `exerciseHistory=${config.exerciseHistory}`,
      `history=${config.historyStartDate.toISOString()}..${config.historyEndDate.toISOString()}`,
      `densities=session:${config.sessionDensity}/workout:${config.workoutDensity}/booking:${config.bookingDensity}`,
    ].join(' '),
  );

  await resetDatabaseForDynamicSeed(prisma, config);

  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma,
    rng: new SeedRandom(config.seed),
    state: createInitialSeedState(),
  };

  await runDomain('users-auth-profiles', seedUsersAuthProfiles, ctx);
  console.log(
    `[dynamic-seed] roleCounts=${JSON.stringify(ctx.state.roleCounts)} ` +
      `scenarioCounts=${JSON.stringify(ctx.state.scenarioCounts)}`,
  );
  await bootstrapDefaults(prisma, {
    ensureGamificationProfiles: false,
    includeUsers: false,
    referenceDate: config.anchorDate,
  });
  await runDomain('membership-payments', seedMembershipPayments, ctx);
  await runDomain('facilities-coaching', seedFacilitiesCoaching, ctx);
  await runDomain('fitness-gamification', seedFitnessGamification, ctx);
  await runDomain(
    'coaching-contract-reconciliation',
    reconcileCoachingContracts,
    ctx,
  );
  await runDomain(
    'fitness-gamification-reconciliation',
    reconcileSeedGamification,
    ctx,
  );
  await runDomain('nutrition-inventory', seedNutritionInventory, ctx);
  await runDomain('ai-gym-analytics', seedAiGymAnalytics, ctx);

  let integrity: DynamicSeedIntegritySummary;
  let counts: Record<string, number>;
  try {
    integrity = await runSeedIntegrityAudit(ctx);
  } catch (error) {
    if (!(error instanceof SeedIntegrityError)) {
      throw error;
    }
    counts = await buildModelCounts(prisma);
    await writeDynamicSeedManifest({
      config,
      counts,
      credentials: ctx.state.demoCredentials,
      integrity: error.outcome,
      notableIds: ctx.notableIds,
      roleCounts: ctx.state.roleCounts,
      scenarioCounts: ctx.state.scenarioCounts,
    });
    throw error;
  }
  console.log(
    `[dynamic-seed][integrity] PASS checks=${integrity.checks} ` +
      `categories=${Object.keys(integrity.summary).length}`,
  );
  counts = await buildModelCounts(prisma);
  console.log(
    `[dynamic-seed] summary users=${counts.user ?? 0} memberships=${counts.subscription ?? 0} ` +
      `bookings=${counts.amenityBooking ?? 0} coaching=${counts.coachAppointment ?? 0} ` +
      `workouts=${counts.workoutSession ?? 0} facilities=${counts.amenity ?? 0} ` +
      `payments=${counts.payment ?? 0} upcoming=${integrity.scenarioMatrix.has_upcoming} ` +
      `no_upcoming=${integrity.scenarioMatrix.no_upcoming} audit=PASS`,
  );
  const manifest = await writeDynamicSeedManifest({
    config,
    counts,
    credentials: ctx.state.demoCredentials,
    integrity,
    notableIds: ctx.notableIds,
    roleCounts: ctx.state.roleCounts,
    scenarioCounts: ctx.state.scenarioCounts,
  });

  console.log('[dynamic-seed] complete');
  console.log(`[dynamic-seed] elapsedMs=${Date.now() - seedStartedAt}`);
  console.log(`[dynamic-seed] manifest written to ${manifest.manifestPath}`);
  console.log(
    `[dynamic-seed] demo credentials: ${ctx.state.demoCredentials
      .map((credential) => `${credential.email} / ${credential.password}`)
      .join(', ')}`,
  );
  console.log(`[dynamic-seed] rowCounts=${JSON.stringify(counts)}`);
  console.log('SEED VALIDATION PASSED');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
