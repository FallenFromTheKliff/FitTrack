# S12 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S12 - Notifications`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S12 auto mode do not default to automatic acceptance
- the chosen answer should be the recommended or safest default when auto-resolution is allowed
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
- reusable in later S12 tasks
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

## 2026-03-28 - TASK-1201
- Decision: Limit the new inbox/read/delete surface to `Notification.channel = in_app` only.
- Why: The S12 context defines inbox semantics around in-app records, while email/SMS persistence and dispatch fan-out are explicitly reserved for `TASK-1202`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1201
- Decision: Leave notification preference endpoints physically in `src/user` for now while introducing the new `src/notifications/` module.
- Why: This keeps the first slice focused on inbox behavior and avoids coupling the new module rollout to the broader preference-ownership decision already reserved for `TASK-1203`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1202
- Decision: Use queue-emitted delivery success/failure events to update notification rows instead of injecting the notifications service directly into queue processors.
- Why: `NotificationService.dispatch()` needs `QueueModule`, and processors would otherwise need `NotificationsModule`, creating an avoidable module cycle. Event handoff keeps Bull processors reusable while letting S12 own persistence updates.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1202
- Decision: Gate email/SMS fan-out only for notification types that already have matching `NotificationPreference` fields; other types stay `in_app`-only until `TASK-1203`.
- Why: The current schema supports only a subset of the S12 event matrix, and this task is explicitly app-layer only with `Touches Prisma: no`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1203
- Decision: Make `src/notifications` the owner of notification preference APIs and persistence while keeping the public route path `/v1/notifications/preferences` unchanged.
- Why: Preference reads and writes are notification-domain behavior, and leaving them in `src/user` would keep downstream S12 work coupled to the wrong module boundary even after the dedicated notifications module now exists.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1203
- Decision: Expand event-specific preference fields only for user-facing notification types with dedicated `NotificationType` entries, while keeping admin-only alerts ungated and non-specific product/system notices under the existing `system_email` umbrella.
- Why: This cleanly resolves the task stop condition without inventing one preference toggle per emitted event, and it matches the current schema split between explicit notification types and broader system notices.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1203
- Decision: Keep `UserService.getNotificationDispatchContext()` limited to contact-channel facts and move notification-preference reads fully into `NotificationsRepository`.
- Why: The dispatcher still needs user-domain ownership for preferred email/phone discovery, but keeping preference persistence in S12 avoids reintroducing `src/user` as the write owner for notification-domain behavior.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1204
- Decision: Keep lifecycle services responsible for detecting and scheduling domain events, but move all channel fan-out for those events behind `NotificationsService.dispatch()`.
- Why: This preserves the existing cron, delayed-job, and status-transition ownership in membership, bookings, and coaching while still making S12 the sole owner of in-app persistence and channel gating.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1204
- Decision: Let lifecycle services continue supplying rich payloads, but rely on the centralized dispatcher to suppress SMS for non-high-priority types like booking-cancelled, appointment-cancelled, appointment-completed, and subscription-expired.
- Why: The S12 context explicitly limits SMS delivery to the high-priority families already encoded in `NotificationsService.isSmsDeliveryEnabled()`, so channel policy should stay centralized instead of being reimplemented in each domain listener.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1205
- Decision: Keep existing gamification and inventory event listeners in their current domains, but add new auth, AI, nutrition, and payment event consumers inside `src/notifications`.
- Why: Gamification and inventory already own rank-up context, admin-recipient lookup, and low-stock cooldown behavior, while the remaining domains only need narrow notification events emitted from existing state-transition seams. This keeps transport policy centralized without moving domain-specific detection logic into S12.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1205
- Decision: Map generic welcome-style registration notices and TDEE recalculation notices onto `NotificationType.system` instead of adding new notification types.
- Why: The S12 schema already provides `NotificationType.system` plus the `system_email` preference for broad product notices, and this task does not include a Prisma enum expansion.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1205
- Decision: Let `low_stock` and `equipment_write_off` keep their dedicated notification types while using `system_email` as the shared email-gating rule.
- Why: These admin-only alerts still need distinct in-app notification rows for filtering and auditability, but S12 already has the `system_email` umbrella for broad operational email without adding more preference fields.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1206
- Decision: Read raw incoming values inside notification boolean DTO transforms instead of trusting Nest implicit boolean conversion.
- Why: The new notifications e2e suite showed that arbitrary strings like `maybe` and `sometimes` were being coerced into truthy booleans before validation, which would weaken both inbox query filtering and preference-payload validation.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-28 - TASK-1207
- Decision: Resolve the S12 notifications runtime-start blocker with module-level `forwardRef()` imports instead of adding a broader runtime fallback around Redis or queue initialization.
- Why: The live verification blocker was a real Nest import cycle between `UserModule`, `MembershipModule`, and `NotificationsModule`, and fixing that cycle directly was safer and narrower than weakening the app bootstrap path just to get Swagger up.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes
