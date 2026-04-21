# Gap Report Template

Use this template for Phase 1 audit output.

## Scope

- Feature:
- Tracker context:
- Surfaces:
- Backend modules:
- Shared bridge files:
- Artifact directory:

## Path mismatches

- [ ] Frontend path does not exist in backend
- [ ] Backend route has no frontend consumer

## Field mismatches

- [ ] Request field mismatch
- [ ] Response field mismatch
- [ ] Type mismatch
- [ ] Casing mismatch

## Feature gaps

- [ ] UI exists without endpoint
- [ ] Endpoint exists without UI consumer
- [ ] Missing feature implied by the visible user flow

## Response-handling gaps

- [ ] Missing loading state
- [ ] Missing empty state
- [ ] Missing error-state handling
- [ ] Pagination ignored

## Auth gaps

- [ ] Missing token attachment
- [ ] Missing `401` or `403` handling
- [ ] Missing backend guard or role protection

## Page Completion

- [ ] Affordance gaps
- [ ] Flow gaps
- [ ] Data usability gaps
- [ ] Async state gaps
- [ ] Contract-to-UI gaps
- [ ] Parity gaps
- [ ] Confusing UI or UX gaps
- [ ] Visual polish gaps

## Finding Classification

- `autofix_now`:
- `blocked_external`:
- `blocked_hard`:
- `product_followup`:

## Autofix-now checklist

- [ ] Primary actions
- [ ] Modal triggers
- [ ] Sort and filter behavior
- [ ] Loading, empty, error, and pending states
- [ ] Role-sensitive UI handling
- [ ] Visible post-action state

## Recommended product follow-ups

- None yet.

## Fix plan

- Frontend changes:
- Frontend UI polish changes:
- Backend changes:
- Shared transport or query changes:
- Verification requirements:

## Verification evidence

- Direct API checks:
- Swagger contract evidence:
- Web Playwright:
- Mobile Playwright:
- QA summary:
- Remaining blockers:
