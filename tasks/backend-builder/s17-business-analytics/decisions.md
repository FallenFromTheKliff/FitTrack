# S17 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S17 - Business Analytics`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S17 auto mode do not default to automatic acceptance
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
- reusable in later S17 tasks
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
## 2026-03-30 - TASK-1701
- Decision: Start S17 with an additive Prisma contract slice before grounding, Python, or HTTP work.
- Why: Every downstream S17 task depends on stable enums and persisted insight-run storage, while the current repo already has reusable Nest analytics and AI seams that should layer on top instead of being redesigned first.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1702
- Decision: Treat S17 `custom` windows as daily series buckets, and rank `top_plans` plus `top_products` from completed in-window financial events.
- Why: The context defines a custom date window but not a distinct bucket size, and completed payments or sales are the safest stable source for comparative revenue insights without changing existing S13 read semantics.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1703
- Decision: Keep the S17 Python scaffold tests route-level and monkeypatch the business-insight service or provider instead of making live OpenRouter calls during this slice.
- Why: The current microservice already uses strict FastAPI plus Pydantic contract tests with `TestClient`, and monkeypatching preserves deterministic coverage while still leaving the default runtime seam OpenRouter-oriented.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1704
- Decision: Use the generated S17 grounding payload as the canonical normalized request snapshot, and persist only successful validated insight runs using the exact `{ grounding }` Python request body plus the returned insight payload.
- Why: `AnalyticsService` already owns the focus and date-window normalization logic, while `BusinessInsightRun` requires `insight_payload` and has no error column, so duplicating normalization or inserting partial failure rows would create drift without improving the contract.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1705
- Decision: Keep the S17 coverage pass focused on untested provider and regression edges rather than broadening into e2e or re-covering the already-tested route and orchestration seams.
- Why: `TASK-1703` and `TASK-1704` already cover the route, DTO, controller, repository, service, and AI-client contracts, so the remaining high-signal risk is concentrated in Python provider parsing or anomaly logic and a few nullable stored-payload mappings.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1706
- Decision: Make the S17 runtime pass fully local and deterministic by using the shared API verification driver plus a temporary OpenAI-compatible stub for the Python provider path, while auto-applying the checked-in S17 migration before the live pass.
- Why: The runtime slice must verify the real Nest -> Python -> provider-adapter contract, but the local environment has no guaranteed seeded admin account and should not depend on external OpenRouter reachability; the only Prisma blocker is the already-checked-in `BusinessInsightRun` migration needed for live persistence.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no
