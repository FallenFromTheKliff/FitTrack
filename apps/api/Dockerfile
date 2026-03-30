# =============================================================================
# FitTrack NestJS — Production Dockerfile (Multi-Stage)
# =============================================================================
# Stage 1 (builder): Install all deps, compile TypeScript
# Stage 2 (runner):  Copy only compiled output + prod deps — lean final image
# =============================================================================

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — layer cache means npm install
# only re-runs when package.json or lock file changes
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY . .
RUN npm run build

# Prune dev dependencies — only keep what production needs
RUN npm prune --production

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nestjs

# Copy compiled output + pruned node_modules from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Prisma: copy schema so prisma generate works at runtime if needed
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copy RSA keys if baked into image (alternatively inject via Railway env vars)
# COPY --chown=nestjs:nodejs private.pem ./private.pem
# COPY --chown=nestjs:nodejs public.pem  ./public.pem

USER nestjs

EXPOSE 3000

# Run Prisma migrate then start the app
# migrate deploy is safe to run on every startup — it is idempotent
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]