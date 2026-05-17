# Railway Next Checklist

Use this checklist only after the exact failing Railway log section is known.

Source anchors:

- Railway config as code: https://docs.railway.com/config-as-code/reference
- Railway monorepos: https://docs.railway.com/deployments/monorepo
- Railway build configuration: https://docs.railway.com/builds/build-configuration
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway Next.js guide: https://docs.railway.com/guides/nextjs
- Next.js standalone output: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
- Turborepo Docker guide: https://turborepo.dev/docs/guides/tools/docker
- pnpm workspace and filtering: https://pnpm.io/workspaces and https://pnpm.io/filtering

## Config As Code

- Confirm whether the deployment used `railway.toml`, `railway.json`, or dashboard settings.
- Remember that config in code overrides dashboard values for that deployment.
- Check `build.builder`, `build.dockerfilePath`, `build.buildCommand`, `build.watchPatterns`, `deploy.startCommand`, `deploy.healthcheckPath`, and `deploy.healthcheckTimeout`.
- If Railway service root is nested, verify the config file path in Railway; it does not automatically follow the root directory.
- Avoid duplicate or contradictory dashboard settings. Record any setting that cannot be verified from code.

## Monorepo Root Path

- Decide whether Railway is treating FitTrack as an isolated app root or a shared monorepo.
- If Docker needs root lockfiles or shared packages, build from repo root with `apps/web/Dockerfile`.
- If Railpack builds from a nested root, ensure commands still see the expected workspace files.
- Watch paths are evaluated from repo root; include app files, shared packages, root manifests, lockfile, and turbo config when they affect the web build.

## Docker And Turbo Prune

- Build locally from repo root: `docker build -f apps/web/Dockerfile .`.
- Ensure Corepack and pnpm are available in the image before pnpm commands run.
- Match `turbo prune <target> --docker` to the package name in `apps/web/package.json`.
- Copy pruned `out/json` before install, then `out/full` before build.
- Use the frozen lockfile unless the failure proves the lockfile is stale.
- Copy `.next/standalone`, `.next/static`, and `public` into paths that match the final `CMD`.
- Ensure `.dockerignore` does not exclude root manifests, workspace config, lockfile, app source, shared packages, or required build outputs.

## Next Standalone

- `next.config.ts` should set `output: "standalone"` for self-hosted standalone deployments.
- Use `outputFileTracingRoot` when the app needs traced files outside `apps/web`; keep include globs narrow.
- Standalone `server.js` is the runtime entrypoint. Do not use `next start` for a standalone-only image.
- Copy `public` and `.next/static` into the standalone runtime if Railway serves static assets from the container.
- Run with Railway's `PORT` and bind to `0.0.0.0` via `HOSTNAME` or equivalent environment.
- If a custom server exists, verify it is compatible with standalone tracing before relying on it.

## pnpm Workspace

- `pnpm-workspace.yaml` must include `apps/*` and any shared package folders used by web.
- Workspace dependencies should be declared in the consuming package, not assumed through root hoisting.
- Prefer exact filters by package name; use `--fail-if-no-match` during verification to catch wrong names.
- Check whether the build command runs from root, app root, or pruned workspace root.
- Keep `pnpm-lock.yaml` aligned with package changes.

## Env Vars

- List env vars read during `next build` separately from vars read at runtime.
- `NEXT_PUBLIC_*` values are public and build-exposed; do not put secrets there.
- Server-only secrets must be Railway runtime variables or safe build variables when build-time rendering requires them.
- Production API origins must not use localhost. Verify public URL vs Railway private-network URL intentionally.
- Do not commit `.env` files, token values, or Railway secrets while debugging.

## Healthcheck

- Healthcheck path should return HTTP 200 quickly without login, redirects, cookies, or slow upstream dependencies.
- Railway uses the injected `PORT` for healthchecks; verify the container listens on that value.
- 502 or service unavailable usually means wrong port binding, crashed start command, wrong healthcheck path, or missing runtime env.
- If host restrictions exist, allow `healthcheck.railway.app`.
- Increase timeout only after proving startup is legitimately slow; do not hide crashes with longer timeouts.

## Safe Verification

- Start with the first fatal log line and keep hypotheses bounded.
- Verify Docker changes with the root-context Docker build.
- Verify Railpack-style changes with the closest pnpm filtered build.
- Verify runtime fixes by starting the produced server with `PORT` and `HOSTNAME=0.0.0.0`, then requesting the healthcheck path.
- For teammate failures, compare their branch and deployment log. Do not overwrite unrelated edits or patch outside the current write scope.
