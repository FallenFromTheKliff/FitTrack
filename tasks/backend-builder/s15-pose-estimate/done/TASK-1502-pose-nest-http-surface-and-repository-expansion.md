# TASK-1502 - Pose Nest HTTP Surface And Repository Expansion
**Task ID:** TASK-1502
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1502-pose-nest-http-surface-and-repository-expansion
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1501
**Blocks:** TASK-1503, TASK-1504, TASK-1505, TASK-1506
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the pose HTTP response shape or the member-vs-admin access model conflicts with the S15 context contracts
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Expand the Nest pose module with the missing DTOs, repository helpers, Python client methods, and authenticated HTTP endpoints for manual finalize, session reads, and profile listing.

## Why
S15 is not only a WebSocket feature; the design also requires explicit HTTP surfaces for fallback finalization, historical session reads, and admin profile inspection before the Python integration can be verified end to end.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] DTOs exist for `FinalizePoseSessionDTO`, `PoseProfileFilterDTO`, and the required pose-session/profile response contracts
- [x] Authenticated Nest routes exist for `POST /v1/pose/sessions/:id/finalize`, `GET /v1/pose/sessions/:id`, and `GET /v1/pose/profiles`
- [x] Role guards and ownership checks match the S15 context (`JWT` member reads, `Admin` profile listing)
- [x] `AiPythonClientService` exposes validated bootstrap and finalize request helpers in addition to pose analysis
- [x] Repository and service layers own the query and persistence logic instead of controllers calling Prisma directly
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
- `context/python/00-python-microservice-contracts.md`
- `context/python/s15-pose-estimate.md`
- `tasks/s15-pose-estimate/README.md`
- `tasks/s15-pose-estimate/execution.md`
- `tasks/s15-pose-estimate/decisions.md`

## Module Hints
- `capstone-backend/src/fitness/pose`
- `capstone-backend/src/ai`
- `capstone-backend/src/fitness/session`
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
Scope guard for this task:
- keep `TASK-1502` inside the NestJS codebase
- add the missing HTTP controller, DTOs, repository reads, and Python client helpers
- do not scaffold the FastAPI service here
- do not rewire the live WebSocket lifecycle, latest-frame-wins handling, or socket finalize events here; leave that to `TASK-1504`

Concrete implementation plan:
1. Add the pose HTTP DTO surface in `capstone-backend/src/fitness/pose/dto/pose.dto.ts`:
   - `FinalizePoseSessionDTO`
   - `PoseProfileFilterDTO`
   - response DTOs for pose-session reads and admin profile listing
   - reuse the repo's Swagger and validation style, including the existing `PaginationDTO` pattern for profile listing filters
2. Add `capstone-backend/src/fitness/pose/pose.controller.ts` and wire it in `pose.module.ts`:
   - `POST /v1/pose/sessions/:id/finalize` guarded by `JwtAuthGuard`
   - `GET /v1/pose/sessions/:id` guarded by `JwtAuthGuard`
   - `GET /v1/pose/profiles` guarded by `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.admin)`
   - use the existing controller pattern from the workout-session and exercise modules: thin methods, `ParseUUIDPipe`, Swagger response envelopes, and DTO-driven params/query handling
3. Expand `capstone-backend/src/fitness/pose/pose.repository.ts` with read and list helpers that match the current S15 schema:
   - add a pose-session summary read by id with the current persisted fields plus the nullable S15 classification fields
   - add a profile listing query using `this.paginate(...)`, filtering by `canonical_name` and `profile_kind`
   - keep the existing create and disconnect-finalize methods intact so the current gateway flow stays backward-compatible
4. Expand `capstone-backend/src/fitness/pose/pose.service.ts` with HTTP-facing orchestration methods:
   - `getPoseSessionById(userId, sessionId)`
   - `finalizePoseSessionById(userId, sessionId, dto)`
   - `listPoseProfiles(dto)`
   - manual finalize should validate ownership through the pose-session record, reuse the current persisted aggregate fields, and return the new pose-session response DTO shape
   - accept `ended_reason` for contract parity but do not widen persistence just to store it in this task
5. Expand `capstone-backend/src/ai/ai-python-client.service.ts` with typed helpers for the missing S15 Python contracts:
   - add bootstrap and finalize request and response types
   - add `bootstrapPoseSession(...)` and `finalizePoseSession(...)`
   - validate the response payloads like the existing AI client methods do
   - do not switch the gateway analyze flow to the new session-keyed contract yet; that lifecycle integration belongs to `TASK-1504`
6. Add focused tests for the new Nest-side surface:
   - `pose.controller.spec.ts` for guard shape and service delegation
   - `pose.service.spec.ts` for ownership checks, manual finalize behavior, and profile list orchestration
   - `pose.repository.spec.ts` for session-summary reads and profile-list query filters
   - `ai-python-client.service.spec.ts` for bootstrap and finalize request/response validation
7. Verify with the smallest useful task-sized set:
   - relevant pose and AI unit specs
   - `npm.cmd run build`
   - `npm.cmd run lint:check`
   - reserve runtime API verification for `TASK-1506`

Expected files to touch:
- `capstone-backend/src/fitness/pose/dto/pose.dto.ts`
- `capstone-backend/src/fitness/pose/pose.controller.ts`
- `capstone-backend/src/fitness/pose/pose.controller.spec.ts`
- `capstone-backend/src/fitness/pose/pose.module.ts`
- `capstone-backend/src/fitness/pose/pose.repository.ts`
- `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
- `capstone-backend/src/fitness/pose/pose.service.ts`
- `capstone-backend/src/fitness/pose/pose.service.spec.ts`
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai-python-client.service.spec.ts`

Implementation constraints:
- keep the public response shape additive and safe: no secrets, no unrelated user payloads, and nullable S15 classification fields must remain nullable until the later lifecycle task populates them
- keep admin profile listing paginated and filterable instead of exposing an unbounded dump
- do not introduce a new auth model for pose; follow the existing member-owned read and admin-only listing pattern already used elsewhere in the repo

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the Nest-side S15 pose HTTP surface and additive Python client helpers without pulling in the later live lifecycle rewiring work.

Key outcomes:
- added `pose.controller.ts` and `pose/dto/pose.dto.ts` for the missing authenticated HTTP surface:
  - `GET /pose/sessions/:id`
  - `POST /pose/sessions/:id/finalize`
  - `GET /pose/profiles`
- wired the new controller into `pose.module.ts`
- expanded `PoseRepository` with pose-session summary reads and paginated profile listing
- expanded `PoseService` with owned pose-session reads, manual finalize-by-id, and paginated profile mapping while keeping the existing gateway flow intact
- expanded `AiPythonClientService` with validated `bootstrapPoseSession(...)` and `finalizePoseSession(...)` helpers and additive pose-response typing
- added focused controller, service, repository, and AI client coverage for the new surface

Files changed for this slice:
- `capstone-backend/src/fitness/pose/dto/pose.dto.ts`
- `capstone-backend/src/fitness/pose/pose.controller.ts`
- `capstone-backend/src/fitness/pose/pose.controller.spec.ts`
- `capstone-backend/src/fitness/pose/pose.module.ts`
- `capstone-backend/src/fitness/pose/pose.repository.ts`
- `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
- `capstone-backend/src/fitness/pose/pose.service.ts`
- `capstone-backend/src/fitness/pose/pose.service.spec.ts`
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai-python-client.service.spec.ts`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/fitness/pose/pose.controller.spec.ts src/fitness/pose/pose.service.spec.ts src/fitness/pose/pose.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd run build`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified the completed `TASK-1502` surface and closed the task.

Verification outcomes:
- confirmed the new pose HTTP surface exists in the Nest module:
  - owned pose-session read
  - owned manual finalize
  - admin-only profile listing
- confirmed the new DTO surface exists and matches the S15 contract shape closely enough for this additive Nest slice
- confirmed the repository and service layers own the new read, finalize, and profile-list logic rather than controllers calling Prisma directly
- confirmed the AI client now exposes validated bootstrap and finalize helpers in addition to pose analysis
- confirmed the focused controller, service, repository, and AI client specs cover the new surface

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/fitness/pose/pose.controller.spec.ts src/fitness/pose/pose.service.spec.ts src/fitness/pose/pose.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused verification suites: 4 passed, 31 tests passed
- build passed
- lint passed

Task closeout notes:
- no extra e2e or runtime API verification was required in this task because the domain queue reserves live endpoint verification for `TASK-1506`
- the task stop condition was not hit; the member-vs-admin access model aligned with existing repo patterns and the S15 contract

MCPs used: serena, prismaLocal
