# S8 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S8 - Gamification`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S8 auto mode do not default to automatic acceptance
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
- reusable in later S8 tasks
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

## 2026-03-27 - TASK-801
- Decision: The S8 leaderboard includes active `member` and `coach` participant profiles even when they do not have mastery rows yet, while excluding internal `admin` and `staff` accounts; mastery responses also expose a derived `rank_display` string alongside the raw rank enum.
- Why: The S8 context describes a gym-wide participant leaderboard and explicitly calls out Adamantite overflow display behavior, so the safest reusable default is to include end-user participants with zero XP while keeping internal staff accounts out of the ranking surface.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-802
- Decision: S8 workout-completion mastery accrual treats each `exercise_log` row as one completed set and falls back from `reps_completed` to `reps_ai_counted` when manual reps are absent.
- Why: The S7 workout log model already stores one row per set, and the existing workout-session completion flow uses the same AI-rep fallback when manual reps are missing, so this keeps XP and volume progression aligned with the persisted session totals.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-803
- Decision: S8 rank-up emails use the same preferred-email heuristic as the existing lifecycle modules by targeting the first `email` or `google` auth identity, and a missing `rank_up_email` preference is treated as enabled unless it is explicitly `false`.
- Why: Reusing the current mail-recipient and opt-in conventions keeps gamification notifications aligned with the booking and coaching flows without introducing a new user-facing preference default just for S8.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-805 Findings
- Decision: Route the live S8 Swagger mismatches into one focused follow-up task instead of reopening the broader gamification queue.
- Why: The runtime pass confirmed the S8 routes, bearer-auth protection, and success envelopes, leaving only two documentation-specific nullable field typings (`last_ranked_at` and `avatar_url`) to correct.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-806 Runtime
- Decision: When the host-owned local backend on `localhost:3000` is stale, verify the current S8 OpenAPI contract by booting a fresh local FitTrack instance on a temporary port and inspecting its live `/v1/docs-json` before shutting it down.
- Why: The S8 contract fix only changed Swagger output, and the host-owned `:3000` backend continued serving the pre-fix document even after code-level checks were green.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no
