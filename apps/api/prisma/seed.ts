import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { bootstrapDefaults } from './defaults';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const summary = await bootstrapDefaults(prisma);
  console.log(`[seed] admin ensured for ${summary.adminEmail}`);
  console.log(
    `[seed] default venues: created=${summary.createdCount}, preserved=${summary.preservedCount}, customized-preserved=${summary.customizedCount}, total=${summary.defaultVenueCount}`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
