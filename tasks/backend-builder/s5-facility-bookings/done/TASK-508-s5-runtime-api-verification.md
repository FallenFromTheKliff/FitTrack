# TASK-508 - S5 Runtime API Verification
**Task ID:** TASK-508
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-508-s5-runtime-api-verification
**Created:** 2026-03-24
**Completed:** 2026-03-25
**Priority:** P2
**Depends On:** TASK-507
**Blocks:** none
**Auto-Eligible:** no
**Decision Flags:** none
**Stop If:** the backend cannot be started locally or the generated Swagger surface diverges from the implemented S5 route contract
**Escalation Notes:** ask only if runtime verification is blocked by missing environment/runtime services or a contract mismatch that needs a product decision
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** swagger, serena

---

## What
Verify the completed S5 routes against the running backend with the separate API verification driver.

## Why
The facility-booking surface includes auth, validation, routing, and middleware behavior that final code-level tests cannot fully replace.

## Acceptance Criteria
- [x] Run `Read tasks/api-verification-driver.md and follow it.` after build, relevant tests, and `npm.cmd run lint:check` pass.
- [x] Validate live amenity, availability, booking create/cancel/history, and balance endpoints against Swagger docs.
- [x] Capture runtime-only mismatches in auth, DTO validation, or response shaping.
- [x] Document any remaining provider or environment gaps clearly.
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
- `context/s5-facility-bookings.md`
- `tasks/s5-facility-bookings/README.md`
- `tasks/s5-facility-bookings/execution.md`
- `tasks/s5-facility-bookings/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/bookings`
- `capstone-backend/src/membership/payment`
- `capstone-backend/test`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes`

---

## PLANNER OUTPUT
- Keep this task separate so Swagger MCP is only used after the backend is running and the `TASK-507` code checks have already passed: `npm.cmd run build`, `npm.cmd test -- --runInBand`, `npm.cmd run test:e2e -- --runInBand`, and `npm.cmd run lint:check`.
- Before starting the live pass, update `tasks/api-verification-driver.md` session variables to S5 values: `DOMAIN_FOLDER=tasks/s5-facility-bookings`, `DOMAIN_CONTEXT_FILE=context/s5-facility-bookings.md`, `CURRENT_TASK_FILE=tasks/s5-facility-bookings/backlog/TASK-508-s5-runtime-api-verification.md`, `API_VERIFICATION_SCOPE=S5 booking and amenity routes`, plus the real running `APP_BASE_URL` and `OPENAPI_URL`.
- Verify the backend is reachable first, then inspect the live OpenAPI surface for these endpoints:
  - `GET /v1/bookings/amenities`
  - `GET /v1/bookings/amenities/{id}`
  - `POST /v1/bookings/amenities`
  - `PATCH /v1/bookings/amenities/{id}`
  - `DELETE /v1/bookings/amenities/{id}`
  - `GET /v1/bookings/amenities/availability`
  - `POST /v1/bookings/amenity`
  - `GET /v1/bookings/amenity/my`
  - `PATCH /v1/bookings/amenity/{id}/cancel`
  - `GET /v1/bookings/amenity`
  - `POST /v1/bookings/amenity/{id}/balance`
- Check runtime contract details, not implementation internals:
  - auth boundaries: public vs JWT vs admin/staff
  - response envelope shape: `{ data, meta? }`
  - Swagger parameter exposure for path/query/body and `Idempotency-Key`
  - DTO validation behavior for invalid UUIDs, date formats, provider values, and cash-only balance fields
  - route precedence for `/v1/bookings/amenities/availability` versus `/v1/bookings/amenities/:id`
- Prefer disposable local verification data:
  - create a temporary amenity during the live pass for admin CRUD checks
  - prefer a free amenity booking for a success-path create/cancel/history check because it avoids external checkout dependencies
  - treat paid booking create/balance success as optional if PayMongo or staff runtime prerequisites are unavailable locally; in that case, verify auth/validation/precondition behavior and document the remaining provider/environment gap explicitly
- If the backend is not running, Swagger JSON is unreachable, or provider-backed success paths cannot be exercised safely, stop and report those as runtime blockers rather than reopening implementation in this task.
MCPs used: serena

---

## CODER OUTPUT
- Runtime verification exposed a sensitive-field leak on `GET /v1/bookings/amenity`: the admin/staff booking list was returning `user.qr_code_token` because `BookingRepository` included the full nested `user` record.
- Tightened `capstone-backend/src/bookings/booking/booking.repository.ts` to use a safe nested user projection for admin booking reads, preserving the profile data needed by staff/admin screens while excluding `qr_code_token`.
- Added a focused repository regression test in `capstone-backend/src/bookings/booking/booking.repository.spec.ts` so future changes cannot silently reintroduce that token into booking list responses.
- Updated `tasks/api-verification-driver.md` to prefer the stable non-watch startup command `npm.cmd run start` for unattended verification, and documented the inline auto-start pattern for environments where detached background processes do not persist reliably.
MCPs used: none

---

## TESTER REPORT
- Rechecked the runtime-fix slice with `npm.cmd test -- booking.repository --runInBand`, `npm.cmd run build`, and `npm.cmd run lint:check`; all passed on 2026-03-25.
- Ran the live S5 verification with the separate API driver by auto-starting the backend inline through `npm.cmd run start`, waiting for `http://localhost:3000/v1/docs-json`, exercising the S5 endpoints, then stopping the process at the end of the pass.
- Swagger/OpenAPI confirmed the full S5 route surface: `GET /v1/bookings/amenities`, `GET /v1/bookings/amenities/{id}`, `POST /v1/bookings/amenities`, `PATCH /v1/bookings/amenities/{id}`, `DELETE /v1/bookings/amenities/{id}`, `GET /v1/bookings/amenities/availability`, `POST /v1/bookings/amenity`, `GET /v1/bookings/amenity/my`, `PATCH /v1/bookings/amenity/{id}/cancel`, `GET /v1/bookings/amenity`, and `POST /v1/bookings/amenity/{id}/balance`.
- Live HTTP checks confirmed:
  - public amenity listing returns the shared `{ data }` envelope
  - single-amenity and availability routes enforce JWT with `401` when unauthenticated
  - amenity create/update/delete enforce admin-only access
  - availability returns 48 UTC half-hour slots and the static `/amenities/availability` route wins over `/amenities/:id`
  - free booking creation succeeds with `201`, requires `Idempotency-Key`, and returns `{ booking_id, status, checkout_url }`
  - member booking history and staff booking list both return `{ data, meta }`
  - member access to the admin/staff booking list is rejected with `403`
  - member access to the balance endpoint is rejected with `403`
  - staff balance initiation on a free booking returns the expected `422 No Outstanding Balance` business-rule response
  - the admin/staff booking list no longer exposes `qr_code_token`
- Remaining runtime note: this verification intentionally used a disposable free-amenity booking path, so PayMongo checkout success was not exercised live in this pass. The paid-path auth, routing, and DTO contract were still validated through Swagger plus route-level runtime checks.
MCPs used: swagger
