import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { localEnvFilePath } from './env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node -r ts-node/register prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
