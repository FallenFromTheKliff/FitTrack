# Conflict Policy

## Merge strategy

- Use merge-based sync only.
- Merge `main` into `my_branch`.
- Never rebase in this skill.
- Resolve conflicts on `my_branch`.
- Never push conflict-resolution work to `main`.
- Never push conflict-resolution work to a teammate branch.

## General conflict rules

- Keep both sides when the changes are additive and coherent.
- Preserve the contract that matches the merged route, type, DTO, service, or API behavior.
- Stop and report when the conflict is structurally ambiguous instead of guessing.

## Backend and shared contract conflicts

- Resolve backend services, DTOs, repositories, and client contracts together.
- If a shared type or DTO changes, verify all touched consumers still agree with that shape.
- Do not let UI convenience override canonical backend semantics when the backend contract is the source of truth.

## Prisma conflict rules

- Treat `schema.prisma`, migrations, and DB-backed contract code as one decision surface.
- Run `prismaLocal.migrate_status` when `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, or DB-backed contract code is touched.
- Resolve schema plus migration history together, not line by line in isolation.
- Keep both valid migrations when they are additive and do not contradict each other.
- If both sides edit the same migration history in incompatible ways, stop and report.

## PRISMA RESET RULE

- `migrate_reset` is NOT triggered automatically by Codex.
- `migrate_reset` IS always available as a manual developer escape hatch.
- If Codex hits an unresolvable migration conflict, stop, explain clearly, then remind the developer that `npx prisma migrate reset` is available if needed.
- The developer decides whether to reset. Codex never triggers it automatically.
