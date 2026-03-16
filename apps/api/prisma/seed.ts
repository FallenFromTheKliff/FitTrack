import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = ['USER', 'STAFF', 'ADMIN', 'COACH'];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log('Roles seeded successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());