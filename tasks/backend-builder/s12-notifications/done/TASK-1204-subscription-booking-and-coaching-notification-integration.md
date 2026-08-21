# TASK-1204 - Subscription Booking And Coaching Notification Integration
**Task ID:** TASK-1204
**Domain:** S12 - Notifications
**Status:** done
**Branch:** feat/TASK-1204-subscription-booking-and-coaching-notification-integration
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** TASK-1202, TASK-1203
**Blocks:** TASK-1206, TASK-1207
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the current lifecycle listeners depend on domain-local email/SMS content or scheduling behavior that cannot be cleanly expressed through shared notification payloads
**Escalation Notes:** stop if replacing the existing subscription, booking, or coaching queue calls would require redesigning their lifecycle-job ownership
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Move the current subscription, booking, and coaching notification fan-out from domain-local lifecycle services onto the centralized S12 dispatcher.

## Why
These domains currently own the largest direct email/SMS notification seams, so centralizing them is the biggest step toward matching the documented event-driven S12 architecture.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] Subscription warning, expiry, payment-confirmed, booking-confirmed, booking-cancelled, appointment-confirmed, appointment-cancelled, and appointment-completed notifications flow through S12 dispatch
- [ ] Existing lifecycle jobs and delayed checks still run, but notification delivery no longer bypasses the centralized notification service
- [ ] Email/SMS preference gating remains correct after the migration
- [ ] In-app notification rows are created for these event families
- [ ] Existing cross-domain tests are updated or preserved where behavior changes
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
- `capstone-backend/src/membership`
- `capstone-backend/src/bookings`
- `capstone-backend/src/coaching`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [x] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
`TASK-1204` can stay within the current lifecycle-job architecture. The subscription, booking, and coaching modules already have the right event hooks and notification copy builders; the missing step is to stop queueing generic mail/SMS directly inside those lifecycle services and route those same payloads through `NotificationsService.dispatch()` so S12 owns in-app persistence plus preference-gated channel fan-out.

Concrete implementation plan:
- keep each domain's lifecycle scheduling and status transitions exactly where they already live
  - `SubscriptionLifecycleService` keeps warning and expiry cron ownership
  - `BookingLifecycleService` keeps pending-cleanup, no-show, and completion job ownership
  - `AppointmentLifecycleService` keeps no-show and free-session completion job ownership
  - this task should not redesign queue timing or move lifecycle jobs into S12
- inject `NotificationsService` into the three lifecycle services and remove their direct `QUEUE_MAIL` / `QUEUE_SMS` delivery responsibility
  - `capstone-backend/src/membership/subscription/subscription-lifecycle.service.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.service.ts`
  - `capstone-backend/src/coaching/appointment/appointment-lifecycle.service.ts`
  - retain local subject/body/html/SMS composition, but feed those strings into S12 dispatch payloads instead of queue helpers
- preserve the existing copy and recipient semantics while centralizing transport
  - subscription:
    - warning emails/SMS become `NotificationType.subscription_expiring`
    - expiry email/SMS becomes `NotificationType.subscription_expired`
    - payment-confirmed email becomes `NotificationType.payment_confirmed`
  - booking:
    - confirmation email/SMS becomes `NotificationType.booking_confirmed`
    - cancellation email/SMS becomes `NotificationType.booking_cancelled`
    - no-show needs to become `NotificationType.booking_no_show`
  - coaching:
    - member confirmation email/SMS becomes `NotificationType.appointment_confirmed`
    - member completion email becomes `NotificationType.appointment_completed`
    - cancellation notifications must still reach both member and coach, but both should flow through S12 dispatch using `NotificationType.appointment_cancelled`
- add the currently missing booking no-show notification seam during the migration
  - `BookingLifecycleService.runNoShowCheck()` currently only marks the booking as `no_show`
  - implementation should detect a successful state change, load the same booking notification context, and dispatch a `booking_no_show` notification to the booking owner
  - do not create a new external API surface for this; keep it internal to the lifecycle path
- keep S12 as the single source of preference gating
  - remove notification-preference checks from the lifecycle services themselves
  - let `NotificationsService.dispatch()` decide whether email/SMS rows and queue jobs should exist
  - lifecycle services should only decide whether an event happened and what message payload should be sent
- keep module wiring minimal and cycle-safe
  - import `NotificationsModule` where these lifecycle services are provided so they can inject `NotificationsService`
  - do not inject domain services back into `NotificationsModule`
  - keep the queue processors and delivery-status event loop introduced in `TASK-1202` unchanged
- update focused tests toward dispatch assertions instead of raw queue assertions
  - subscription lifecycle specs should assert `notificationsService.dispatch()` calls for warning, expiry, and payment-confirmed flows while leaving cron/job registration assertions intact
  - booking lifecycle specs and integration coverage should assert dispatch for confirmed, cancelled, and no-show flows while preserving pending-cleanup event behavior
  - coaching lifecycle specs should assert dispatch for confirmed, cancelled, and completed flows while preserving no-show/completion job behavior
  - any existing integration tests that only cared about `send-generic` queue calls should be updated to the new S12 dispatch seam
- likely implementation files
  - `capstone-backend/src/membership/subscription/subscription-lifecycle.service.ts`
  - `capstone-backend/src/membership/subscription/subscription-lifecycle.service.spec.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.service.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.service.spec.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.integration.spec.ts`
  - `capstone-backend/src/coaching/appointment/appointment-lifecycle.service.ts`
  - `capstone-backend/src/coaching/appointment/appointment-lifecycle.service.spec.ts`
  - `capstone-backend/src/coaching/appointment/appointment-payment.integration.spec.ts`
  - the relevant domain modules under membership, bookings, and coaching for `NotificationsModule` imports
- recommended verification for implementation
  - focused Jest for the three lifecycle services plus any affected booking/coaching payment integration coverage
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
  - reserve broader e2e surface expansion for `TASK-1206`

MCPs used: none

---

## CODER OUTPUT
Implemented the cross-domain lifecycle migration onto centralized S12 dispatch without changing ownership of the existing lifecycle jobs.

- Replaced direct mail/SMS queue fan-out in:
  - `capstone-backend/src/membership/subscription/subscription-lifecycle.service.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.service.ts`
  - `capstone-backend/src/coaching/appointment/appointment-lifecycle.service.ts`
  with `NotificationsService.dispatch()` payloads for:
  - `subscription_expiring`
  - `subscription_expired`
  - `payment_confirmed`
  - `booking_confirmed`
  - `booking_cancelled`
  - `booking_no_show`
  - `appointment_confirmed`
  - `appointment_cancelled`
  - `appointment_completed`
- Kept the existing domain-local lifecycle queues and cron ownership in place:
  - subscription warning/expiry jobs still run from the subscription lifecycle service
  - booking pending-cleanup, no-show, and completion jobs still run from the booking lifecycle service
  - coaching no-show and free-session completion jobs still run from the appointment lifecycle service
- Added the previously missing booking no-show notification path by dispatching `NotificationType.booking_no_show` after a successful `markBookingNoShowIfEligible()` transition.
- Imported `NotificationsModule` into:
  - `capstone-backend/src/membership/membership.module.ts`
  - `capstone-backend/src/bookings/bookings.module.ts`
  - `capstone-backend/src/coaching/coaching.module.ts`
  so those lifecycle services can inject `NotificationsService` without reintroducing direct queue ownership.
- Updated focused lifecycle and integration coverage to assert centralized dispatch instead of raw `send-generic` queue writes:
  - `capstone-backend/src/membership/subscription/subscription-lifecycle.service.spec.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.service.spec.ts`
  - `capstone-backend/src/bookings/booking/booking-lifecycle.integration.spec.ts`
  - `capstone-backend/src/coaching/appointment/appointment-lifecycle.service.spec.ts`
  - `capstone-backend/src/coaching/appointment/appointment-payment.integration.spec.ts`

MCPs used: none

---

## TESTER REPORT
Verification passed locally.

- `npm.cmd test -- --runInBand src/membership/subscription/subscription-lifecycle.service.spec.ts src/bookings/booking/booking-lifecycle.service.spec.ts src/bookings/booking/booking-lifecycle.integration.spec.ts src/coaching/appointment/appointment-lifecycle.service.spec.ts src/coaching/appointment/appointment-payment.integration.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Notes:
- This slice intentionally leaves broader e2e expansion for `TASK-1206`; the focused lifecycle and payment-integration suites now cover the migrated dispatch seams.
- The centralized dispatcher now decides whether SMS is actually emitted for each notification type, so lifecycle services can provide payloads without re-implementing channel gating.

MCPs used: none
