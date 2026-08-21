# S9 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S9 - TDEE & Nutrition`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S9 auto mode do not default to automatic acceptance
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
- reusable in later S9 tasks
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

## 2026-03-27 - TASK-901
- Decision: S9 nutrition units now use a closed Prisma enum, and the active TDEE/macro snapshot invariants are enforced through checked-in raw SQL partial unique indexes instead of application-only assumptions.
- Why: The S9 design already treated unit values and active snapshot counts as strict contracts, and later S9 service logic should be able to rely on the database to reject invalid drift instead of re-implementing those guards in each write path.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-902
- Decision: The active S9 read contract requires an active macro target attached to the active TDEE profile, and the read surface fails with an explicit `MacroTarget Not Found` error instead of silently returning partial nutrition state.
- Why: The S9 context describes the active TDEE and macro target as a paired snapshot, so returning only half of that pair would weaken the read contract and hide data drift that later recalculation logic is supposed to prevent.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-903
- Decision: S9 recalculation requires the full merged profile snapshot (`date_of_birth`, `gender`, `weight_kg`, `height_cm`, `activity_level`, `fitness_goal`) before calling `/calculate-tdee`, and the post-commit side effect stays at a bounded `nutrition.tdee-recalculated` event instead of writing notifications directly.
- Why: TDEE cannot be recalculated safely from only a partial profile, and keeping the side effect at an event boundary preserves the S9 scope while still creating a stable hook for later notification work.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-904
- Decision: New nutrition logs attach to the active macro target only when one exists, and the daily-summary contract returns `target = null` plus `remaining = null` when no active macro target exists instead of failing the request.
- Why: The S9 task context explicitly treats missing active targets as a valid nullable state for logging, so writes and daily reads should stay usable during onboarding or between recalculation snapshots instead of forcing artificial failures.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-905
- Decision: S9 route-level verification follows the repo's existing controller-plus-mocked-service e2e pattern, and `POST /v1/nutrition/tdee/recalculate` explicitly returns HTTP 200 because it refreshes the current snapshot contract instead of creating a distinct resource.
- Why: The repo already uses fast controller-focused e2e suites to verify auth, validation, and response envelopes without dragging Prisma and full app wiring into every domain slice, and the recalculation route's documented Swagger contract already described a 200 response.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-906
- Decision: The S9 live verification pass applied the pending checked-in local migration before Swagger inspection and treated the live OpenAPI bearer-security metadata plus unauthorized runtime response as the final contract check for protected nutrition routes.
- Why: The API verification driver explicitly allows the checked-in-only `prisma migrate deploy` baseline when local runtime verification would otherwise be out of sync, and protected routes can be verified safely through live docs plus standardized 401 behavior even without creating a test session token.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
