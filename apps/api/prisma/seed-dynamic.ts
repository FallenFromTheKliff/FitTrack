import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { bootstrapDefaults } from './defaults';
import { getDatabaseUrl, parseDynamicSeedConfig } from './dynamic-seed/config';
import {
  buildModelCounts,
  writeDynamicSeedManifest,
} from './dynamic-seed/manifest';
import { SeedRandom } from './dynamic-seed/random';
import { resetDatabaseForDynamicSeed } from './dynamic-seed/reset';
import {
  createInitialSeedState,
  type DynamicSeedContext,
  type SeedDomainResult,
} from './dynamic-seed/types';
import { seedAiGymAnalytics } from './dynamic-seed/domains/ai-gym-analytics';
import { seedFacilitiesCoaching } from './dynamic-seed/domains/facilities-coaching';
import { seedFitnessGamification } from './dynamic-seed/domains/fitness-gamification';
import { seedMembershipPayments } from './dynamic-seed/domains/membership-payments';
import { seedNutritionInventory } from './dynamic-seed/domains/nutrition-inventory';
import { seedUsersAuthProfiles } from './dynamic-seed/domains/users-auth-profiles';

const config = parseDynamicSeedConfig();
const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function runDomain(
  label: string,
  fn: (ctx: DynamicSeedContext) => Promise<SeedDomainResult | void>,
  ctx: DynamicSeedContext,
) {
  const startedAt = Date.now();
  const result = await fn(ctx);
  const elapsedMs = Date.now() - startedAt;
  console.log(`[dynamic-seed] ${label} complete in ${elapsedMs}ms`);

  if (result && result.notableIds) {
    Object.assign(ctx.notableIds, result.notableIds);
  }

  return result;
}

async function main() {
  console.log(
    `[dynamic-seed] target=${config.target} mode=${config.mode} users=${config.users} seed=${config.seed}`,
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
  await bootstrapDefaults(prisma, { includeUsers: false });
  await runDomain('membership-payments', seedMembershipPayments, ctx);
  await runDomain('facilities-coaching', seedFacilitiesCoaching, ctx);
  await runDomain('fitness-gamification', seedFitnessGamification, ctx);
  await runDomain('nutrition-inventory', seedNutritionInventory, ctx);
  await runDomain('ai-gym-analytics', seedAiGymAnalytics, ctx);

  const counts = await buildModelCounts(prisma);
  const manifest = await writeDynamicSeedManifest({
    config,
    counts,
    credentials: ctx.state.demoCredentials,
    notableIds: ctx.notableIds,
  });

  console.log('[dynamic-seed] complete');
  console.log(`[dynamic-seed] manifest written to ${manifest.manifestPath}`);
  console.log(
    `[dynamic-seed] demo credentials: ${ctx.state.demoCredentials
      .map((credential) => `${credential.email} / ${credential.password}`)
      .join(', ')}`,
  );
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
