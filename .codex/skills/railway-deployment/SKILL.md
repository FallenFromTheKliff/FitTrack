---
name: railway-deployment
description: "Use for FitTrack Railway deploy, build, and runtime failures: Next.js build errors on Railway, Dockerfile vs Railpack or legacy Nixpacks confusion, monorepo pnpm/turbo deploy issues, standalone output mistakes, healthcheck 502/service unavailable failures, production env or start command problems, and teammate Railway build failures. Use with $debugger to diagnose from the exact failing Railway log section before patching."
---

# FitTrack Railway Deployment

Use this skill when Railway is the failing environment. Keep the investigation evidence-led, bounded, and specific to the deployment path.

## Core Rule

- Pair with `$debugger` whenever deployment logs exist.
- Require or locate the exact failing Railway log section before editing.
- Start from the first fatal error, not the final cascade.
- Limit the loop to at most 3 named hypotheses before reporting back.
- For each hypothesis, write the evidence, smallest patch, and verification or rejection.
- Do not randomly rewrite `Dockerfile`, `railway.toml`, or Next config for hours.
- Separate build failures from runtime failures before changing files.

## First Pass

Record the service or app, branch, deployment time or id, builder, root directory, and config source if available.

Inspect FitTrack web deployment defaults in this order:

- `apps/web/railway.toml`
- `apps/web/Dockerfile`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- root `package.json`
- `pnpm-workspace.yaml`
- turbo config
- `.dockerignore` and `.railwayignore`
- env assumptions in code and docs

If the failure came from a teammate build, compare the exact log, branch, and diff before assuming local code is broken. Work with their failing section, not a rewritten story of it.

## Classify Failure

Treat it as a build failure when Railway fails before a runnable container exists:

- install command fails
- `next build`, TypeScript, ESLint, or dependency resolution fails
- Docker build layer fails
- turbo prune or pnpm workspace filtering fails
- standalone files are not generated or copied during image build

Treat it as a runtime failure when the image built but Railway cannot serve it:

- container exits after start
- start command cannot find `server.js`
- app listens on the wrong port or hostname
- healthcheck returns 502, service unavailable, 400, redirect, or auth page
- required runtime env is missing
- production API origin points at localhost or an unreachable private service

If logs are incomplete, ask for the first fatal Railway lines and still inspect config for obvious contradictions.

## Build Failures

Check these before patching:

- Railway config-as-code: file settings override dashboard settings for that deploy.
- Root directory: Railway config file location does not automatically follow a nested root directory.
- Builder path: Railway will build with a discovered Dockerfile; confirm Dockerfile vs Railpack is intentional.
- Docker context: FitTrack Docker builds should have the repo root context when the app needs root lockfiles or shared packages.
- pnpm: Corepack, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` must be present where the build expects them.
- Turbo: `turbo prune` target should match the package name, not only the folder name by habit.
- Docker prune pattern: copy `out/json` for install, then `out/full` for source, then run the filtered build.
- Next build: distinguish type/lint errors from missing build-time env or missing dependencies.
- Standalone: confirm `output: "standalone"` and add `outputFileTracingRoot` only when shared monorepo files are truly needed.
- Ignore files: `.dockerignore` or `.railwayignore` must not exclude lockfiles, app source, shared packages, or generated standalone assets needed by the build.

## Runtime Failures

Check these before patching:

- Start command: standalone images usually start with `node server.js` or `node apps/web/server.js`, depending on the copy layout.
- Port: Railway injects `PORT`; the app must listen on it.
- Host: the server should bind to `0.0.0.0` through `HOSTNAME` or equivalent config.
- Healthcheck path: return HTTP 200 quickly, without auth, redirects, cookies, slow upstream calls, or dashboard-only routes.
- Healthcheck host: allow `healthcheck.railway.app` if the app restricts hosts.
- API origin: production web should use a reachable public backend URL or a valid Railway private-network origin, never localhost.
- Env: separate variables needed during `next build` from variables needed by `server.js` at runtime.
- Secrets: do not commit env files, tokens, or Railway secrets while debugging.

## Patch Rules

- Make the smallest change that explains the first fatal log.
- Prefer repo config that is portable across Railway dashboard and local Docker.
- Keep config-as-code as source of truth when it already exists.
- Note dashboard-only settings the user or teammate must verify manually.
- Do not bypass typecheck, lint, or dependency errors unless the log proves a false positive and the user accepts the risk.
- Do not remove standalone output just to make `next start` work unless the deployment strategy is explicitly changing.
- If a dependency only fails in Docker, add it to the correct workspace package or trace include; do not rely on root hoisting.
- If the needed edit is outside the user's write scope, report the exact file or setting instead of touching it.

## Verification

Use the closest path to Railway:

- Docker path: `docker build -f apps/web/Dockerfile .`
- Railpack/pnpm path: `pnpm --filter <web-package> build`
- Standalone path: run the produced server with `PORT` and `HOSTNAME=0.0.0.0`, then curl the healthcheck.
- Config path: confirm Railway deployment details show the expected config source when access exists.

If Docker, Railway CLI, or deployment access is unavailable, say so and provide the next exact command or log section needed. Stop after bounded attempts with the first fatal log, ruled-out hypotheses, current patch, and remaining evidence gap.

## Reference

Read `references/railway-next-checklist.md` before changing Railway config, Docker/Railpack/Nixpacks settings, pnpm/turbo monorepo commands, Next standalone output, env/start command behavior, or healthchecks.
