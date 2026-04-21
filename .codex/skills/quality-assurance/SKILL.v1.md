---
name: quality-assurance
description: "Use for final FitTrack verification when the main need is bug sweeps, edge-case and use-case tests, repo-native lint and typecheck, targeted tests, direct API checks, Swagger confirmation, and Playwright MCP evidence."
---

# FitTrack Quality Assurance

Use this skill for the final verification pass on a touched FitTrack surface, feature, or backend contract.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/verification-matrix.md`
  - the touched package `package.json` files for script truth
  - `.playwright-mcp.json`
  - `.playwright-fittrack-flow.json`
  - `tasks/integration-builder/integration-driver/07-playwright-verification.md`
  - `tasks/integration-builder/integration-driver/08-mcp-policy.md`
- Confirm whether the change is web-only, mobile-only, backend-only, shared-package, or cross-surface.

## Verification order

Run verification in this order unless the task is clearly exempt from a later phase:

1. preflight
2. lint and typecheck
3. targeted tests
4. direct API checks
5. Swagger confirmation
6. Playwright MCP verification
7. final bug, edge-case, and use-case report

## Command resolution rules

- Use repo-native `pnpm` and package-level scripts even when the prompt says `npm lint`.
- Prefer the smallest command set that still verifies the touched area honestly.
- Use package-level lint, typecheck, and test commands first; only use repo-wide sweeps when the change truly spans the monorepo.
- QA is a verifier, not an implementer. Report failures back to the owning skill instead of silently fixing architecture here.

## What this skill must check

- regressions in the touched happy path
- realistic edge cases and denial paths
- use-case completeness, including primary actions and modal flows
- loading, empty, error, pending, success, and retry behavior where relevant
- visible bugs or uncanny UX gaps, not only console-free renders
- live backend contract truth when endpoints changed or support the touched flow

## Artifacts and evidence

- Store artifacts under `.artifacts/qa/<timestamp>/`.
- Keep command logs, direct API notes, Swagger notes, Playwright traces, screenshots, console logs, and network captures together.
- Use `.playwright-mcp.json` and `.playwright-fittrack-flow.json` as runtime truth for browser verification.
- Confirm Swagger from `/v1/docs` or `/v1/docs-json` when live contract verification is required.

## Balanced gate policy

- Real failures block completion.
- `blocked_external` means verification is real but depends on an outside system or environmental capability.
- `blocked_hard` means a concrete technical blocker still prevents trustworthy verification.
- Do not downgrade a real regression to an advisory note just because part of the flow still renders.

## Output defaults

- Report findings first.
- Separate confirmed failures, external blockers, and residual risks.
- Make it clear which verification phases ran, which were skipped, and why.
- If a phase was skipped because it was not relevant, say that directly.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
