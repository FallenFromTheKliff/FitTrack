# TASK-706 - Pose Gateway And Pose Session Linking
**Task ID:** TASK-706
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-706-pose-gateway-and-pose-session-linking
**Created:** 2026-03-26
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-704, TASK-705
**Blocks:** TASK-707, TASK-708
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** stop if the WebSocket auth flow or the Python pose-analysis contract cannot be aligned with existing repo conventions
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the pose-detection WebSocket gateway and the persistence needed to link AI rep counting back to logged workout sets.

## Why
The pose flow is separate from the core HTTP session surface and should land only after the workout and AI plan foundations are stable.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] A dedicated WebSocket gateway handles authenticated pose connections
- [ ] A `pose_sessions` row is created on connect and finalized on disconnect
- [ ] Frame analysis calls go through a dedicated service boundary instead of controller-like inline logic
- [ ] The gateway streams rep-count updates back to the client without breaking on non-rep frames
- [ ] Logged exercise sets can link an owned `pose_session_id` safely
- [ ] Confidence and rep summary data persist back to the pose session on disconnect
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
- `capstone-backend/src/auth`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Review found that `TASK-706` was still missing the entire pose runtime surface: no WebSocket gateway, no socket-auth convention, no pose-session lifecycle persistence on connect/disconnect, and no `/pose/analyze` AI client boundary despite the schema and workout-set linkage points already existing.

Implementation plan:
- add a dedicated pose slice under `src/fitness/pose` with a gateway, service, repository, and module wiring through `FitnessModule`
- introduce a socket-auth path that mirrors JWT guard rules without inventing a separate auth contract for pose clients
- extend the Python AI client boundary with `/pose/analyze` so frame analysis stays out of the gateway
- persist `pose_sessions` on connect/disconnect and stream rep-count updates only when the AI response indicates a rep event
- verify with focused gateway/service/repository tests plus full build, lint, and Jest coverage
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the pose slice under `capstone-backend/src/fitness/pose/`.

Delivered behavior:
- authenticated `/pose` WebSocket gateway
- persisted `pose_sessions` lifecycle with connect/disconnect finalization
- Python AI `/pose/analyze` client boundary
- streamed rep-count updates and safe pose-session linkage for logged workout sets

Implementation notes:
- added `PoseGateway`, `PoseService`, `PoseRepository`, and `PoseModule`, then wired the new module through `FitnessModule`
- mirrored the HTTP JWT guard rules for sockets by accepting bearer tokens from handshake auth, headers, or query params, then checking JWT validity, blacklist state, and active-user status
- created pose-session rows on successful connect, tracked per-socket session state in memory, and finalized `ended_at`, `rep_count_ai`, and averaged confidence on disconnect
- extended `AiPythonClientService` with a dedicated `/pose/analyze` call so frame-analysis logic stays behind a reusable outbound service boundary
- kept gateway streaming resilient by only incrementing and emitting rep counts when the AI response marks a rep event, while non-rep frames return quietly without breaking the connection
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`

Results:
- build passed
- lint passed
- full repo suite passed: 65 suites, 346 tests
- runtime API verification not required for this task
MCPs used: serena, prismaLocal
