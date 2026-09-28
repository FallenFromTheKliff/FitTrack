FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS builder
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/types/package.json packages/types/package.json
COPY patches ./patches

RUN pnpm install --frozen-lockfile --filter @fittrack/api... --filter @fittrack/utils...

COPY apps/api ./apps/api
COPY packages/utils ./packages/utils
COPY packages/types ./packages/types
COPY scripts/ensure-prisma-client-link.mjs ./scripts/ensure-prisma-client-link.mjs

RUN pnpm --filter @fittrack/api exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @fittrack/api run build

FROM node:20-alpine AS runner
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs --ingroup nodejs

COPY --from=builder --chown=nestjs:nodejs /app /app
COPY --from=builder --chown=nestjs:nodejs /pnpm /pnpm

USER nestjs

EXPOSE 3001

CMD ["node", "dist/apps/api/src/main.js"]
