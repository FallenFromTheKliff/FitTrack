# S11 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S11 - AI Chatbot`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S11 auto mode do not default to automatic acceptance
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
- reusable in later S11 tasks
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

## 2026-03-27 - TASK-1101
- Decision: enforce one active AI chat session per `user_id + context_type` with the raw partial unique index `one_active_ai_session_per_context`, and keep session/message access behind ownership-scoped repository methods.
- Why: later S11 controller and chat-service work depends on stable single-session lookup semantics and must not duplicate ownership checks ad hoc.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1101
- Decision: route AI interaction writes through one shared repository seam and keep plan-generation logging as a thin wrapper on top of it.
- Why: S11 needs the same persistence contract for chat, plan generation, and future action-triggered logs without forking write logic per flow.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1103
- Decision: when `POST /v1/ai/chat` is called without `session_id`, default the new or reused chat context to `general`.
- Why: the S11 context file marks `context_type` optional for new chat starts, and `general` is the safest stable fallback that does not imply a nutrition or training side effect.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1103
- Decision: stale sessions found through explicit `session_id` are archived and return `410 SESSION_ARCHIVED`, while stale sessions discovered during implicit context reuse are archived and replaced with a fresh session.
- Why: explicit resume attempts should surface the documented archived-session failure path, but starting a new chat in a context should not dead-end on stale state that the user did not directly target.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1104
- Decision: AI chat actions are best-effort side effects; unknown action strings, invalid DTO shapes, and downstream `HttpException` validation failures are ignored so the assistant reply still succeeds.
- Why: S11 documents `reply + optional action result`, so action execution should enrich the chat path without turning malformed or non-executable side effects into user-visible chat failures.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1104
- Decision: `LOG_NUTRITION` action payloads default missing `protein_g`, `carbs_g`, and `fat_g` to `0`, `quantity` to `1`, `unit` to `serving`, `meal_name` to `General`, and `log_date` to today before calling `NutritionService.logNutrition()`.
- Why: the S11 context contract documents those defaults, and applying them in `AiService` keeps the action path aligned with the owning nutrition DTO without duplicating write logic in a second domain layer.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
