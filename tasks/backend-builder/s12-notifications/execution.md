# S12 Execution Queue

Use this file to drive sequential work for `S12 - Notifications`.

Sequential execution means:
- finish the active task first
- then pick the next `ready` task with no unmet dependencies
- do not advance strictly by task number if a dependency says otherwise

---

## Execution State

- `AUTO_MODE:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK:` `none`
- `NEXT_READY_TASK:` `none`
- `LAST_COMPLETED_TASK:` `TASK-1207`
- `STOP_REASON:` `domain_complete`
- `MAX_TASKS_PER_SESSION:` `1`

---

## Selection Rules

1. If a task exists in `active/`, that is the current task.
2. If `active/` is empty, pick the first task below with:
   - `status: ready`
   - all `depends_on` items marked done
3. If no task is ready, stop and report the blocking dependency.
4. If the agent makes a low-risk automatic sequencing decision, record it in `decisions.md`.
5. If `AUTO_MODE = domain` or `AUTO_MODE = sleep`, do not exceed `MAX_TASKS_PER_SESSION` in one chat.
6. If `STOP_REASON` is not `none`, stop and resolve that first unless it indicates the domain is already complete and `AUTO_MODE = sleep`.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-1201` | Notifications Module And Inbox Surface | `done` | `none` | `yes` | Creates the dedicated S12 module plus the authenticated inbox, unread-count, read, read-all, and delete surface on the existing `Notification` table. |
| `TASK-1202` | Notification Dispatch Core And Delivery Persistence | `done` | `TASK-1201` | `yes` | Centralizes `in_app`, email, and SMS fan-out behind one `NotificationService.dispatch()` path and persists delivery records instead of queueing ad hoc mail/SMS only. |
| `TASK-1203` | Notification Preferences Expansion And Domain Alignment | `done` | `TASK-1201` | `no` | Extends preference coverage beyond the current user-owned subset and settles whether the preference read/update surface stays in `src/user` or moves behind S12. |
| `TASK-1204` | Subscription Booking And Coaching Notification Integration | `done` | `TASK-1202, TASK-1203` | `no` | Replaces the current lifecycle-specific notification fan-out in the largest existing HTTP domains with centralized S12 dispatch. |
| `TASK-1205` | Auth Gamification Inventory AI And Nutrition Notification Integration | `done` | `TASK-1202, TASK-1203` | `yes` | Adds the remaining documented S12 event consumers and removes the remaining ad hoc notification seams outside the core scheduling domains. |
| `TASK-1206` | S12 Service And E2E Coverage | `done` | `TASK-1201, TASK-1202, TASK-1203, TASK-1204, TASK-1205` | `yes` | Adds focused repository, service, and HTTP/e2e coverage for inbox behavior, read transitions, preference gating, and queue fan-out. |
| `TASK-1207` | S12 Runtime API Verification | `done` | `TASK-1206` | `no` | Verifies the live `/v1/notifications/*` contract through the separate API verification driver once code checks are green. |

---

## Review Summary

- The Prisma schema and checked-in migrations already include both `NotificationPreference` and the full `Notification` model, so S12 can build on existing persistence instead of inventing new tables first.
- The only currently implemented S12 HTTP surface is notification preferences under `src/user`; the documented inbox, unread-count, read, read-all, and delete endpoints do not exist yet.
- The current app has no dedicated `src/notifications/` module or `NotificationService`; notification delivery is fragmented across membership, bookings, coaching, gamification, and inventory lifecycle services that queue mail or SMS directly.
- Existing preference coverage is narrower than the S12 event matrix: current DTO/schema fields cover subscription-expiring, booking-confirmed, appointment-confirmed, rank-up, payment-confirmed, and system email, but not the rest of the documented notification types.
- Some documented S12 consumers still appear to be design-only today, including payment-failed and AI-session-archived notification handling.
- Existing nearby tests cover preference mapping and several ad hoc lifecycle queue paths, but there is no centralized notification-domain repository, service, controller, or inbox coverage yet.

---

## Latest Progress

- `TASK-1201` is complete.
- The new `src/notifications/` module is wired into `AppModule` and now exposes authenticated inbox, unread-count, read, read-all, and delete endpoints over the existing `Notification` table.
- Focused notifications checks passed:
  - `npm.cmd test -- --runInBand src/notifications/notifications.repository.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.controller.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- The inbox surface is intentionally limited to `channel = in_app` for this first slice, and legacy notification preferences remain in `src/user` until the later preference-alignment task.
- `TASK-1202` is complete and now provides the shared dispatch core, persisted channel rows, and processor-driven delivery status updates without yet migrating domain lifecycle callers.
- `TASK-1203` is complete and now moves `/v1/notifications/preferences` into `src/notifications`, expands the persisted preference matrix, and narrows user-domain dispatch context to contact-channel data only.
- Focused TASK-1203 verification passed:
  - `npm.cmd test -- --runInBand src/notifications/notifications.repository.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.controller.spec.ts src/user/user.service.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `TASK-1204` is complete and now routes subscription, booking, and coaching lifecycle notifications through `NotificationsService.dispatch()` while preserving their existing cron and delayed-job ownership.
- Focused TASK-1204 verification passed:
  - `npm.cmd test -- --runInBand src/membership/subscription/subscription-lifecycle.service.spec.ts src/bookings/booking/booking-lifecycle.service.spec.ts src/bookings/booking/booking-lifecycle.integration.spec.ts src/coaching/appointment/appointment-lifecycle.service.spec.ts src/coaching/appointment/appointment-payment.integration.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `TASK-1204` also adds the previously missing booking no-show notification path and moves the three lifecycle modules onto the centralized S12 dispatcher.
- `TASK-1205` is complete and now centralizes the remaining gamification, inventory, auth, AI, nutrition-adjacent, and payment-failure notification seams behind S12 dispatch.
- Focused TASK-1205 verification passed:
  - `npm.cmd test -- --runInBand src/notifications/notification-domain-events.listener.spec.ts src/notifications/notifications.service.spec.ts src/fitness/gamification/gamification-lifecycle.service.spec.ts src/inventory/inventory-lifecycle.service.spec.ts src/auth/auth.service.spec.ts src/ai/ai.service.spec.ts src/membership/payment/payment.service.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `TASK-1205` also adds the notification-domain event listener provider, new auth/AI/payment internal events, and centralized `system_email` gating for admin-only inventory alerts.
- `TASK-1206` is complete and now adds a dedicated `test/notifications.e2e-spec.ts` slice that covers the authenticated notifications HTTP surface end to end with the shared controller-only Nest test harness.
- Focused TASK-1206 verification passed:
  - `npm.cmd run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `TASK-1206` also tightened notification boolean DTO parsing so invalid query/body strings are rejected instead of being silently coerced by Nest implicit conversion.
- `TASK-1207` is complete and the S12 notifications routes have passed live OpenAPI verification after rewriting `tasks/api-verification-driver.md` to the notifications scope.
- Focused TASK-1207 verification passed:
  - `npm.cmd run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- The live runtime pass also surfaced and fixed a real Nest module-import cycle between `UserModule`, `MembershipModule`, and `NotificationsModule`, after which the notifications route set, bearer auth, UUID params, response envelopes, nullable DTO fields, and preference schema all matched the live OpenAPI payload.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1201`
2. `TASK-1202`
3. `TASK-1203`
4. `TASK-1204`
5. `TASK-1205`
6. `TASK-1206`
7. `TASK-1207`

Notes:
- `TASK-1203` is intentionally marked not auto-eligible because it crosses schema, preference-contract, and module-boundary decisions.
- `TASK-1204` is intentionally marked not auto-eligible because it rewires multiple cross-domain lifecycle listeners that currently deliver notifications directly.
- `TASK-1207` reserves the final live verification slice for the separate API verification driver.

---

## Completion Rules

When a task is done:

1. move its file from `active/` to `done/`
2. promote the next ready task from `backlog/` to `active/`
3. update this queue so statuses stay accurate
4. add any reusable assumptions or tradeoffs to `decisions.md`

---

## Auto-Run Rules

If `AUTO_MODE = off`:

1. run only the phase named in `CURRENT_PHASE`

If `AUTO_MODE = task`:

1. run the current active task through `review -> plan -> implement -> test`
2. stop after verification, even if more tasks are ready

If `AUTO_MODE = domain`:

1. run the current active task through `review -> plan -> implement -> test`
2. if verification passes, move it to `done/`
3. promote the next ready unblocked task only if it is marked `Auto-Eligible = yes`
4. stop when:
   - the next task is not auto-eligible
   - a blocker is found
   - a user decision is required
   - `MAX_TASKS_PER_SESSION` is reached

Decision handling in domain mode:

- if a decision is routine, binary, and low-risk, use the decision config in `decisions.md`
- choose the recommended or safest default path, not blind `yes`
- still log reusable or notable automatic decisions in `decisions.md`
- do not bypass `Auto-Eligible = no`, explicit stop conditions, blockers, failed verification, or high-impact decisions

This keeps the domain queue semi-automatic instead of blindly autonomous.

If `AUTO_MODE = sleep`:

1. if this domain is complete, rewrite the shared driver to the next domain
2. if this domain is complete and `ECO_MODE: on`, stop there so the next domain starts in a fresh chat
3. if this domain is complete and `ECO_MODE: off`, continue according to the shared driver's handoff settings
4. otherwise run the remaining task queue through `review -> plan -> implement -> test`
5. when a task requires runtime API verification, run the separate API verification driver automatically before marking the task complete
6. if a task is marked `Auto-Eligible = no`, consult `decisions.md`
   - continue automatically only when `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`
   - log each bypass in the domain decision file
7. check the shared hard stop file before promoting the next task, before runtime API verification, and before the next domain handoff
8. stop when:
   - the hard stop file is detected
   - the shared domain/task cap is reached
   - an explicit task `Stop If` condition is hit
   - a failure remains after the shared self-heal budget is exhausted

---

## Runtime Verification Note

Swagger MCP is not part of the normal task queue.
HTTP-facing domains should usually reserve their final task for runtime API verification, and `tasks/api-verification-driver.md` may start the backend automatically once build, tests, and `npm.cmd run lint:check` pass.

---

## Sleep-Mode Queue Notes

- `ECO_MODE: on` stops after one completed domain.
- `ECO_MODE: off` may continue into the next domain.
- The shared driver may bypass non-eligible task pauses when the domain decision policy allows it.
- It must honor the shared hard stop file at safe boundaries.
