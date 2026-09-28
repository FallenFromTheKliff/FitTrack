-- Drop the retired promotions table and its only application index.
DROP INDEX IF EXISTS "gym_promotions_starts_at_ends_at_is_active_idx";
DROP TABLE "gym_promotions";
