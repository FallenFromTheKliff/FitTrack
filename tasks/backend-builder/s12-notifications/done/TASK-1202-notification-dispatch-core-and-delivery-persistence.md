# TASK-1202 - Notification Dispatch Core And Delivery Persistence
**Task ID:** TASK-1202
**Domain:** S12 - Notifications
**Status:** done
**Branch:** feat/TASK-1202-notification-dispatch-core-and-delivery-persistence
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** TASK-1201
**Blocks:** TASK-1204, TASK-1205, TASK-1206, TASK-1207
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if queue-processor changes require a broader delivery-contract redesign than passing notification ids and status updates through the current Bull processors
**Escalation Notes:** stop if email and SMS delivery status cannot be persisted with the current `Notification` model without adding new fields or a second table
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the centralized `NotificationService.dispatch()` path that always creates `in_app` notifications and persists email/SMS delivery records before queue fan-out.

## Why
S12 is currently fragmented across domain-local queue calls, so later listener consolidation depends on one shared dispatch contract and delivery-persistence seam.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `NotificationService.dispatch()` exists with typed notification-type and payload inputs
- [x] Dispatch always creates an `in_app` notification record first
- [x] Email and SMS fan-out create persisted notification rows and enqueue through the existing Bull mail/SMS processors
- [x] Delivery-success and delivery-failure paths update persisted notification status safely
- [x] The new dispatch seam is test-covered without regressing existing queue processors
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
- `context/s12-notifications.md`
- `tasks/s12-notifications/README.md`
- `tasks/s12-notifications/execution.md`
- `tasks/s12-notifications/decisions.md`

## Module Hints
- `capstone-backend/src/notifications`
- `capstone-backend/src/queue`
- `capstone-backend/src/mail`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [x] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
`TASK-1201` already established the inbox/read surface, and local Prisma state is clean, so this slice can stay focused on the shared dispatch seam and persisted delivery status without touching schema or yet migrating every domain listener. The current repo reality is Bull plus `mail`/`sms` processors that only send and log, while multiple lifecycle services still enqueue generic mail/SMS directly. The `Notification` model already has the fields needed for this task: `channel`, `status`, `sent_at`, and `error`.

Implementation plan:
- extend `src/notifications/` from inbox-only into the shared dispatch owner:
  - keep the current controller/repository/service surface
  - add typed dispatch contracts for `dispatch(userId, type, payload)` plus channel-specific content and optional JSON data
  - add reusable notification event constants/types for delivery success/failure acknowledgements
- add a user-owned dispatch-context read seam through `UserService` and `UserRepository` instead of duplicating Prisma access inside notifications:
  - preferred email from the first `email`/`google` auth identity
  - preferred phone from the `phone` identity
  - `phone_verified_at`
  - the currently implemented `NotificationPreference` flags
- keep preference scope aligned to current schema reality in this task:
  - support email/SMS preference gating only for the notification types that already have backing fields today
  - create `in_app` only for other notification types until `TASK-1203` expands preference coverage
  - treat SMS eligibility as current-schema high-priority only and require a verified phone identity
- expand `NotificationsRepository` with transaction-safe write helpers for:
  - creating notification rows
  - creating the always-on `in_app` row first
  - creating persisted `email`/`sms` rows as `pending`
  - marking a notification `sent` with `sent_at`
  - marking a notification `failed` with `error`
- implement `NotificationsService.dispatch()` so it:
  - resolves dispatch context from `UserService`
  - decides which channels are eligible from current prefs and available destinations
  - inserts `in_app` plus any `email`/`sms` rows in one transaction
  - enqueues only after the transaction commits
  - passes the persisted notification id in generic queue job metadata
- update generic queue payloads and processors in a backward-compatible way:
  - add optional notification metadata to `SendGenericMailJobData` and `SendGenericSmsJobData`
  - leave OTP job shapes and OTP flows unchanged
  - have processors emit delivery success/failure events when generic jobs include notification metadata
  - avoid a `QueueModule <-> NotificationsModule` circular dependency by having notifications listen for those events instead of injecting notifications services into processors directly
- keep direct queue usage in subscription/booking/coaching/gamification/inventory lifecycle services untouched for this task; those callers will be moved to `dispatch()` in `TASK-1204` and `TASK-1205`
- add focused tests for:
  - dispatch channel selection and transaction/enqueue behavior
  - repo write/status helpers
  - processor success/failure event emission for generic notification-backed jobs
  - backward compatibility for non-notification jobs

Expected files to touch:
- `capstone-backend/src/notifications/notifications.module.ts`
- `capstone-backend/src/notifications/notifications.service.ts`
- `capstone-backend/src/notifications/notifications.repository.ts`
- new typed helper/event files under `capstone-backend/src/notifications/`
- `capstone-backend/src/user/user.service.ts`
- `capstone-backend/src/user/user.repository.ts`
- `capstone-backend/src/queue/processors/mail.processor.ts`
- `capstone-backend/src/queue/processors/sms.processor.ts`
- possibly `capstone-backend/src/queue/queue.module.ts`
- focused specs under `src/notifications/`, `src/queue/processors/`, and `src/user/` if needed

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the shared S12 dispatch core on top of the existing inbox module without changing Prisma schema. `NotificationsService.dispatch()` now resolves user delivery context, persists the always-on `in_app` record plus any eligible `email`/`sms` rows, and then enqueues generic Bull jobs with notification metadata only after the database writes commit.

Code delivered:
- added shared notification dispatch contracts and delivery-status event types under `src/notifications/`
- expanded `NotificationsRepository` with transactional dispatch creation plus `markNotificationSent()` / `markNotificationFailed()`
- expanded `NotificationsService` with:
  - typed `dispatch()`
  - current-schema preference gating
  - enqueue-failure handling that marks the persisted channel row failed
  - `@OnEvent()` listeners for processor success/failure acknowledgements
- added `UserService.getNotificationDispatchContext()` plus a matching repository query so notifications can read contact + preference state through the owning domain
- updated mail and SMS processors to accept optional notification metadata on generic jobs and emit delivery success/failure events without changing OTP flows
- wired `NotificationsModule` and `QueueModule` imports so the dispatch seam has the queue and event-emitter dependencies it needs

Intentional scope:
- lifecycle services that still enqueue mail/SMS directly were left untouched in this task and will move to `dispatch()` in later S12 integration slices
- email/SMS fan-out only uses the notification types currently backed by existing `NotificationPreference` fields; the rest remain `in_app` only until `TASK-1203`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Focused verification completed for the new dispatch and delivery-persistence seam.

Commands run:
- `npm.cmd test -- --runInBand src/notifications/notifications.repository.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.controller.spec.ts src/queue/processors/mail.processor.spec.ts src/queue/processors/sms.processor.spec.ts src/user/user.service.spec.ts` -> passed (`6` suites, `46` tests)
- `npm.cmd run build` -> passed
- `npm.cmd run lint:check` -> passed

Coverage added in this slice:
- transactional notification persistence and status transitions
- channel-selection behavior in `dispatch()`
- queue enqueue failure handling
- queue-processor success/failure feedback events
- user dispatch-context mapping

Notes:
- no full `npm.cmd test -- --runInBand` or `npm.cmd run test:e2e -- --runInBand` pass was needed for this focused implementation slice
- runtime API verification is still reserved for the final S12 task

MCPs used: serena, prismaLocal
