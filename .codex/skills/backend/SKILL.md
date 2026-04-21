---
name: backend
description: "Use for FitTrack backend work in apps/api: NestJS modules, controllers, services, repositories, Prisma schema and migrations, DTOs, Swagger docs, auth guards, queue lifecycle logic, runtime contract verification, and backend refactors that must follow current repo conventions."
---

# FitTrack Backend

Use this skill when adding or refactoring backend behavior in `apps/api`.

## Changelog

- 2026-04-13: expanded Prisma migration and seed-safety guidance, added runtime truth loop with Swagger confirmation, and tightened industry-standard normalization rules for weak local patterns.
- 2026-04-14: added contract-delta checks, explicit integration-owned widening rules, and stronger MCP guidance for Prisma-backed truth and runtime confirmation.
- 2026-04-20: added an explicit constraint-scan rule before endpoint or DTO widening so shared clients and adjacent modules are checked before the backend blast radius grows.
- 2026-04-20: added backend-compensation rules for bad data shapes so canonical product semantics move server-side instead of forcing the frontend into repeated workarounds.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only the smallest needed reference:
  - `references/api-conventions.md` for contracts and cross-cutting behavior
  - `references/module-template.md` for structure
  - `references/error-codes.md` for problem details and domain-safe failures
  - `references/migration-playbook.md` for schema, migration, and seed-safe workflow
  - `references/runtime-verification.md` for direct API and Swagger confirmation

## MCP expectations

- `Serena` is required for symbol-aware discovery and reference chasing.
- `Prisma Local` is required when the work touches schema, relations, seed data, auth, bookings, profile state, repository behavior, or any DB-backed invariant.
- `Swagger` belongs to runtime verification after direct API checks pass. Do not use Swagger as a substitute for implementation discovery.

## Repo defaults

- Prefer `Controller -> Service -> Repository -> BaseRepository -> Prisma` for non-trivial flows.
- Keep controllers thin: routing, DTOs, guards, Swagger metadata, request context, and current-user extraction.
- Services own orchestration, domain rules, cross-domain coordination, events, and queue dispatch.
- Repositories own non-trivial Prisma access. Direct `Service -> Prisma` is acceptable only when the module is genuinely simple and already follows that pattern.
- For multi-module domains, keep the domain root thin and split business modules into subfolders like `auth/otp` and `membership/subscription|payment`.

## Industry-standard normalization rule

- Respect strong local repo patterns first.
- When the nearby pattern is weak, incomplete, or clearly drifting from sound NestJS plus Prisma practice, normalize toward the nearest solid industry-standard shape without broad rewrites.
- Fix the local seam that is causing the problem before proposing stack changes.
- Treat framework or stack replacement as a last resort after the current stack has been given a clean, conventional implementation path.

## Contracts

- Success responses use `{ data, meta? }`.
- Error responses use RFC7807-style problem details: `{ type, title, status, detail }`.
- Validation is global: whitelist, forbid non-whitelisted fields, transform enabled.
- Preserve auth semantics with `JwtAuthGuard`, `RolesGuard`, `@Roles()`, and `@CurrentUser()`.
- Keep Swagger current for any new or changed endpoint.

## Contract delta checklist

- Before widening a backend seam, check:
  - new or changed DTO fields
  - response shape compatibility for existing clients
  - auth or guard behavior changes
  - enum or status additions that affect shared clients
  - schema, migration, and seed implications
- Prefer additive contract evolution and mapper updates over wide breaking changes.
- If the UI is still provisional, do not widen backend contracts just because a page is unfinished; let `integration` decide whether the surface truly needs the new seam.

## Constraint scan

- Before creating, widening, or refactoring an endpoint, run a constraint scan across:
  - current web and mobile consumers of the contract
  - `packages/api-client`, `packages/query`, shared validators, and shared types
  - DTOs, enums, guards, repositories, and services touched by the change
  - nearby modules that reuse the same user, membership, auth, or profile seams
- Record which response fields, enum values, and status behaviors must stay backward-compatible.
- Default to additive changes and mapper updates over breaking response-shape changes.
- If the frontend can close with existing data plus a smaller client reshape, keep the backend stable and hand the decision back to `integration` instead of widening by convenience.

## Integration-owned widening rule

- Treat broad endpoint widening, new cross-domain DTOs, and schema-reaching contract changes as integration decisions, not local convenience edits.
- If a frontend surface might be solved with existing data plus a smaller client-side reshape, keep the backend stable and hand the decision back to `integration`.
- When widening is proven necessary, keep the change narrow, additive, and explicit about client impact.
- Bias the seam to backend compensation when the UI needs canonical labels or statuses, aggregate or joined data, permission-aware action fields, or server-backed search or filter or sort.
- Do not force the frontend to reconstruct cross-record meaning from ambiguous fields when the backend can expose the canonical shape once.

## Schema and migration rule

- Use Prisma Local early when the work touches schema, relations, seed data, auth, membership, bookings, or any DB-backed invariant.
- Prefer additive schema changes and staged contract evolution when possible.
- When business logic changes require schema changes, update schema, migrations, repositories, validators, seeds, and verification notes together.
- Keep local development changes reseed-safe. A clean reset plus reseed should still reach the intended runtime state.
- Do not fall back to `db push` style shortcuts when a real migration is the safer long-term shape.

## Data and side effects

- Group multi-write persistence inside transactions.
- Keep external side effects after the required database state commits.
- Redis is infrastructure for auth, throttling, queue wiring, and coordination. Do not turn it into ad hoc application state.
- Queue work should follow the existing `InjectQueue` + lifecycle service + `@Processor()` pattern.

## Runtime truth loop

- Treat repo code as only the first layer of truth.
- For DB-backed work, confirm local schema and seed truth before assuming a controller or service is correct.
- Run focused tests before runtime verification when behavior changed.
- Use direct API checks to confirm actual behavior before Swagger.
- Use Swagger at `/v1/docs` or `/v1/docs-json` as the live contract confirmation step after direct API checks pass.
- Do not call the backend done if role denial, seeded data assumptions, or Swagger metadata still disagree with the intended behavior.

## Completion seam checklist

- When page QA exposes missing sort or filter support, add or tighten the backend seam if the page intent already implies it.
- When the UI exposes a visible action, ensure the backend contract has the endpoint coverage and response fields needed to complete that action cleanly.
- When status or enum presentation is unclear on the frontend, first check whether the backend is underspecifying labels, states, or response fields.
- When completion depends on aggregate data or non-null invariants, prefer explicit repository or service guarantees over leaving the frontend to infer them.
- If multiple screens would need the same local mapper or workaround to understand a backend payload, treat that as a signal to move the canonical shape into the backend contract.
- Keep wrong-portal denial, membership gating, status-specific responses, and role-sensitive failure paths explicit in the contract.

## Implementation checklist

- Match the nearest existing domain pattern before introducing a new one.
- Reuse shared validators, decorators, guards, repository helpers, and DTO style.
- Keep enum and string casing aligned with Prisma and shared client contracts.
- When auth, status, or required aggregates matter, prefer non-null repository contracts over downstream failure detection.
- Update focused specs when behavior changes.
- If a module has architecture notes under `apps/api/docs/architecture`, follow them.

## Output defaults

- Favor thin controller methods, explicit service orchestration, and repository-owned persistence.
- Prefer mapper helpers for patch objects over repeated inline `if (dto.x !== undefined)` ladders.
- Keep schema, migration, seed, and runtime verification notes aligned whenever a DB-backed behavior changes.
- If a new library or backend framework layer appears later, scan the repo first and extend the closest proven pattern instead of starting a parallel architecture.
- If a backend change could affect other modules through shared DTOs, enums, guards, or repository helpers, stop and re-check the coupling with `integration` before widening the blast radius.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
