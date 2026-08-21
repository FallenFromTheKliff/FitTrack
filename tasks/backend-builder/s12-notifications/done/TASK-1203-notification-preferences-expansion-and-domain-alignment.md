# TASK-1203 - Notification Preferences Expansion And Domain Alignment
**Task ID:** TASK-1203
**Domain:** S12 - Notifications
**Status:** done
**Branch:** feat/TASK-1203-notification-preferences-expansion-and-domain-alignment
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** TASK-1201
**Blocks:** TASK-1204, TASK-1205, TASK-1206, TASK-1207
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the documented S12 notification matrix cannot be mapped onto preference fields without a product decision about which events are user-configurable versus mandatory system/admin alerts
**Escalation Notes:** stop if moving the preference surface out of `src/user` would create cross-domain churn beyond the current S12 scope
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Expand notification-preference coverage to the documented S12 event set and settle the long-term module boundary for the preference read/update endpoints.

## Why
The current schema and DTO only cover a small subset of S12 notification types, which blocks consistent preference gating once the centralized dispatcher begins handling the full event matrix.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] Preference fields exist for the documented user-configurable S12 notification families that need gating
- [ ] Admin-only or mandatory notifications are clearly separated from user-configurable preferences
- [ ] The read/update preferences API still works and matches the chosen module boundary
- [ ] Any schema or migration changes are checked in and locally verifiable
- [ ] Existing consumers are updated to the expanded preference contract without silent gaps
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
- `capstone-backend/src/user`
- `capstone-backend/src/notifications`
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
`TASK-1202` confirmed that the shared dispatcher already depends on the existing `NotificationPreference` subset, so this task needs to do two things together: expand the schema/DTO contract to cover the documented event types that genuinely need user-configurable gating, and move preference ownership onto the S12 module so later notification integrations stop depending on `src/user` for notification-domain writes.

Decision-complete plan:
- make `src/notifications/` the long-term owner of notification preferences
  - move the `/v1/notifications/preferences` read/update surface out of `NotificationPrefsController` in `src/user`
  - add preference read/update methods and DTO wiring inside `src/notifications/`
  - remove the preference-specific read/update methods from `UserService` once the notifications module owns them
  - keep `UserService` exported only for user/contact context that truly belongs to the user domain
- keep the route path stable as `/v1/notifications/preferences`
  - this avoids HTTP churn while still correcting the module boundary internally
  - Swagger ownership should move with the controller into the notifications domain
- expand `NotificationPreference` only for the documented user-facing event families that need event-specific gating
  - add email toggles for:
    - `subscription_expired_email`
    - `payment_failed_email`
    - `booking_cancelled_email`
    - `booking_no_show_email`
    - `appointment_completed_email`
    - `appointment_cancelled_email`
    - `ai_session_archived_email`
  - keep the existing fields for:
    - `subscription_expiring_email`
    - `subscription_expiring_sms`
    - `booking_confirmed_email`
    - `booking_confirmed_sms`
    - `appointment_confirmed_email`
    - `appointment_confirmed_sms`
    - `rank_up_email`
    - `payment_confirmed_email`
    - `system_email`
- treat these categories as not individually user-configurable in this task
  - admin-only alerts:
    - `low_stock`
    - `equipment_write_off`
  - umbrella/system events that can stay behind `system_email`:
    - registration/welcome
    - relationship lifecycle messages
    - nutrition/TDEE recalculation notices
    - other general system notices not represented by a dedicated `NotificationType`
  - `in_app` delivery remains always-on and is not preference-gated
- update the dispatcher to the expanded contract after the schema and repository changes land
  - move notification-preference reads out of `UserRepository.findNotificationDispatchTargetOrThrow()`
  - let `NotificationsRepository` own `NotificationPreference` reads/updates
  - narrow the user-domain dispatch helper to contact-channel facts only:
    - preferred email
    - preferred phone
    - `phone_verified_at`
  - update `NotificationsService.isEmailDeliveryEnabled()` / `isSmsDeliveryEnabled()` to use the new notification-owned preference contract
- update registration/default seeding expectations
  - the existing auth repository already creates a `NotificationPreference` row with defaults, so the migration defaults become the bootstrap behavior for newly added fields
  - verify any tests that assume the older preference shape and extend them to include the new columns where relevant
- expected implementation files
  - `capstone-backend/prisma/schema.prisma`
  - a checked-in migration under `capstone-backend/prisma/migrations/`
  - `capstone-backend/src/notifications/notifications.controller.ts` or a dedicated notifications preference controller in the same module
  - `capstone-backend/src/notifications/notifications.service.ts`
  - `capstone-backend/src/notifications/notifications.repository.ts`
  - local notifications preference DTOs under `capstone-backend/src/notifications/dto/`
  - `capstone-backend/src/user/user.module.ts`
  - `capstone-backend/src/user/user.service.ts`
  - `capstone-backend/src/user/user.repository.ts`
  - targeted specs in notifications/user/auth as needed
- recommended verification for the implementation slice
  - `npm.cmd run build`
  - focused Jest coverage for notifications preference DTO/service/repository/controller behavior plus any affected user/auth tests
  - `npm.cmd run lint:check`
  - if a migration is added, confirm local Prisma state with Prisma Local MCP before closing the task

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S12 preference expansion and ownership move end to end.

- Expanded `NotificationPreference` in `capstone-backend/prisma/schema.prisma` with dedicated email toggles for `subscription_expired`, `payment_failed`, `booking_cancelled`, `booking_no_show`, `appointment_completed`, `appointment_cancelled`, and `ai_session_archived`, then checked in migration `20260327202149_expand_notification_preferences_for_s12`.
- Moved `/v1/notifications/preferences` ownership into `src/notifications` by adding preference DTOs, controller endpoints, repository methods, and service mapping in:
  - `capstone-backend/src/notifications/dto/notification-preferences.dto.ts`
  - `capstone-backend/src/notifications/notifications.controller.ts`
  - `capstone-backend/src/notifications/notifications.service.ts`
  - `capstone-backend/src/notifications/notifications.repository.ts`
- Removed the legacy notification-preferences surface from `src/user`:
  - deleted the user-owned preference controller wiring from `capstone-backend/src/user/user.controller.ts`
  - removed the old DTO from `capstone-backend/src/user/dto/user-dto.ts`
  - removed preference read/update methods from `capstone-backend/src/user/user.service.ts`
  - narrowed `capstone-backend/src/user/user.repository.ts` dispatch-target lookup to contact-channel facts only
  - updated `capstone-backend/src/user/user.module.ts` to stop registering the old notifications controller
- Updated notification dispatch gating so `NotificationsService` reads persisted preferences from `NotificationsRepository` while `UserService.getNotificationDispatchContext()` now only supplies preferred email, preferred phone, and `phone_verified_at`.
- Added and updated focused specs for the new ownership boundary and expanded preference matrix:
  - `capstone-backend/src/notifications/notifications.controller.spec.ts`
  - `capstone-backend/src/notifications/notifications.service.spec.ts`
  - `capstone-backend/src/notifications/notifications.repository.spec.ts`
  - `capstone-backend/src/user/user.service.spec.ts`
- Regenerated Prisma Client after the migration so the new preference fields are available to build-time types.

MCPs used: prismaLocal

---

## TESTER REPORT
Verification passed locally.

- `npm.cmd test -- --runInBand src/notifications/notifications.repository.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.controller.spec.ts src/user/user.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Notes:
- The focused dispatch suite intentionally logs one `Queue offline` error from the enqueue-failure test while still passing; this is expected coverage for the persisted-delivery failure path.
- `npx.cmd prisma generate` was run after the migration because the initial Prisma client types were stale relative to the updated schema.

MCPs used: prismaLocal
