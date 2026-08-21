# TASK-1304 - Gym Layout Realtime Gateway And Shared Contract Alignment
**Task ID:** TASK-1304
**Domain:** S13 - Gym Layout & Analytics
**Status:** done
**Branch:** feat/TASK-1304-gym-layout-realtime-gateway-and-shared-contract-alignment
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** TASK-1301
**Blocks:** TASK-1305, TASK-1306
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if extending the shared Redis and WebSocket contracts for S13 needs approval beyond the current context
**Escalation Notes:** this task may require an explicit decision because `context/00-global-contracts.md` currently limits Redis and WebSocket usage more narrowly than the S13 design
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the `/gym-layout` WebSocket gateway and equipment-status broadcast flow, while reconciling S13’s Redis/WebSocket design with the repo’s shared contracts.

## Why
The 2D equipment map is not complete without live status updates, but this slice is intentionally isolated because it is the one part of S13 that conflicts with the current shared contract docs.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A `GymLayoutGateway` exists and exposes the `/gym-layout` namespace
- [x] WebSocket auth reuses a repo-safe socket-auth pattern instead of inventing a parallel token model
- [x] Equipment status updates broadcast snapshot and delta events as documented
- [x] Redis key usage and pub/sub behavior are implemented only after reconciling the shared contract conflict
- [x] Any approved reusable rule change is reflected in `agents/architecture.md` or `context/00-global-contracts.md` only if it is truly shared
- [x] Reusable task-level assumptions are logged in `tasks/s13-gym-layout-analytics/decisions.md`
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s13-gym-layout-analytics.md`
- `tasks/s13-gym-layout-analytics/README.md`
- `tasks/s13-gym-layout-analytics/execution.md`
- `tasks/s13-gym-layout-analytics/decisions.md`

## Module Hints
- `capstone-backend/src/gym-layout`
- `capstone-backend/src/fitness/pose`
- `capstone-backend/src/common`
- `capstone-backend/src/config`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review found that S13’s Redis pub/sub and `/gym-layout` gateway design currently conflicts with the shared contracts that limit Redis and WebSocket usage to narrower cases. The safest queue shape is to isolate that risk into its own task after the basic gym-layout CRUD surface exists, so the domain can still make progress even if this slice needs a policy decision.

Implementation plan:
- reuse the existing pose gateway as the closest socket-auth and namespace pattern
- add a dedicated gym-layout gateway plus service hooks for status snapshot and delta broadcast
- reconcile Redis key/pub-sub usage with the shared contracts before finalizing implementation
- log any reusable transport-policy decision in `decisions.md`, and update shared docs only if the rule is actually repo-wide

Expected files to touch:
- `capstone-backend/src/gym-layout/`
- possibly `agents/architecture.md` or `context/00-global-contracts.md` if a true shared rule changes
- `tasks/s13-gym-layout-analytics/decisions.md`

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S13 realtime transport slice by adding a dedicated `GymLayoutGateway`, Redis-backed status snapshot/delta flow, and socket auth that mirrors the existing pose gateway token model.

Key outcomes:
- added `/gym-layout` WebSocket namespace through `GymLayoutGateway`
- reused JWT socket auth with blacklist and account-status checks, matching the pose gateway pattern
- added Redis-backed status snapshot hydration through the `equipment_status` hash
- added Redis pub/sub fanout on `equipment:status` so gym-layout mutations publish realtime deltas
- extended the gym-layout service to publish create, update, and remove deltas without inventing a separate transport stack
- updated `context/00-global-contracts.md` so the shared Redis and WebSocket rules now explicitly include the approved S13 use case

Implementation notes:
- the gateway emits an initial `gym-layout.snapshot` payload on connect and forwards Redis deltas as `gym-layout.delta`
- delta payloads carry the current equipment response plus an `operation` field so remove events can be represented on the same channel

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed with task-scoped checks:
- `npm.cmd test -- --runInBand src/gym-layout`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- gym-layout unit tests passed: 5 suites, 24 tests
- Nest build passed
- lint check passed after one mechanical cleanup pass
- runtime API verification was not required for this task

MCPs used: serena, prismaLocal
