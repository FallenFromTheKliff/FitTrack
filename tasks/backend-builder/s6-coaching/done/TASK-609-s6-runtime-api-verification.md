# TASK-609 - S6 Runtime API Verification
**Task ID:** TASK-609
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-609-s6-runtime-api-verification
**Created:** 2026-03-25
**Completed:** 2026-03-26
**Priority:** P2
**Depends On:** TASK-608
**Blocks:** none
**Auto-Eligible:** no
**Decision Flags:** none
**Stop If:** hard stop file is detected before runtime verification starts
**Escalation Notes:** stop if build, relevant tests, or lint are not green before the Swagger flow begins
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** swagger | serena

---

## What
Run the live S6 API verification flow after code-level checks pass.

## Why
This is the final contract check for the coaching HTTP surface and should stay separate from normal build and test execution.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] `tasks/api-verification-driver.md` completes successfully for the S6 routes
- [x] Runtime API findings are either fixed or documented before the task closes
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s6-coaching.md`
- `tasks/s6-coaching/README.md`
- `tasks/s6-coaching/execution.md`
- `tasks/s6-coaching/decisions.md`

## Module Hints
- `capstone-backend/src/coaching`
- `capstone-backend/test`

## Task Size
- [x] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
- Treat this task as a pure verification slice: re-check the S6 contract from `context/s6-coaching.md`, the active controllers/DTOs under `src/coaching`, and the separate API verification driver before touching queue state.
- Confirm the local database is on the expected migration baseline before any Swagger/runtime work, because `tasks/s6-coaching/execution.md` explicitly calls out the S4 and S6 guard migrations as a prerequisite for this task.
- If build, Jest, e2e, and lint are green and the local DB is aligned, run the separate runtime driver against the S6 coaching surface:
  - `GET /v1/coaching/coaches`
  - `GET /v1/coaching/coaches/{id}`
  - `PATCH /v1/coaching/coaches/me`
  - `PATCH /v1/coaching/coaches/{id}`
  - `POST /v1/coaching/coaches/availability`
  - `POST /v1/coaching/appointments`
  - `GET /v1/coaching/appointments/my`
  - `PATCH /v1/coaching/appointments/{id}/respond`
  - `PATCH /v1/coaching/appointments/{id}/cancel`
  - `POST /v1/coaching/appointments/{id}/pay`
  - `POST /v1/coaching/appointments/{id}/balance`
  - `PATCH /v1/coaching/appointments/{id}/complete`
  - `POST /v1/coaching/relationships`
  - `GET /v1/coaching/relationships/my`
  - `GET /v1/coaching/clients`
  - `PATCH /v1/coaching/relationships/{id}`
  - `POST /v1/coaching/coaches/{id}/reviews`
- Stop instead of starting Swagger if the DB is still behind the checked-in guard migrations, because this task's queue note requires that migration-state confirmation before the live pass begins.
MCPs used: prismaLocal, swagger

---

## CODER OUTPUT
- No application code changes were made in this run.
- This task is the dedicated runtime-verification slice, so the implementation remained unchanged while the preconditions were revalidated.
MCPs used: none

---

## TESTER REPORT
- Earlier retries on 2026-03-26 confirmed the code-level gates and corrected the local migration baseline:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand`
  - `npm.cmd run lint:check`
- `prismaLocal migrate status` reports `6 migrations found in prisma/migrations` and `Database schema is up to date!`.
- `http://localhost:3000/v1/docs-json` was reachable during this run, so Swagger inspection could proceed against the live local backend without another startup workaround.
- Swagger confirmed the full S6 route surface for:
  - `GET /v1/coaching/coaches`
  - `GET /v1/coaching/coaches/{id}`
  - `PATCH /v1/coaching/coaches/me`
  - `PATCH /v1/coaching/coaches/{id}`
  - `POST /v1/coaching/coaches/availability`
  - `POST /v1/coaching/appointments`
  - `GET /v1/coaching/appointments/my`
  - `PATCH /v1/coaching/appointments/{id}/respond`
  - `PATCH /v1/coaching/appointments/{id}/cancel`
  - `POST /v1/coaching/appointments/{id}/pay`
  - `POST /v1/coaching/appointments/{id}/balance`
  - `PATCH /v1/coaching/appointments/{id}/complete`
  - `POST /v1/coaching/relationships`
  - `GET /v1/coaching/relationships/my`
  - `GET /v1/coaching/clients`
  - `PATCH /v1/coaching/relationships/{id}`
  - `POST /v1/coaching/coaches/{id}/reviews`
- Live OpenAPI findings from the S6 verification pass:
  - `POST /v1/coaching/appointments/{id}/pay` is missing the required `Idempotency-Key` header from the Swagger contract even though the controller reads it and the service validates it.
  - `PATCH /v1/coaching/coaches/me` exposes `gym_commission_pct` in `UpdateCoachProfileDTO`, but the service rejects that field for coach-owned updates with `403`; the live request schema overstates what the route accepts.
  - `POST /v1/coaching/coaches/availability` and `PATCH /v1/coaching/appointments/{id}/cancel` publish success descriptions without explicit response schemas, so the live Swagger surface underdocuments the shared `{ data, meta? }` response envelope for those routes.
- No runtime finding in this pass indicated a secret-field leak or a missing S6 endpoint.
- Because the current API verification driver is findings-only, no application code was changed in this execution. The follow-up implementation slice is queued as `TASK-610`.
MCPs used: prismaLocal, swagger
