# S5 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S5 - Facility Bookings`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S5 auto mode should still pause unless the current workflow explicitly allows automatic handling
- when a binary decision is safe to resolve automatically, choose the recommended or safest default, not blindly `yes`
- this config does not override task safety gates, blockers, failed verification, or explicit task `Stop If` conditions

---

## Non-Eligible Task Policy

- `AUTO_APPROVE_NON_ELIGIBLE_TASKS:` `yes`
- `ACTIVE_IN_MODES:` `sleep`
- `STILL_STOP_FOR:` `explicit Stop If | hard stop file | unrecoverable verification failure`

Behavior:
- in `sleep` mode, tasks marked `Auto-Eligible = no` may continue automatically
- each bypass must be logged in `Non-Eligible Task Log`
- outside `sleep` mode, `Auto-Eligible = no` keeps its normal pause behavior
- this policy does not override an explicit task `Stop If`, the shared hard stop file, or an unrecoverable verification/runtime failure

---

Log only decisions that are:
- reusable in later S5 tasks
- mildly ambiguous but safe enough to proceed on
- important enough that a later chat should not rediscover them
- made during auto mode and worth preserving for the next task

Do not log every tiny implementation detail.

---

## Entry Format

Use this format for future entries:

```text
## YYYY-MM-DD - TASK-[N]
- Decision: ...
- Why: ...
- Impact: low | medium | high
- Review Status: accepted | revisit | user decision needed
- Architecture Follow-up: yes | no
```

---

## Non-Eligible Task Log

Use this format for future entries:

```text
## YYYY-MM-DD - TASK-[N]
- Bypass Reason: ...
- Why Sleep Mode Continued: ...
- Outcome: success | failed | revisited
```

Current entries:

_None yet._

---

## Current Entries

## 2026-03-24 - PLAN
- Decision: Stand up S5 in a dedicated `src/bookings/` domain root with separate `amenity/` and `booking/` subfolders, while reusing the existing shared payment boundary in `src/membership/payment`.
- Why: This matches the repo's multi-module domain convention and keeps S5 business logic isolated without duplicating the already generic payment infrastructure.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-501
- Decision: After TASK-501 verification passed, automatically mark it complete and promote `TASK-502` as the next active S5 task.
- Why: `TASK-502` is the first ready task with all dependencies satisfied and is marked auto-eligible in the execution queue.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-502
- Decision: Treat S5 availability `date` queries as UTC calendar dates and generate exactly 48 half-hour slots from `00:00:00Z` through the requested day.
- Why: The S5 contract provides a date-only query without a facility timezone, and UTC day boundaries keep slot generation and overlap checks deterministic across environments until a timezone rule is introduced.
- Impact: medium
- Review Status: revisit
- Architecture Follow-up: no

## 2026-03-24 - TASK-503
- Decision: Plan booking creation around `free + paymongo` initiation only, and keep `provider=cash` creation support deferred to `TASK-505` unless the user explicitly broadens scope.
- Why: The current shared payment layer already supports idempotent PayMongo checkout and payment completion events, while manual booking payments are still rejected in `PaymentService.resolvePaymentOwnerId()`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-503-IMPLEMENTATION
- Decision: Return a single booking-create response shape with `booking_id`, `status`, and optional `checkout_url` for both free and PayMongo paths.
- Why: This keeps retries, free bookings, and resumed checkout attempts on one stable API contract without introducing a second endpoint or response type split.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-504
- Decision: Emit a dedicated `booking.cancelled` event alongside the audit log when a booking moves to `cancelled`.
- Why: Later notification and lifecycle work needs a stable booking-cancellation seam without re-deriving state changes from audit records.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-505
- Decision: Keep the shared `payment.completed` event payload unchanged and resolve booking payment stage from `paymentId` inside the booking consumer.
- Why: Balance completion needed stage-aware booking behavior, but widening the shared event contract would ripple across payment producers and other domains without adding enough value.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-506
- Decision: Reuse the existing `booking_confirmed_email` and `booking_confirmed_sms` preference flags for both booking confirmation and booking cancellation notifications.
- Why: The user domain already exposes booking notification preferences, but there are no separate cancellation-specific flags yet; reusing the existing booking preference pair avoids inventing untracked user settings mid-stream.
- Impact: medium
- Review Status: revisit
- Architecture Follow-up: no

## 2026-03-24 - TASK-507
- Decision: Register `BookingController` before `AmenityController` inside `BookingsModule`.
- Why: The static `/bookings/amenities/availability` route must bind before the dynamic `/bookings/amenities/:id` route or availability requests are swallowed by UUID parsing on the `:id` route.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
