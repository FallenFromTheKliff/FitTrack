# S6 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S6 - Coaching`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S6 auto mode should still pause unless the current workflow explicitly allows automatic handling
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
- reusable in later S6 tasks
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

## 2026-03-25 - TASK-602
- Bypass Reason: `TASK-602` is marked `Auto-Eligible = no` because it adds checked-in migration SQL artifacts.
- Why Sleep Mode Continued: S6 enables `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`, and this task only adds non-destructive migration files without running Prisma commands.
- Outcome: success

## 2026-03-25 - TASK-605
- Bypass Reason: `TASK-605` is marked `Auto-Eligible = no` because it widens the shared payment boundary and adds an S6 payment-completion consumer.
- Why Sleep Mode Continued: S6 enables `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`, and the change stayed inside the existing shared payment architecture with passing build, test, and lint checks.
- Outcome: success

## 2026-03-26 - TASK-609
- Bypass Reason: `TASK-609` is marked `Auto-Eligible = no` because it is the final runtime API verification slice and depends on the separate Swagger verification driver.
- Why Sleep Mode Continued: S6 enables `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`, so the task could safely run its local code checks and migration-state preflight before deciding whether the live runtime pass was allowed to start.
- Outcome: revisited

## 2026-03-26 - TASK-609 Retry
- Bypass Reason: `TASK-609` remained the non-eligible runtime verification slice while the live Swagger pass was retried against the corrected local migration baseline.
- Why Sleep Mode Continued: The local OpenAPI endpoint was reachable, the Prisma baseline was already aligned, and the retry stayed within the findings-only runtime verification workflow.
- Outcome: success

---

## Current Entries

## 2026-03-25 - PLAN
- Decision: Stand up S6 in a dedicated `src/coaching/` domain root with separate `coach/`, `appointment/`, and `relationship/` modules while reusing the existing shared payment boundary in `src/membership/payment`.
- Why: The schema already models coaches, appointments, reviews, and relationships as one domain, while the repo-wide architecture already centralizes payment creation and verification in the shared payment submodule.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - PLAN
- Decision: Treat coaching route ids such as `coach_id` and `:id` on coach-facing endpoints as `CoachProfile.id` values, not `User.id` values.
- Why: The S6 schema stores `CoachAppointment.coach_id`, `CoachAvailabilitySlot.coach_id`, and `CoachClientRelationship.coach_id` against `CoachProfile`, and auth already seeds a profile per coach account.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-601
- Decision: Keep coach discovery limited to profiles where `is_available_for_booking = true`, while allowing direct coach detail reads for active coach accounts even when they are temporarily unavailable.
- Why: This keeps the browse surface aligned with bookable coaches without hiding the profile page and active availability history that later S6 flows need to reference.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-602
- Decision: Add the S6 partial unique guards as a standalone checked-in raw SQL migration artifact and verify it with file inspection plus non-destructive app checks instead of running Prisma migration commands in task mode.
- Why: This matches the repo guardrails and the earlier S4 uniqueness-guard pattern while still making the missing S6 invariants explicit in version control.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-603
- Decision: Evaluate weekly coaching availability against appointment timestamps in UTC and reject appointment windows that cross a UTC day boundary.
- Why: `CoachAvailabilitySlot` stores time-only values and the current S6 contract does not define a separate timezone field or cross-midnight slot behavior.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-603
- Decision: Store zero payable amounts for subscription-backed free coaching sessions while still marking `is_free_session = true`.
- Why: This keeps later S6 response, acceptance, and payment flows from treating included coaching sessions as partially payable appointments.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-604
- Decision: Allow appointment cancellation by the member owner, the owning coach, or staff/admin users, and persist both coach rejection and explicit cancellation through the same `cancelled` status plus `cancellation_reason`.
- Why: The S6 contract says any party can cancel an appointment, and a single cancellation shape keeps later payment, notification, and audit handling consistent.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-605
- Decision: Keep coaching downpayment initiation PayMongo-only, while supporting cash/manual collection through the staff balance flow and the shared payment module's manual verification path.
- Why: The member downpayment endpoint only carries a provider plus the required idempotency key, while the repo's cash verification flow requires screenshot/reference data that already exists on staff/manual payment paths.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-605
- Decision: Leave paid coaching appointments in `confirmed` while balance collection is in progress and only stamp `balance_paid_at` when the shared payment completion event succeeds.
- Why: `AppointmentStatus` has no intermediate balance state, and the S6 lifecycle separates payment confirmation from coach-driven session completion.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-606
- Decision: Treat `GET /v1/coaching/relationships/my` as the member-owned relationship view, while coach-side relationship reads stay on `GET /v1/coaching/clients`.
- Why: The S6 contract already has a coach-specific client endpoint, so keeping `/relationships/my` member-scoped avoids mixed role-dependent semantics on one route.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-606
- Decision: Allow coaches to set a pending relationship directly to `terminated` as the decline path because S6 does not define a separate rejected status.
- Why: This keeps relationship state changes inside the existing enum and gives later notification/lifecycle work one terminal state to consume.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-607
- Decision: Reuse `appointment_confirmed_email` and `appointment_confirmed_sms` for both appointment confirmation and cancellation lifecycle notifications.
- Why: S6 already has one appointment notification preference pair in `notification_preferences`, and reusing it avoids a schema change while keeping both operational appointment notices behind the same opt-in channel.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-607
- Decision: Send relationship lifecycle notifications as email-only operational messages to the directly affected user instead of reusing appointment preferences.
- Why: S6 does not yet define relationship-specific notification flags, and email-only delivery covers the missing side effect without overloading unrelated preference fields.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-607
- Decision: Auto-complete ended free coaching appointments from the lifecycle queue when they remain `confirmed` past their scheduled end time.
- Why: Free sessions have no later payment event to advance the lifecycle, so the queue needs a bounded cleanup path that prevents stale confirmed appointments and unlocks post-session review prompts.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-609
- Decision: Stop S6 runtime verification when Prisma Local auto-apply creates `20260325191915_apply_checked_in_guard_migrations` after applying the checked-in guard migrations.
- Why: The shared driver allows automatic Prisma work only when it applies already checked-in guard migrations. Prisma Local generated a follow-up migration that drops `subscriptions_one_active_per_user`, `coach_slot_unique`, and `coach_client_active_unique` because those guards still exist only as comments in `schema.prisma`.
- Impact: high
- Review Status: user decision needed
- Architecture Follow-up: no

## 2026-03-26 - TASK-609 Recovery
- Decision: Recover the local S6 runtime-verification baseline by deleting the unexpected generated migration, resetting the local `fittrack` dev DB, and re-applying only the six intended checked-in migrations.
- Why: The generated migration was an artifact of using `prisma migrate dev` against raw-SQL partial unique indexes that are intentionally documented as comments in `schema.prisma`. The stable checked-in-only path for this repo is `npx.cmd prisma migrate deploy` after status inspection.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-609 Retry
- Decision: Supersede the detached-startup blocker policy for `TASK-609`; runtime verification should use inline live startup first and treat detached/background startup as opportunistic only.
- Why: Inline `npm.cmd run start` already proved the Nest app boots and maps the S6 routes. The real requirement is a reachable live OpenAPI endpoint for Swagger MCP, not a detached process specifically. The next retry should keep the inline process alive for the full verification pass and request escalation only if sandbox or host-process restrictions still block access.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-609 Findings
- Decision: Route the live S6 Swagger mismatches into one focused follow-up task instead of reopening the broader coaching queue.
- Why: The runtime pass confirmed the endpoint set and narrowed the remaining work to contract-alignment fixes on one header, one request schema, and two success-response docs.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-610
- Decision: Narrow the coach self-update Swagger contract with a dedicated request DTO via `@ApiBody` instead of changing the underlying runtime DTO or service guard.
- Why: The live mismatch was documentation-specific for `PATCH /v1/coaching/coaches/me`; the service already enforces admin-only commission updates, so a Swagger-only request shape fixed the contract without widening the behavior change.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-610 Runtime
- Decision: When the host-owned local backend on `localhost:3000` is stale and cannot be restarted from the sandbox, verify the current code by booting a fresh local FitTrack instance on a temporary port and checking its live `/v1/docs-json`.
- Why: `TASK-610` required a live OpenAPI pass, but the sandbox could not replace the stale `:3000` process even though the current code and temporary inline boots were healthy.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
