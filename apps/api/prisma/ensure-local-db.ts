import { Client } from 'pg';
import { config } from 'dotenv';
import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/fittrackdb';

function getUrls() {
  const targetUrl = new URL(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  const databaseName = decodeURIComponent(targetUrl.pathname.replace(/^\//, ''));

  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(
      `Unsupported database name "${databaseName}". Use letters, numbers, or underscores only.`,
    );
  }

  const adminUrl = new URL(targetUrl.toString());
  adminUrl.pathname = '/postgres';

  return {
    adminUrl: adminUrl.toString(),
    databaseName,
  };
}

async function main() {
  const { adminUrl, databaseName } = getUrls();
  const client = new Client({ connectionString: adminUrl });

  await client.connect();

  try {
    const result = await client.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [databaseName],
    );

    if (result.rows[0]?.exists) {
      console.log(`[db] database "${databaseName}" already exists`);
      return;
    }

    await client.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`[db] created database "${databaseName}"`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
