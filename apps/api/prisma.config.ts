import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { localEnvFilePath } from './env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
