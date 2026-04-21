# S4 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S4 - Subscription & Payments`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `yes`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S4 auto mode may be resolved automatically
- the chosen answer should be the recommended or safest default, not blindly `yes`
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
- reusable in later S4 tasks
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

## 2026-03-22 - TASK-401
- Decision: Use `src/membership/` as the first concrete S4 module root for membership-plan work, and extend that module for nearby membership reads before introducing additional S4 module roots.
- Why: The first implemented S4 slice is plan CRUD/read behavior, and keeping it under one concrete module path reduces drift while later S4 pieces are still forming.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-23 - TASK-401
- Decision: Keep Prisma delegate typing relaxed at the base-repository boundary, then enforce safer shapes inside helper methods with local casts and shared request/helper types.
- Why: Strict delegate parameter typing satisfied lint but broke assignability against generated Prisma delegates during build; this boundary keeps build compatibility while preserving repo-wide type-safety improvements.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-23 - TASK-403
- Decision: Migration tasks in this repo should add checked-in SQL artifacts and verify them by file inspection plus non-destructive app checks unless the user explicitly asks to run database migrations.
- Why: Guardrails prohibit casually running migrations, and the repo currently has no established DB-backed migration test harness to execute in task mode.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-23 - TASK-404
- Decision: Keep the shared S4 payments core inside `src/membership/` for now, and enforce manual-payment ownership by resolving the payable owner first, then allowing only the owner or admin/staff to submit the payment.
- Why: The S4 module is still forming, and this keeps payment reads/manual verification close to existing membership work while closing an ownership gap before later gateway tasks reuse the same payment backbone.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-23 - TASK-402
- Decision: Subscription access rules now live behind `MembershipService.hasSubscriptionAccess()`, and cross-domain consumers should use that exported S4 service instead of reaching into `user.repository` or duplicating subscription queries.
- Why: Attendance already depended on subscription state, and moving the rule behind the owning domain service keeps `active`, `past_due`, and `cancelled with future expires_at` behavior in one place.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-24 - TASK-407
- Decision: Shared uploads now live in a dedicated `src/files/` module with a storage-adapter seam, and other domains should consume `FilesService` rather than embedding upload logic or storage signatures inline.
- Why: Upload behavior is shared infrastructure, and the avatar stub plus manual-payment screenshot flow both needed one stable place for validation, object-key generation, and R2 integration.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-24 - TASK-405
- Decision: Store the PayMongo checkout session id in `payments.provider_ref`, cache the checkout URL plus reference metadata in `payments.gateway_metadata`, and route subscription activation through the shared `payment.completed` event.
- Why: The session id is the stable provider reference from checkout creation, the cached checkout URL makes idempotent retries return the same link without another provider round-trip, and the shared event path keeps manual approvals and future webhook completion on one activation rule.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-24 - TASK-406
- Decision: Verify PayMongo webhook signatures from the raw request body using a dedicated provider helper, treat `checkout_session.payment.paid` as the supported completion event for S4, and deduplicate processing through `payments.gateway_event_id`.
- Why: Raw-body verification is required for trustworthy signatures, `provider_ref` now stores the checkout session id from `TASK-405`, and the unique `gateway_event_id` path lets retries acknowledge safely without replaying subscription activation.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-408
- Decision: Keep subscription reminders on the existing generic Bull mail and SMS processors, and schedule lifecycle work from a dedicated `subscription-lifecycle` queue inside the membership domain.
- Why: The repo already has stable generic delivery workers, while the warning and expiry cadence is S4-specific and benefits from one domain-owned scheduler and processor pair.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-24 - TASK-409
- Decision: Use a split confidence strategy for final S4 coverage: HTTP-level e2e tests for controller contracts and a real `EventEmitterModule` integration spec for webhook completion into subscription activation.
- Why: The full S4 surface spans guards, DTO validation, response shaping, provider boundaries, and cross-service events; this split covers the highest-risk seams without requiring live external providers or a full database harness.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-25 - TASK-410
- Decision: For envelope-wrapped S4 read endpoints, document success responses explicitly with Swagger schemas instead of relying on inferred metadata.
- Why: The live OpenAPI surface underdocumented several successful S4 reads even though the routes were implemented correctly, and the response interceptor means the documented contract needs explicit `{ data, meta? }` shapes.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
