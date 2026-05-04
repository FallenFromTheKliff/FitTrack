FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate && pnpm add -g turbo

FROM base AS pruner
COPY . .
RUN turbo prune @fittrack/web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=/v1
ARG NEXT_PUBLIC_R2_PUBLIC_BASE_URL=
ARG NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR=defaults/avatars
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_R2_PUBLIC_BASE_URL=${NEXT_PUBLIC_R2_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR=${NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR}
COPY --from=installer /app/ ./
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @fittrack/web run build

FROM node:20-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/v1
ARG NEXT_PUBLIC_R2_PUBLIC_BASE_URL=
ARG NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR=defaults/avatars
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_R2_PUBLIC_BASE_URL=${NEXT_PUBLIC_R2_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR=${NEXT_PUBLIC_R2_DEFAULT_AVATAR_DIR}
ENV PORT=8080
ENV HOSTNAME=::

RUN addgroup -S fittrack && adduser -S fittrack -G fittrack

COPY --from=builder --chown=fittrack:fittrack /app/apps/web/public ./public
COPY --from=builder --chown=fittrack:fittrack /app/apps/web/.next-runtime/standalone ./
COPY --from=builder --chown=fittrack:fittrack /app/apps/web/.next-runtime/static ./apps/web/.next-runtime/static

USER fittrack

EXPOSE 8080

CMD ["node", "apps/web/server.js"]
