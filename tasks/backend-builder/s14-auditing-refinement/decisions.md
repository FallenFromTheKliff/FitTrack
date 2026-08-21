# S14 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S14 - Auditing Refinement`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S14 auto mode do not default to automatic acceptance
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
- reusable in later S14 tasks
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

## 2026-03-28 - TASK-1402
- Decision: `COACH_COMMISSION_CHANGED` uses `CoachProfile` as the audit entity and stores only the `gym_commission_pct` before/after snapshot.
- Why: The S14 context table already names `CoachProfile`, and limiting the payload to the changed commission field keeps the audit record focused on the sensitive mutation instead of copying unrelated coach profile data.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-28 - TASK-1402
- Decision: Keep `PAYMENT_REFUNDED` and `SUBSCRIPTION_SUSPENDED` in the shared audit action catalog, but treat both as deferred until their owning membership mutations exist in code.
- Why: A repo search across `src/membership` found no live refund or suspension mutation to wire during S14, and TASK-1402 explicitly stops short of inventing cross-domain behavior just to satisfy the audit list.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes
