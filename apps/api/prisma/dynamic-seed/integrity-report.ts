import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { buildSeedAccounts, populateAccountState } from './accounts';
import { buildModelCounts, readCurrentDynamicSeedManifest } from './manifest';
import { getDatabaseUrl, parseDynamicSeedConfig } from './config';
import { runSeedIntegrityAudit } from './integrity';
import { SeedRandom } from './random';
import { createInitialSeedState, type DynamicSeedContext } from './types';

async function main() {
  const manifest = await readCurrentDynamicSeedManifest();
  if (manifest.integrity.status === 'failed') {
    console.error(
      `[dynamic-seed][report] FAILED current manifest ` +
        `anchor=${manifest.config.anchorDate} ` +
        `checks=${manifest.integrity.checks} ` +
        `violations=${manifest.integrity.violations.length}`,
    );
    console.error(
      JSON.stringify(
        {
          config: manifest.config,
          counts: manifest.counts,
          coverage: manifest.coverage,
          integrity: manifest.integrity,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }
  const config = parseDynamicSeedConfig([
    'node',
    'integrity-report',
    `--anchor-date=${manifest.config.anchorDate}`,
    `--to=${manifest.config.historyEndDate}`,
    `--from=${manifest.config.historyStartDate}`,
    `--history-months=${manifest.config.historyMonths}`,
    `--seed=${manifest.config.seed}`,
    `--users=${manifest.config.users}`,
    `--session-density=${manifest.config.sessionDensity}`,
    `--workout-density=${manifest.config.workoutDensity}`,
    `--booking-density=${manifest.config.bookingDensity}`,
    `--exercise-history=${manifest.config.exerciseHistory}`,
    `--split-presets-per-member=${manifest.config.splitPresetsPerMember}`,
    `--target=${manifest.config.target}`,
    '--mode=additive',
  ]);
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });
  try {
    const state = createInitialSeedState();
    populateAccountState(state, buildSeedAccounts(config));
    const ctx: DynamicSeedContext = {
      config,
      notableIds: {},
      prisma,
      rng: new SeedRandom(config.seed),
      state,
    };
    const integrity = await runSeedIntegrityAudit(ctx);
    const counts = await buildModelCounts(prisma);
    console.log(
      `[dynamic-seed][report] PASS anchor=${manifest.config.anchorDate} ` +
        `checks=${integrity.checks} ` +
        `coverageRows=${manifest.coverage.totalRowCount} ` +
        `users=${counts.user ?? 0} memberships=${counts.subscription ?? 0} ` +
        `cards=${counts.membershipCard ?? 0} payments=${counts.payment ?? 0} ` +
        `holds=${counts.commerceCheckoutHold ?? 0} bookings=${counts.amenityBooking ?? 0} ` +
        `coaching=${counts.coachAppointment ?? 0} workouts=${counts.workoutSession ?? 0}`,
    );
    console.log(
      JSON.stringify(
        {
          config: manifest.config,
          counts,
          coverage: manifest.coverage,
          integrity,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
