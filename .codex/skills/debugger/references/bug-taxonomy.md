# Bug Taxonomy

Use this file only after the main debugger loop has defined the failing signal.

## Next.js Build And Type Errors

- Capture the exact `next build`, `tsc`, or package script and the first fatal compiler frame.
- Separate TypeScript errors, ESLint errors, route/module resolution errors, server/client boundary errors, static generation errors, and runtime-only startup errors.
- Check `"use client"` placement, server-only imports in client modules, dynamic route params, async page/layout signatures, environment variable availability, and generated type files.
- Compare dev versus production mode: `next dev` can pass while `next build` fails due static rendering, missing env, invalid metadata, or stricter type generation.
- Avoid disabling type or lint checks in Next config unless the user explicitly approves.

## Flaky Tests

- Identify whether the failure is order-dependent, time-dependent, data-dependent, worker-dependent, browser-dependent, or network-dependent.
- Preserve the failing assertion and collect seed, retry count, worker count, clock usage, random data, fixture setup/teardown, and shared state.
- For Playwright, prefer trace evidence for CI failures and inspect console, network, DOM snapshots, locator timing, viewport, and browser metadata.
- Test isolation first: storage, cookies, database rows, mocks, timers, ports, queues, and generated files must not leak across tests.
- Prove closure with repeated narrow runs or a deterministic guard, not a single green run.

## Async, Race, And State Bugs

- Name the state transition that should happen and the observed ordering that breaks it.
- Look for missing `await`, unhandled promises, stale closures, optimistic updates, duplicate requests, aborted fetches, cache invalidation gaps, and effect cleanup bugs.
- Add timestamps, request IDs, operation IDs, or state snapshots before patching when ordering is unclear.
- Prefer deterministic synchronization over sleeps: await readiness, assert settled UI, use fake timers correctly, or wait on explicit events.
- Check double-submit, rapid navigation, back/forward, refresh, cancellation, and concurrent mutation paths.

## Browser And Runtime Bugs

- Capture browser console errors, network failures, failing action, route, viewport, auth state, and feature flags.
- Distinguish render crash, hydration mismatch, event-handler bug, CSS/layout issue, blocked request, CORS/auth failure, and data-shape crash.
- Use Browser DevTools or Playwright when visual/runtime evidence matters; include screenshots or traces when they change the diagnosis.
- Check client/server environment differences, local storage/session state, stale bundles, service workers, and runtime-only env variables.
- Rerun the same user flow after a patch before moving to broader tests.

## Deployment And Container Bugs

- Separate build-time failure, image creation failure, container startup failure, healthcheck failure, and post-start runtime failure.
- Capture image/tag, command, working directory, entrypoint, env vars, exposed ports, mounted volumes, healthcheck output, and first fatal container log.
- Compare local shell command with container command; missing generated files and wrong working directories are common.
- Check service readiness, DNS names, network aliases, database migrations, secrets, file permissions, and OS-specific paths.
- Do not fix a startup failure by only making the healthcheck more lenient.

## Schema And API Drift

- Identify the exact contract edge: DTO, route, status code, response shape, generated client, Prisma schema, migration, OpenAPI/Swagger doc, or seed data.
- Compare producer and consumer types, generated artifacts, validation pipes, serializers, default values, nullable fields, and enum values.
- Regenerate clients or Prisma artifacts only when schema evidence requires it, then verify the generated diff is expected.
- Test both the direct API contract and at least one consumer when the drift crosses package or service boundaries.
- Add a contract test, schema assertion, or fixture when the drift could recur.

## Rogue Process And Port Issues

- Capture the failing port, process list, command line, PID, working directory, and whether the process belongs to the current task.
- Prefer graceful shutdown commands owned by the repo before killing a process.
- Before terminating anything, verify the target path or command line matches the intended workspace or explicitly named service.
- Check duplicate dev servers, stale watchers, background test runners, Docker port bindings, orphaned Node processes, and file locks.
- After cleanup, rerun the original command and confirm the same port/process symptom is gone.
