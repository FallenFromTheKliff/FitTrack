import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
});