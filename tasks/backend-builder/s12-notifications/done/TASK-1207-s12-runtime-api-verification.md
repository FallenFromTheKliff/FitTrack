# TASK-1207 - S12 Runtime API Verification
**Task ID:** TASK-1207
**Domain:** S12 - Notifications
**Status:** done
**Branch:** feat/TASK-1207-s12-runtime-api-verification
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P2
**Depends On:** TASK-1206
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** hard stop file is detected before runtime verification starts
**Escalation Notes:** stop if build, relevant tests, or lint are not green before the Swagger flow begins
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** swagger | serena

---

## What
Run the live S12 API verification flow after code-level checks pass.

## Why
This is the final contract check for the S12 HTTP surface and should stay separate from normal build and test execution.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] `tasks/api-verification-driver.md` completes successfully for the S12 routes
- [x] Runtime API findings are either fixed or documented before the task closes
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s12-notifications.md`
- `tasks/s12-notifications/README.md`
- `tasks/s12-notifications/execution.md`
- `tasks/s12-notifications/decisions.md`

## Module Hints
- `capstone-backend/src/notifications`
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
The S12 code-level checks are already green, so this final slice should stay narrowly focused on the live contract pass and the verification-driver handoff. The main planning blocker is procedural rather than architectural: `tasks/api-verification-driver.md` still points at the old S11 AI scope, so the implementation step for this task must rewrite that driver to the notifications surface before running Swagger.

Implementation plan:
- treat `TASK-1207` as a pure runtime-verification slice
  - do not add endpoints, DTOs, or new notification behavior unless the live pass reveals a concrete contract mismatch
  - keep any fixes, if needed, narrowly scoped to Swagger/controller/DTO parity rather than reopening S12 feature work
- rewrite `tasks/api-verification-driver.md` session variables from S11 to S12 before starting the live pass
  - `DOMAIN_FOLDER`, `DOMAIN_CODE`, `DOMAIN_NAME`, and `DOMAIN_CONTEXT_FILE` -> S12 values
  - `CURRENT_TASK_FILE` -> `tasks/s12-notifications/active/TASK-1207-s12-runtime-api-verification.md`
  - `API_VERIFICATION_SCOPE` -> the S12 notifications routes:
    - `GET /v1/notifications/my`
    - `GET /v1/notifications/unread-count`
    - `PATCH /v1/notifications/{id}/read`
    - `PATCH /v1/notifications/read-all`
    - `DELETE /v1/notifications/{id}`
    - `GET /v1/notifications/preferences`
    - `PATCH /v1/notifications/preferences`
  - `REQUIRED_CHECKS_PASSED` should point at the current green S12 preconditions:
    - `npm.cmd run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
    - `npm.cmd run build`
    - `npm.cmd run lint:check`
  - `MODULE_HINTS` -> `capstone-backend/src/notifications` and `capstone-backend/test`
- preserve the existing backend runtime defaults unless the live pass proves they no longer boot the correct local backend
  - primary startup remains `npm.cmd run start`
  - fallback remains `npm.cmd run start:dev`
  - keep `APP_BASE_URL` / `OPENAPI_URL` on the local `:3000` surface unless runtime conditions force a fresh port during verification
- use the separate API verification driver as the actual execution path for this task
  - verify OpenAPI reachability
  - inspect the live S12 notification endpoints with Swagger MCP
  - compare the live docs against:
    - `context/s12-notifications.md`
    - `src/notifications/notifications.controller.ts`
    - `src/notifications/dto/notification.dto.ts`
    - `src/notifications/dto/notification-preferences.dto.ts`
    - the shared response/auth expectations in `context/00-global-contracts.md`
- make the live verification checklist explicit so the runtime pass stays focused
  - bearer auth declared on all seven routes
  - `{id}` path params documented as UUID-shaped strings on read/delete routes
  - inbox query params expose `page`, `limit`, and `unread_only`
  - success responses keep the shared `{ data, meta? }` envelope
  - `NotificationResponseDTO` nullable fields such as `data`, `sent_at`, `read_at`, and `error` are represented correctly
  - preferences response/update schemas expose the expanded S12 preference matrix through `/v1/notifications/preferences`
- if the live Swagger pass reveals a mismatch, stop and report it through this task instead of fixing code inside the API verification driver itself
  - in the subsequent implementation phase for this domain task, only make the smallest parity fix needed and rerun the live pass

MCPs used: serena

---

## CODER OUTPUT
Implemented the runtime-verification handoff and fixed the one real app-start issue that blocked the live pass.

- Rewrote `tasks/api-verification-driver.md` from the old S11 AI scope to the S12 notifications scope:
  - `DOMAIN_FOLDER`, `DOMAIN_CODE`, `DOMAIN_NAME`, `DOMAIN_CONTEXT_FILE`
  - `CURRENT_TASK_FILE`
  - `API_VERIFICATION_SCOPE`
  - `REQUIRED_CHECKS_PASSED`
  - `MODULE_HINTS`
- The first live startup attempt exposed a Nest module-cycle blocker instead of a Swagger mismatch:
  - `UserModule -> MembershipModule -> NotificationsModule -> UserModule`
- Fixed that cycle with module-level `forwardRef()` imports in:
  - `capstone-backend/src/user/user.module.ts`
  - `capstone-backend/src/membership/membership.module.ts`
  - `capstone-backend/src/notifications/notifications.module.ts`
- Re-ran the required S12 verification gates after the fix:
  - `npm.cmd run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`

MCPs used: serena

---

## TESTER REPORT
Runtime verification is green.

Preconditions rechecked:
- `npm.cmd run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Live verification notes:
- The backend would not boot initially because Nest could not resolve the S12 module-import cycle; after the `forwardRef()` fix, the backend reached the live OpenAPI surface successfully on `http://localhost:3000/v1/docs-json`.
- The first automated verification run had to compare against a supervised shell capture of the same live `/v1/docs-json` payload because Swagger MCP could not reach the local backend from its tool runtime at that moment.
- A final rerun with the backend started manually by the operator confirmed that Swagger MCP can now fetch the live S12 docs directly and resolves the seven notifications operations successfully.
- The live S12 notifications routes present in the OpenAPI payload were:
  - `GET /v1/notifications/my`
  - `GET /v1/notifications/unread-count`
  - `PATCH /v1/notifications/{id}/read`
  - `PATCH /v1/notifications/read-all`
  - `DELETE /v1/notifications/{id}`
  - `GET /v1/notifications/preferences`
  - `PATCH /v1/notifications/preferences`
- The live contract matched the S12 controller/DTO expectations:
  - bearer auth is declared on all seven routes through the `access-token` HTTP bearer scheme
  - `{id}` params on read/delete routes are documented as UUID-shaped strings
  - inbox query params expose `page`, `limit`, and `unread_only`
  - success responses use the shared `{ data, meta? }` envelope
  - `NotificationResponseDTO` keeps `data`, `sent_at`, `read_at`, and `error` nullable in the live schema
  - `/v1/notifications/preferences` exposes the expanded preference matrix and PATCH request schema correctly
- No secret-field leak or missing/extra S12 notifications endpoint was found in the live OpenAPI payload.

MCPs used: serena, swagger
