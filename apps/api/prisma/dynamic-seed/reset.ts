import type { PrismaClient } from '@prisma/client';
import { REMOTE_RESET_CONFIRMATION, getDatabaseUrl } from './config';
import type { DynamicSeedConfig } from './types';

const LOCAL_RESET_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db',
  'fittrack-db',
  'fittrack-db-local',
]);

const LOCAL_RESET_DATABASES = new Set(['fittrack', 'fittrackdb']);

function quotePgIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function isLocalDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

  return {
    database,
    host: url.hostname,
    isLocal:
      LOCAL_RESET_HOSTS.has(host) &&
      LOCAL_RESET_DATABASES.has(database.toLowerCase()),
  };
}

export function assertResetAllowed(config: DynamicSeedConfig) {
  const databaseUrl = getDatabaseUrl();
  const databaseInfo = isLocalDatabaseUrl(databaseUrl);

  if (config.mode !== 'reset') {
    return databaseInfo;
  }

  if (config.target === 'local' && databaseInfo.isLocal) {
    return databaseInfo;
  }

  if (
    config.target === 'railway' &&
    config.allowRemoteReset &&
    config.confirmRemoteReset === REMOTE_RESET_CONFIRMATION
  ) {
    return databaseInfo;
  }

  throw new Error(
    [
      `[dynamic-seed] Refusing reset for database "${databaseInfo.database}" on host "${databaseInfo.host}".`,
      'Use local Docker Postgres for reset, or pass --target=railway --allow-remote-reset --confirm=RESET_REMOTE_DYNAMIC_SEED intentionally.',
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
