# S7 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S7 - Fitness Training`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S7 auto mode do not default to automatic acceptance
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
- reusable in later S7 tasks
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

## 2026-03-26 - TASK-703
- Bypass Reason: `AUTO_APPROVE_NON_ELIGIBLE_TASKS` is enabled for `sleep`.
- Why Sleep Mode Continued: The task only added checked-in raw SQL guard indexes already documented in S7 schema comments and matched the existing guard-migration pattern.
- Outcome: success

---

## Current Entries

## 2026-03-26 - TASK-702
- Decision: Coach plan assignment requires an active coaching relationship, and the source plan can be any coach-owned plan until S7 gets a dedicated template-management surface.
- Why: S6 already defines active coach-member ownership, while S7 does not yet expose a separate template authoring rule beyond owned-plan copies.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-704
- Decision: Workout-session completion volume uses `reps_completed` first and falls back to linked `reps_ai_counted` only when manual reps are absent; starting a session may optionally link an owned plan but does not add a new one-active-session invariant that S7 schema/docs do not define.
- Why: The documented S7 flow requires stable completion totals and optional pose-session linkage, but this slice had to stay inside the existing Prisma contract without inventing new concurrency guards.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-26 - TASK-705
- Decision: AI plan generation requires a complete fitness-profile context (`date_of_birth`, `gender`, `weight_kg`, `height_cm`, `activity_level`, `fitness_goal`) before the backend will call the Python service, and the AI service is constrained with the active exercise catalog using exact exercise-name resolution on the way back in.
- Why: The documented Python contract needs age plus the user's physical/activity context, and exact active-catalog resolution preserves the S7 rule that generated plans must reuse the same training-plan persistence constraints as manual plans.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-706
- Decision: Pose WebSocket auth accepts a bearer token from handshake auth, the `Authorization` header, or a `token` query param, then applies the same JWT validity, blacklist, and active-user checks as the HTTP guard before creating a pose session.
- Why: The repo had no preexisting socket-auth convention, and this keeps pose clients aligned with the existing JWT contract without inventing a separate credential path.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-707
- Decision: S7 pre-runtime e2e coverage uses the repo's established controller-level Nest harness with mocked services plus real validation, guards, interceptors, and filters instead of booting the full DB-backed app before `TASK-708`.
- Why: Existing S5 and S6 e2e coverage already follow this pattern, and `TASK-708` is explicitly reserved for the live runtime verification pass after code-level checks are green.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no
