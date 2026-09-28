import type { PrismaClient } from '@prisma/client';
import { inspectDatabaseUrl, getDatabaseUrl } from './config';
import type { DynamicSeedConfig } from './types';

function quotePgIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function assertLocalDatabaseAllowed() {
  const databaseInfo = inspectDatabaseUrl(getDatabaseUrl());
  if (!databaseInfo.isLocal) {
    throw new Error(
      `[dynamic-seed] Refusing scoped local seed for database "${databaseInfo.database}" on host "${databaseInfo.host}".`,
    );
  }
  return databaseInfo;
}

export function assertResetAllowed(config: DynamicSeedConfig) {
  const databaseUrl = getDatabaseUrl();
  const databaseInfo = inspectDatabaseUrl(databaseUrl);

  if (config.mode !== 'reset') {
    return databaseInfo;
  }

  if (databaseInfo.isLocal) {
    return databaseInfo;
  }

  throw new Error(
    [
      `[dynamic-seed] Refusing reset for database "${databaseInfo.database}" on host "${databaseInfo.host}".`,
      'Use local Docker Postgres for reset.',
    ].join(' '),
  );
}

export async function resetDatabaseForDynamicSeed(
  prisma: PrismaClient,
  config: DynamicSeedConfig,
) {
  assertResetAllowed(config);

  if (config.mode !== 'reset') {
    return;
  }

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;

  if (!tables.length) {
    return;
  }

  const tableList = tables
    .map(({ table_name }) => `"public".${quotePgIdentifier(table_name)}`)
    .join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
