# S16 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S16 - AI Chatbot`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S16 auto mode do not default to automatic acceptance
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
- reusable in later S16 tasks
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

## 2026-03-29 - TASK-1601
- Decision: Implement S16 additively with new `GymChat*` tables and `/v1/gym-chat/*` routes while preserving the legacy S11 `AiChat*` persistence and `/v1/ai/*` surface.
- Why: The current repo still serves the older AI assistant contract, and replacing it in place would mix migration risk into the new gym-chat scope.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-29 - TASK-1605
- Decision: Reuse the existing 14-day lazy session archival rule for S16 chat sessions unless a later S16 task uncovers a conflicting product requirement.
- Why: The legacy AI chat flow already applies that inactivity window, and the S16 context did not introduce a competing archival threshold during review.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1605
- Decision: Treat the current deterministic Python `/chat/gym` scaffold as the integration target for the Nest message-flow slice, and keep live OpenRouter provider work out of `TASK-1605` unless the scaffold itself blocks contract completion.
- Why: `TASK-1604` intentionally staged the Python boundary as a contract-safe scaffold, and `TASK-1605` can complete the S16 grounding, persistence, and session lifecycle behavior against that stable interface without mixing in provider-adapter risk.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1601
- Decision: Reuse `MembershipPlan` as the S16 membership grounding source and keep assistant follow-up suggestions inside logged response JSON instead of adding dedicated Prisma columns in the contract-alignment slice.
- Why: The existing membership plan model already carries the facts needed for grounded pricing and duration answers, and the S16 context defined follow-up suggestions as reply metadata rather than a required persistence column.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1602
- Decision: Treat the S16 member session "detail" read surface as session list plus `/v1/gym-chat/sessions/:id/messages` history and archive, without adding a standalone `GET /v1/gym-chat/sessions/:id` route in this slice.
- Why: The S16 contract explicitly lists list, message-history, and archive endpoints, while the standalone session-detail GET exists only on the legacy S11 AI surface.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1603
- Decision: Keep the S16 admin knowledge slice limited to the documented `GET/PUT/POST` routes, treat `PUT /v1/gym-chat/knowledge/hours` as an authoritative weekly snapshot, and avoid inventing PATCH or DELETE endpoints or cross-record precedence rules for schedules and promotions in this task.
- Why: The S16 context defines replacement semantics for weekly hours and list or create semantics for the other knowledge entities, but it does not define edit lifecycles or precedence behavior beyond that documented surface.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1604
- Decision: Scope the Python gym-chat slice to an additive `/chat/gym` scaffold with strict request and response models, deterministic contract-safe replies, and focused FastAPI tests, while deferring live OpenRouter integration and Nest client rewiring to downstream message-flow work.
- Why: The current Python microservice has no gym-chat route, provider adapter, or runtime HTTP client dependency, and the task itself is explicitly framed as a scaffold rather than the full grounded inference integration.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1606
- Decision: Keep the S16 coverage slice focused on unpinned member `gym-chat` failure paths and strict Python contract validation, and do not broaden it into duplicate admin knowledge coverage or new feature work.
- Why: The current review gaps are concentrated in the member send-message route, out-of-scope persistence behavior, and strict `/chat/gym` request validation, while the admin knowledge surface is already covered and broader changes would dilute the final pre-verification coverage pass.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-30 - TASK-1607
- Decision: Start the S16 runtime slice by rewriting the shared `tasks/api-verification-driver.md` to the active S16 scope, then run the live pass with deterministic local JWTs and temporary local fixtures instead of depending on unknown seeded login credentials.
- Why: The shared API driver is still pointed at S15, and unattended live verification needs a repeatable auth and data strategy for the member and admin `gym-chat` routes.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
