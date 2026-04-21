---
name: integration
description: "Use for FitTrack full-stack integration work: connect web or mobile flows to backend endpoints, audit backend and frontend contract drift, resolve auth or field mismatches, and verify integrated behavior with the repo's Serena, Notion, and Playwright workflow."
---

# FitTrack Integration

This skill is for end-to-end feature wiring and full-system integration audits. Do not skip phases.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only what is needed:
  - `references/integration-map.md`
  - `references/gap-report-template.md`
  - `.playwright-mcp.json`
  - `.playwright-fittrack-flow.json`
  - `tasks/integration-builder/integration-driver/07-playwright-verification.md`
  - `tasks/integration-builder/integration-driver/08-mcp-policy.md`

## Mandatory phase order

### Phase 1: Audit

- Start with Serena-backed scans of:
  - backend controllers, DTOs, services, repositories, and shared filters or guards
  - frontend route files, feature hooks, contexts, and app-core controllers
  - `packages/api-client` and `packages/query`
- Produce a structured gap report before changing code.
- Audit page completion, not only wiring:
  - `Affordance gaps`
  - `Flow gaps`
  - `Data usability gaps`
  - `Async state gaps`
  - `Contract-to-UI gaps`
  - `Parity gaps`
- Require a `Page Completion` subsection in the gap report.
- Classify every active finding as exactly one of:
  - `autofix_now`
  - `blocked_external`
  - `blocked_hard`
  - `product_followup`
- Default audit output location: `.artifacts/integration-audits/<timestamp>/`.
- Use `scripts/run-audit.ps1` when you need a seeded report and candidate file list.

### Phase 2: Resolve

- Default to fixing frontend contract drift unless the backend path or contract clearly violates the established repo convention.
- If the backend is missing an endpoint or contract seam, follow the `backend` skill pattern.
- If the frontend is missing a consumer or UI state handling, follow the `frontend` skill pattern.
- Treat obvious page-completion gaps as normal resolve work, not optional polish.
- `autofix_now` means the surface cannot close until that item is fixed in the same run.
- Keep field transforms close to the client or query layer instead of renaming fields across the entire codebase.
- Close auth gaps on the correct side:
  - missing guard or role protection on backend
  - missing token attachment, refresh, or 401 handling on frontend
- Escalate only when the gap is:
  - ambiguous product behavior
  - structurally large
  - externally blocked
  - cross-domain enough to deserve a durable task

### Phase 3: Verify

- Follow the existing Playwright workflow and verification policy in `tasks/integration-builder`.
- Use `.playwright-mcp.json` and `.playwright-fittrack-flow.json` as the runtime source of truth.
- Require web and mobile verification when the touched feature belongs to both surfaces.
- Require negative paths for role-sensitive behavior.
- Verify page completion, not only endpoint success:
  - every visible primary action is working, intentionally hidden, or explicitly documented as blocked
  - modal-triggered flows open, close, and submit or cancel cleanly when they exist
  - loading, empty, error, and pending states are acceptable for the touched flow
  - obvious sort, filter, and label mismatches are either fixed or classified
- Do not mark the integration complete if auth or security handling still fails.
- Do not mark the integration complete while `autofix_now` page-completion findings remain open.
- Use `scripts/run-playwright-checks.ps1` to stage runtime preflight and artifact folders.

## Notion workflow

- Long-lived integration memory lives in Notion, not in a repo-root integration map.
- The starting parent page is `System Gap Analysis`.
- Read these pages when doing real integration work:
  - `Surface Verification Tracker`
  - `Refactor Requests`
  - relevant `Domain - *` pages
- Use the seeded `Integration Map and Accomplishments` child page as the ongoing integration anchor for new audits and accomplishments.

## Output defaults

- Write audit artifacts under `.artifacts/integration-audits/<timestamp>/`.
- Keep the repo copy of `references/integration-map.md` as a seeded baseline snapshot.
- Treat Notion as the evolving source for cross-run integration memory.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
