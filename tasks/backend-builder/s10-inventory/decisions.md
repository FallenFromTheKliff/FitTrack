# S10 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S10 - Inventory`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S10 auto mode do not default to automatic acceptance
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
- reusable in later S10 tasks
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

## 2026-03-27 - TASK-1002
- Decision: `GET /v1/inventory/equipment/:id` returns the full item plus descending `write_offs`, while the dedicated `/writeoffs` route remains the paginated history surface.
- Why: the S10 context requires detail-with-history and a separate paginated history endpoint, and this split satisfies both without introducing a new response shape decision.
- Impact: low
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1003
- Decision: cash product sales reject insufficient stock with `422` and create no transaction.
- Why: this keeps inventory truthful, avoids negative stock behavior, and matches the repo's existing invariant-enforcement pattern.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1003
- Decision: the cash-only product-sale slice does not create shared `payments` records or persistent idempotency handling yet.
- Why: the current shared payment model requires `payments.user_id`, but inventory sales can be walk-ins with no member owner, so forcing the payment backbone here would encode the wrong ownership contract before `TASK-1004` resolves the product-payment alignment.
- Impact: medium
- Review Status: revisit
- Architecture Follow-up: no

## 2026-03-27 - TASK-1004
- Decision: product sales that start shared PayMongo checkout must record a real `customer_user_id`, and shared `payments.user_id` will point to that customer instead of the staff member who processed the counter sale.
- Why: this keeps the shared payment backbone truthful for `payable_type=product`, preserves the existing `payment.completed` event contract, and avoids encoding staff as the payer for walk-in/member purchases.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-27 - TASK-1004
- Decision: keep the S10 sale-owner migration limited to the new `customer_user_id` column, index, and foreign key, and remove any auto-generated drops for unrelated raw-SQL guard indexes before keeping the migration.
- Why: those partial/composite guard indexes are owned by earlier checked-in migrations and some are created later in timestamp order, so carrying the generated drops forward would make clean rebuilds fail or silently remove unrelated constraints.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-27 - TASK-1005
- Decision: use active admins with `notification_preferences.system_email = true` and their first email/google identity as the recipient set for S10 low-stock and equipment write-off alerts.
- Why: S10 calls for admin-only alerts, the repo already stores system-email preference flags there, and reusing the existing auth-identity email source avoids inventing a second recipient store.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: yes

## 2026-03-27 - TASK-1004
- Decision: reserve retail-product stock when a PayMongo sale is initiated, then treat `payment.completed` as the status-transition step instead of a second inventory decrement.
- Why: this keeps the shared payment event flow intact while closing the oversell race between pending checkout creation and later webhook completion.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-27 - TASK-1002
- Decision: equipment write-offs must use a guarded quantity update and fail with `409` when the current quantity changed before the write-off could commit.
- Why: stale read validation inside a normal Prisma transaction was not sufficient to protect the count invariant under concurrent write-offs.
- Impact: high
- Review Status: accepted
- Architecture Follow-up: no
