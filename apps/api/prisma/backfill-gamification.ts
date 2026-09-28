import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './dynamic-seed/config';
import {
  runGamificationBackfill,
  type GamificationBackfillOptions,
} from './dynamic-seed/gamification-backfill';

export function parseGamificationBackfillOptions(
  argv: readonly string[] = process.argv,
): GamificationBackfillOptions {
  const dryRun = argv.includes('--dry-run');
  const apply = argv.includes('--apply');
  if (dryRun && apply) {
    throw new Error('Choose either --dry-run or --apply.');
  }

  return { dryRun: !apply };
}

async function main() {
  const options = parseGamificationBackfillOptions();
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    const report = await runGamificationBackfill(prisma, options);
    console.log(
      `[gamification-backfill] ${report.dryRun ? 'dry-run' : 'applied'} complete`,
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
