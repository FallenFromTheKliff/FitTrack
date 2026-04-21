# S13 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S13 - Gym Layout & Analytics`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S13 auto mode do not default to automatic acceptance
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
- reusable in later S13 tasks
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

## 2026-03-28 - TASK-1305
- Decision: Close the S13 coverage slice with a verification-only pass after confirming the required gym-layout, analytics, and realtime gateway specs already existed and were green.
- Why: The active task explicitly said to stop if meaningful S13 behavior remained unimplemented and this slice would turn into a hidden feature task. Reusing the existing focused coverage kept the queue honest and preserved `TASK-1306` as the dedicated runtime verification step.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1304
- Decision: Approve S13 as a shared exception that extends Redis and WebSocket usage to the `/gym-layout` namespace plus the `equipment_status` hash and `equipment:status` pub/sub channel.
- Why: The realtime gym-layout slice is now implemented in the main repo, and leaving the global contracts narrower than the actual platform behavior would create a recurring documentation conflict for future tasks.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1304B
- Decision: Use one gym-layout delta envelope with `{ operation, equipment }` so create, update, and remove events can share the same Redis pub/sub channel and client event handler.
- Why: A single delta contract keeps the realtime flow small while still covering soft delete and map updates without inventing multiple parallel channels.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1303
- Decision: Define `active_members` as distinct member users whose started subscription window overlaps the requested analytics range, excluding `pending_payment` and `suspended` records.
- Why: This gives the members endpoint a range-aware, membership-based definition that fits the existing subscription model without collapsing it into attendance activity or current-day-only access semantics.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1302
- Decision: Treat `total_revenue` as actual gym revenue by combining membership, booking, product, and `coaching_gym_revenue`, while exposing full coaching payments separately as `coaching_payments_collected`.
- Why: The S13 context explicitly distinguishes collected coaching payments from the gym’s retained coaching revenue, and using the gym cut avoids overstating revenue in overview and revenue totals.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1303
- Decision: Promote the next analytics slice before the realtime task once `TASK-1302` completed, because it is now the first ready task in queue order and avoids the known Redis/WebSocket contract conflict for one more slice.
- Why: `TASK-1303` becomes unblocked immediately after `TASK-1302`, while `TASK-1304` is still the isolated contract-risk task.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1301
- Decision: Implement S13 map persistence as a dedicated top-level `src/gym-layout/` module with JWT-only reads, admin-only writes, and soft delete semantics while deferring realtime behavior.
- Why: This matches the repo's existing controller/service/repository pattern and keeps the first S13 slice unblocked by the unresolved Redis/WebSocket contract.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1304
- Decision: Isolate the Redis/WebSocket contract conflict into the dedicated realtime slice so gym-layout CRUD and analytics HTTP work can proceed first.
- Why: The existing `GymEquipment` schema and analytics data sources already support safe non-realtime implementation work, while the `/gym-layout` gateway design is the one S13 area that currently conflicts with shared repo contracts.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
