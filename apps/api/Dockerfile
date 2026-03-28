FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate && pnpm add -g turbo

FROM base AS pruner
COPY . .
RUN turbo prune @fittrack/api --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @fittrack/api exec npx prisma generate && pnpm --filter @fittrack/api run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S fittrack && adduser -S fittrack -G fittrack
COPY --from=builder --chown=fittrack:fittrack /app/node_modules ./node_modules
COPY --from=builder --chown=fittrack:fittrack /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=fittrack:fittrack /app/apps/api/dist ./dist
COPY --from=builder --chown=fittrack:fittrack /app/apps/api/prisma ./prisma
COPY --from=builder --chown=fittrack:fittrack /app/apps/api/env-path.ts ./env-path.ts
COPY --from=builder --chown=fittrack:fittrack /app/apps/api/prisma.config.ts ./prisma.config.ts
ENV NODE_PATH=/app/apps/api/node_modules:/app/node_modules
USER fittrack
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
