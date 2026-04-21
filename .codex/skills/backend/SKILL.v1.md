---
name: backend
description: "Use for FitTrack backend work in apps/api: NestJS modules, controllers, services, repositories, DTOs, Prisma-backed flows, Swagger docs, auth guards, Bull or Redis lifecycle logic, and backend refactors that must follow current repo conventions."
---

# FitTrack Backend

Use this skill when adding or refactoring backend behavior in `apps/api`.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only the smallest needed reference:
  - `references/api-conventions.md` for contracts and cross-cutting behavior
  - `references/module-template.md` for structure
  - `references/error-codes.md` for problem details and domain-safe failures

## Repo defaults

- Prefer `Controller -> Service -> Repository -> BaseRepository -> Prisma` for non-trivial flows.
- Keep controllers thin: routing, DTOs, guards, Swagger metadata, request context, and current-user extraction.
- Services own orchestration, domain rules, cross-domain coordination, events, and queue dispatch.
- Repositories own non-trivial Prisma access. Direct `Service -> Prisma` is acceptable only when the module is genuinely simple and already follows that pattern.
- For multi-module domains, keep the domain root thin and split business modules into subfolders like `auth/otp` and `membership/subscription|payment`.

## Contracts

- Success responses use `{ data, meta? }`.
- Error responses use RFC7807-style problem details: `{ type, title, status, detail }`.
- Validation is global: whitelist, forbid non-whitelisted fields, transform enabled.
- Preserve auth semantics with `JwtAuthGuard`, `RolesGuard`, `@Roles()`, and `@CurrentUser()`.
- Keep Swagger current for any new or changed endpoint.

## Data and side effects

- Group multi-write persistence inside transactions.
- Keep external side effects after the required database state commits.
- Redis is infrastructure for auth, throttling, queue wiring, and coordination. Do not turn it into ad hoc application state.
- Queue work should follow the existing `InjectQueue` + lifecycle service + `@Processor()` pattern.

## Completion seam checklist

- When page QA exposes missing sort or filter support, add or tighten the backend seam if the page intent already implies it.
- When the UI exposes a visible action, ensure the backend contract has the endpoint coverage and response fields needed to complete that action cleanly.
- When status or enum presentation is unclear on the frontend, first check whether the backend is underspecifying labels, states, or response fields.
- When completion depends on aggregate data or non-null invariants, prefer explicit repository or service guarantees over leaving the frontend to infer them.

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
- If a new library or backend framework layer appears later, scan the repo first and extend the closest proven pattern instead of starting a parallel architecture.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
