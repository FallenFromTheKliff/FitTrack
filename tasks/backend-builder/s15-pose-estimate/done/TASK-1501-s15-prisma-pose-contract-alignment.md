# TASK-1501 - S15 Prisma Pose Contract Alignment
**Task ID:** TASK-1501
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1501-s15-prisma-pose-contract-alignment
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1502, TASK-1503, TASK-1504, TASK-1505, TASK-1506
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S15 context requires replacing the existing S7 `pose_session_id` workout-log linkage instead of extending it compatibly
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Align the Prisma layer for S15 by adding the missing pose profile model, enum, relations, and extended pose-session fields required by the Python microservice contract.

## Why
The current repo already persists minimal pose sessions and links them into S7 workout logs, but the S15 design depends on a richer persistence contract that both the Nest and Python slices can target consistently.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `PoseExerciseProfile` and `PoseProfileKind` exist in Prisma with the context-defined core fields and indexes
- [x] `PoseSession` gains the missing S15 persistence fields required for detected exercise, matched profile, confidence values, and analysis summary
- [x] The existing `exercise_log_id` pose-session linkage used by S7 remains intact and compatible
- [x] Any repository-facing or DTO-facing selections that depend on the new Prisma fields are updated without breaking existing pose-session consumers
- [x] Focused Prisma or repository coverage exists for the new contract shape where the repo already has relevant tests
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
- `capstone-backend/prisma`
- `capstone-backend/src/fitness/pose`
- `capstone-backend/src/fitness/session`
- `capstone-backend/src/ai`

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
- keep the S15 Prisma work additive
- preserve the existing `PoseSession.exercise_log_id` one-to-one S7 linkage
- do not pull HTTP routes, DTOs, Python client methods, or WebSocket lifecycle changes into this slice

Concrete implementation plan:
1. Extend `capstone-backend/prisma/schema.prisma` with the missing S15 persistence contract:
   - add `PoseProfileKind`
   - add `PoseExerciseProfile`
   - add the nullable S15 extension fields to `PoseSession`
   - add the `PoseSession.pose_profile` relation and the reverse `ExerciseCatalog.pose_profiles` relation
2. Add the checked-in Prisma migration files for the new table, enum, nullable columns, relation, and indexes:
   - create the new `pose_exercise_profiles` table
   - add `detected_exercise_name`, `detected_profile_id`, `classification_confidence`, `subject_lock_confidence`, and `analysis_summary` to `pose_sessions`
   - keep the existing `exercise_log_id` unique constraint untouched
   - do not run `prisma migrate dev` in this task flow
3. Regenerate Prisma client artifacts after the schema edit so TypeScript types match the new model surface.
4. Update only the minimal Nest code paths that depend on Prisma-generated types or pose-session selections:
   - keep `capstone-backend/src/fitness/pose/pose.repository.ts` focused on the existing create/finalize fields
   - keep `capstone-backend/src/fitness/session/session.repository.ts` ownership and log-link checks working without broadening the task into later S15 reads
   - avoid introducing new service or controller behavior in this slice
5. Add or adjust focused tests only where this schema slice changes compile-time or repository expectations:
   - `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
   - `capstone-backend/src/fitness/session/session.repository.spec.ts` if selection typings or linked-pose updates need adjustment
6. Verify with the smallest useful set before handing off:
   - regenerate Prisma client
   - run the relevant pose/session repository specs
   - run `npm.cmd run build`
   - run `npm.cmd run lint:check`

Expected files to touch:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/<new_migration>/migration.sql`
- `capstone-backend/src/fitness/pose/pose.repository.ts`
- `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
- `capstone-backend/src/fitness/session/session.repository.ts`
- `capstone-backend/src/fitness/session/session.repository.spec.ts`

Implementation constraints:
- all new S15 fields on `PoseSession` should stay nullable so current pose session creation and disconnect finalization remain backward-compatible
- `PoseExerciseProfile.exercise_id` should reference `ExerciseCatalog` and support inactive or null-linked seed profiles
- reserve any finalize-time persistence of `detected_*` fields and learned-profile writes for later tasks

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the additive S15 Prisma contract slice without broadening into later HTTP or Python lifecycle work.

Key outcomes:
- added `PoseProfileKind` and `PoseExerciseProfile` to `prisma/schema.prisma`
- extended `PoseSession` with nullable S15 classification fields: `detected_exercise_name`, `detected_profile_id`, `classification_confidence`, `subject_lock_confidence`, and `analysis_summary`
- preserved the existing `PoseSession.exercise_log_id` one-to-one S7 linkage unchanged
- added the reverse `ExerciseCatalog.pose_profiles` relation required by the new optional pose-profile foreign key
- added a checked-in migration at `prisma/migrations/20260329121500_s15_pose_contract_alignment/migration.sql`
- added focused repository coverage proving the S7 pose-session ownership lookup still uses the narrow existing select surface
- regenerated Prisma Client so the local TypeScript build uses the new generated types

Files changed for this slice:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/20260329121500_s15_pose_contract_alignment/migration.sql`
- `capstone-backend/src/fitness/session/session.repository.spec.ts`

Checks run during implementation:
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/fitness/pose/pose.repository.spec.ts src/fitness/session/session.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified `TASK-1501` against the aligned local Prisma state and closed the task.

Verification outcomes:
- Prisma Local initially reported one unapplied checked-in migration: `20260329121500_s15_pose_contract_alignment`
- applied that migration locally with `npx.cmd prisma migrate deploy` under the shared `auto_apply_checked_in` guard rule
- confirmed with Prisma Local that the local database schema is now up to date
- rechecked the changed surface in `schema.prisma` and the focused repository spec coverage for the preserved S7 ownership lookup

Checks run during test:
- `npx.cmd prisma migrate deploy`
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/fitness/pose/pose.repository.spec.ts src/fitness/session/session.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- checked-in local migration applied successfully
- Prisma Local status: database schema is up to date
- focused repository test suites: 2 passed, 10 tests passed
- build passed
- lint passed

Task closeout notes:
- no extra e2e run was needed for this additive Prisma and repository slice because it did not introduce HTTP surface changes
- the task stop condition was not hit; the existing S7 `pose_session_id` linkage remained intact

MCPs used: serena, prismaLocal
