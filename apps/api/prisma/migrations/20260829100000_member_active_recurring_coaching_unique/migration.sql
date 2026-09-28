-- Enforce one active or paused monthly coaching entitlement per member.
-- Awaiting-payment rows remain outside this invariant so retries and
-- same-coach idempotency continue to use their existing hold lifecycle.
CREATE UNIQUE INDEX "recurring_coaching_plans_active_member_unique"
ON "recurring_coaching_plans" ("member_id")
WHERE "status" IN ('active', 'paused');
