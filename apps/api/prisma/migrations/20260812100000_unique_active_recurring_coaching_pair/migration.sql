CREATE UNIQUE INDEX "recurring_coaching_plans_active_coach_member_unique"
ON "recurring_coaching_plans" ("coach_id", "member_id")
WHERE "status" IN ('awaiting_payment', 'active', 'paused');
