# TASK-1205 - Auth Gamification Inventory AI And Nutrition Notification Integration
**Task ID:** TASK-1205
**Domain:** S12 - Notifications
**Status:** done
**Branch:** feat/TASK-1205-auth-gamification-inventory-ai-and-nutrition-notification-integration
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P2
**Depends On:** TASK-1202, TASK-1203
**Blocks:** TASK-1206, TASK-1207
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if one of the documented event producers does not yet exist and adding it would broaden this task into a second domain feature rather than S12 integration work
**Escalation Notes:** stop if missing event producers such as AI-session-archived or payment-failed require product clarification before S12 can safely consume them
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Wire the remaining documented S12 event families into the centralized notification service, including auth, gamification, inventory, AI, and nutrition-adjacent notification paths.

## Why
After the highest-traffic scheduling domains are centralized, S12 still needs the rest of the documented event registry so notification behavior is complete and consistent across the app.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] Rank-up, low-stock, equipment-write-off, user-registration/system, and other already-produced notification events flow through S12 dispatch
- [ ] Missing but documented S12 consumers are added where the producing events already exist or can be added safely inside scope
- [ ] Admin-only notifications and mandatory system notifications respect the chosen preference rules
- [ ] The remaining ad hoc notification queue calls outside scheduling domains are removed or wrapped by S12 dispatch
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
- `context/s12-notifications.md`
- `tasks/s12-notifications/README.md`
- `tasks/s12-notifications/execution.md`
- `tasks/s12-notifications/decisions.md`

## Module Hints
- `capstone-backend/src/notifications`
- `capstone-backend/src/auth`
- `capstone-backend/src/fitness`
- `capstone-backend/src/inventory`
- `capstone-backend/src/ai`
- `capstone-backend/src/nutrition`

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
`TASK-1205` can stay focused on the remaining notification seams without reopening the larger S12 architecture. Two of the remaining domains already have event listeners that bypass S12 by queueing mail directly, and three others already have safe places to emit small notification events without inventing new HTTP contracts or broad product behavior.

Concrete implementation plan:
- keep gamification and inventory responsible for detecting their own domain events, but remove their direct transport ownership
  - `GamificationLifecycleService` already consumes `GAMIFICATION_RANK_UP_EVENT`; replace its `QUEUE_MAIL` dependency and preference check with `NotificationsService.dispatch(userId, NotificationType.rank_up, ...)`
  - `InventoryLifecycleService` already consumes `PRODUCT_STOCK_CHANGED_EVENT` and `EQUIPMENT_WRITEOFF_EVENT`; keep the cooldown logic and admin-recipient lookup there, but dispatch `NotificationType.low_stock` and `NotificationType.equipment_write_off` through S12 instead of queueing generic mail directly
  - for inventory, continue iterating one recipient at a time so each admin gets an owned notification row; admin-only alerts should remain `in_app`-first and only fan out to email when `system_email` allows it
- add notification-owned listeners for domains that already emit or can safely emit narrow internal events
  - nutrition:
    - `NutritionService` already emits `TDEE_RECALCULATED_EVENT`
    - add an S12 notification listener in `src/notifications` that consumes this event and dispatches a `NotificationType.system` notification with a TDEE/macros refresh message
  - AI:
    - add a small `AI_SESSION_ARCHIVED_EVENT` in `src/ai/events`
    - emit it from both explicit `AiService.archiveSession()` and the stale-session auto-archive paths in `resolveChatSession()`
    - consume it from the notifications module and dispatch `NotificationType.ai_session_archived`
  - auth:
    - add a narrow `USER_REGISTERED_EVENT` in `src/auth/events`
    - emit it only when an account becomes usable, not when a pending record is first created
    - that means: successful email-verification activation, first-time Google account provisioning, and admin-created active users
    - consume it from the notifications module and map it to `NotificationType.system` so it follows the existing `system_email` preference instead of inventing a new notification enum or preference
  - payment:
    - add a narrow `PAYMENT_FAILED_EVENT` in `src/membership/payment/events`
    - emit it from the existing manual rejection path in `PaymentService.verifyPayment(... action=reject)` because that is the current explicit failure transition already modeled by the app
    - consume it from the notifications module and dispatch `NotificationType.payment_failed`
    - do not expand this task into new gateway-failure semantics beyond the failure paths already represented in code today
- keep the S12 ownership split clear
  - existing domain listeners in gamification and inventory should continue to own event-specific context gathering and cooldown behavior
  - new auth/AI/nutrition/payment event consumers should live in `src/notifications` as an S12 listener/provider so notification dispatch policy stays centralized
  - do not move lifecycle queues, cron jobs, or repository ownership out of their current domains
- update module wiring only where needed
  - `GamificationModule` should depend on `NotificationsModule` instead of the mail queue dependency it currently needs for notification delivery
  - `InventoryModule` should depend on `NotificationsModule` for the same reason
  - the notifications module should register the new event-listener provider but should not import the emitting domain modules back in a way that creates cycles
- likely implementation files
  - `capstone-backend/src/fitness/gamification/gamification-lifecycle.service.ts`
  - `capstone-backend/src/fitness/gamification/gamification-lifecycle.service.spec.ts`
  - `capstone-backend/src/fitness/gamification/gamification.module.ts`
  - `capstone-backend/src/inventory/inventory-lifecycle.service.ts`
  - `capstone-backend/src/inventory/inventory-lifecycle.service.spec.ts`
  - `capstone-backend/src/inventory/inventory.module.ts`
  - `capstone-backend/src/notifications` for a new notification-domain listener/provider plus focused specs
  - `capstone-backend/src/auth/auth.service.ts`
  - `capstone-backend/src/auth/auth.service.spec.ts`
  - `capstone-backend/src/ai/ai.service.ts`
  - `capstone-backend/src/ai/ai.service.spec.ts`
  - `capstone-backend/src/nutrition/nutrition.service.ts` only if the event payload needs a small extension; otherwise reuse the existing event as-is
  - `capstone-backend/src/membership/payment/payment.service.ts`
  - `capstone-backend/src/membership/payment/payment.service.spec.ts`
- recommended verification for implementation
  - focused Jest:
    - `src/fitness/gamification/gamification-lifecycle.service.spec.ts`
    - `src/inventory/inventory-lifecycle.service.spec.ts`
    - `src/notifications/*.spec.ts` covering the new event listeners
    - `src/auth/auth.service.spec.ts`
    - `src/ai/ai.service.spec.ts`
    - `src/nutrition/nutrition.service.spec.ts`
    - `src/membership/payment/payment.service.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
  - leave broader HTTP/e2e expansion for `TASK-1206`

Scope note:
- `TDEE_RECALCULATED_EVENT` and `USER_REGISTERED_EVENT` should map to `NotificationType.system` because S12 already has the `system` enum and `system_email` preference, but not separate `tdee_recalculated` or `user_registered` preference families
- if implementation uncovers a missing producer that would require new product semantics rather than a narrow internal emit at an already-existing state transition, stop and treat that as the task escalation condition

MCPs used: none

---

## CODER OUTPUT
Implemented the remaining S12 notification integrations across gamification, inventory, auth, AI, nutrition-adjacent events, and payment failure handling.

- Replaced the last direct mail-queue notification seams with centralized dispatch:
  - `capstone-backend/src/fitness/gamification/gamification-lifecycle.service.ts`
  - `capstone-backend/src/inventory/inventory-lifecycle.service.ts`
- Updated module wiring so those listeners now depend on `NotificationsModule` instead of owning queue delivery directly:
  - `capstone-backend/src/fitness/gamification/gamification.module.ts`
  - `capstone-backend/src/inventory/inventory.module.ts`
- Added narrow internal event contracts for the remaining documented S12 consumers:
  - `capstone-backend/src/auth/events/user-registered.event.ts`
  - `capstone-backend/src/ai/events/ai-session-archived.event.ts`
  - `capstone-backend/src/membership/payment/events/payment-failed.event.ts`
- Emitted those events from existing, already-owned state-transition seams:
  - `AuthService.verifyEmail()`, first-time Google provisioning, and `adminCreateUser()`
  - `AiService.archiveSession()` plus both stale-session auto-archive paths
  - `PaymentService.verifyPayment(... action = reject)`
- Added a new notification-domain listener provider at:
  - `capstone-backend/src/notifications/notification-domain-events.listener.ts`
  - with focused coverage in `capstone-backend/src/notifications/notification-domain-events.listener.spec.ts`
  - this listener now consumes:
    - `USER_REGISTERED_EVENT` -> `NotificationType.system`
    - `TDEE_RECALCULATED_EVENT` -> `NotificationType.system`
    - `AI_SESSION_ARCHIVED_EVENT` -> `NotificationType.ai_session_archived`
    - `PAYMENT_FAILED_EVENT` -> `NotificationType.payment_failed`
- Updated centralized email gating so admin-only `low_stock` and `equipment_write_off` notifications use the existing `system_email` umbrella rather than introducing new preference fields.
- Refreshed the focused specs around the changed seams:
  - `capstone-backend/src/fitness/gamification/gamification-lifecycle.service.spec.ts`
  - `capstone-backend/src/inventory/inventory-lifecycle.service.spec.ts`
  - `capstone-backend/src/auth/auth.service.spec.ts`
  - `capstone-backend/src/ai/ai.service.spec.ts`
  - `capstone-backend/src/membership/payment/payment.service.spec.ts`
  - `capstone-backend/src/notifications/notifications.service.spec.ts`

MCPs used: serena

---

## TESTER REPORT
Verification passed locally.

- `npm.cmd test -- --runInBand src/notifications/notification-domain-events.listener.spec.ts src/notifications/notifications.service.spec.ts src/fitness/gamification/gamification-lifecycle.service.spec.ts src/inventory/inventory-lifecycle.service.spec.ts src/auth/auth.service.spec.ts src/ai/ai.service.spec.ts src/membership/payment/payment.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Notes:
- The focused notifications test suite intentionally logs one expected queue-enqueue failure path from `NotificationsService` while asserting the failure bookkeeping behavior; that log line is expected and the suite still passes.
- Broader HTTP/e2e expansion remains reserved for `TASK-1206`.

MCPs used: none
