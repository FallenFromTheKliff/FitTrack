import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { localEnvFilePath } from '../env-path';
import { bootstrapDefaults } from './defaults';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const summary = await bootstrapDefaults(prisma, {
    // Bootstrap prepares the schema without reseeding or repositioning
    // existing facilities. Intentional local/reset seed flows call
    // bootstrapDefaults directly with facility defaults enabled.
    includeFacilities: false,
  });

  console.log(`[bootstrap] admin ensured for ${summary.adminEmail}`);
  console.log(`[bootstrap] demo member ensured for ${summary.demoMemberEmail}`);
  console.log(
    `[bootstrap] default amenities: created=${summary.createdCount}, existing=${summary.existingCount}, reactivated=${summary.reactivatedCount}, total=${summary.defaultAmenityCount}`,
  );
  console.log(
    `[bootstrap] default muscles: created=${summary.muscleCreatedCount}, existing=${summary.muscleExistingCount}, total=${summary.defaultMuscleCount}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
