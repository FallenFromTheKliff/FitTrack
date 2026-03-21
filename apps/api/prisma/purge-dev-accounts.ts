import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: "@test.", mode: "insensitive" } },
        { email: { contains: "@dev.", mode: "insensitive" } },
        { email: { contains: "@example.", mode: "insensitive" } },
        {
          AND: [
            { createdAt: { gte: cutoff } },
            { emailVerified: false }
          ]
        }
      ]
    }
  });

  console.log(`Deleted ${result.count} development accounts.`);
}

void main()
  .catch((error) => {
    console.error("Failed to purge development accounts.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
