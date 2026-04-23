---
name: gh-shared-branch-delivery
description: Use for FitTrack GitHub delivery when developers work in parallel from personal branches and need Codex to preflight collision risk, verify duplicate routes or types or models do not already exist, merge main into my_branch without rebasing, resolve conflicts safely, handle Prisma schema and migration merge risk, run the right local gates, push only to my_branch, and open or prepare a PR from my_branch to main.
---

# GitHub Shared Branch Delivery

Use this skill for branch-safe delivery in the FitTrack repo. Keep the workflow personal-branch first and PR-to-main only.

## Read first

- `references/branch-policy.md`
- `references/conflict-policy.md`
- `references/mcp-matrix.md`

## PHASE 0 - Pre-write check

This phase is mandatory before Codex writes any file.

1. Check whether a teammate already has an open PR touching the same file.
   - If GitHub MCP or plugin is available, use `list_pull_requests` plus `get_file_contents`.
   - If GitHub MCP or plugin is not available, require the developer to check GitHub manually first.
2. Check whether the route, function, type, model, DTO, or API surface already exists.
   - If GitHub MCP or plugin is available, use `search_code`.
   - If GitHub MCP or plugin is not available, use Serena after activation or local `rg`.
3. If collision risk is found, stop and report before writing.

Do not continue into implementation when Phase 0 is unresolved.

## PHASE 1 - Branch preflight

- Read the local config block in `references/branch-policy.md`.
- Run `scripts/get-branch-state.ps1`.
- Codex may work freely on `my_branch`.
- Codex must never push directly to `main`.
- Codex must never push to a teammate branch.
- If the current branch is neither `my_branch` nor a safe local work branch derived from it, stop and report.

## PHASE 2 - Sync from main

Use merge-based sync only.

Daily or feature-start flow:

1. fetch remote refs
2. update local `main`
3. switch to `my_branch`
4. merge `main` into `my_branch`

Never rebase in this workflow.

Use `scripts/check-merge-readiness.ps1` before the merge and `scripts/scan-conflicts.ps1` if conflicts appear.

## PHASE 3 - Implement on my_branch

- Code or do QA revisions on `my_branch`.
- Dev 1 uses `waes-lehjet-backend` for both development and QA.
- Dev 2 uses the same skill but with their own `my_branch` value.

### QA mode on `waes-lehjet-backend`

- QA revisions stay on the same branch as normal development.
- QA revisions are limited to UI text, layout fixes, and minor adjustments.
- QA revisions do not touch schema, migrations, middleware, or shared types.
- QA revisions use the same lint and typecheck gates as development work. No shortcuts.

### Commit hygiene

- `feat:` for new features
- `fix:` for bug fixes
- `qa:` for QA revisions and copy or layout cleanup

Never mix feature work and QA revisions in the same commit.

## PHASE 4 - Conflict handling

- Use merge conflict resolution, not rebase recovery.
- Resolve conflicts on `my_branch`.
- Follow `references/conflict-policy.md`.
- When backend contracts, Prisma schema, or migrations are touched, treat them as one decision surface.
- If `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, or DB-backed contracts are touched, require `prismaLocal.migrate_status`.
- Resolve schema plus migration history together, not line by line in isolation.
- If migration history is contradictory, stop and report instead of guessing.

## PHASE 5 - Gates

- Run `scripts/get-change-scope.ps1` to classify the touched surface.
- Run `scripts/run-delivery-gates.ps1` to select the smallest honest gate set.
- QA mode does not get lighter gates.
- Use MCP lanes only when the touched scope needs them:
  - `prismaLocal` for schema and migration truth
  - `swagger` for backend contract verification after runtime truth is known
  - `chromeDevtools` for web runtime and network issues
  - `notion` for shared coordination when the task needs durable tracking
  - `sentry` for prod-observed follow-up only
  - `figma` only for Figma-owned UI or design-to-code work
  - `serena` as the preferred repo-aware scan once the project is activated

## PHASE 6 - Push and PR

- Push only to `my_branch`.
- Never push directly to `main`.
- Open a PR from `my_branch` to `main` when the feature or QA revision set is complete.
- If GitHub MCP or plugin is available, open the PR through GitHub tooling.
- If GitHub MCP or plugin is not available, stop after push and remind the developer to open the PR manually on GitHub.

## Canonical flow

1. Pull `main`.
2. Code or do QA revisions on `my_branch`.
3. Commit with `feat:`, `fix:`, or `qa:`.
4. Push to `my_branch`.
5. Open PR `my_branch -> main`.
6. Resolve PR-stage conflicts through the GitHub flow.
7. Merge into `main`.
8. Other developers pull `main` and merge it into their own branches.

Dev 1 follows this flow for both feature work and QA revisions.
Dev 2 follows the same flow for feature work on their own branch.
