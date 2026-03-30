-- Align nutrition log units to a closed enum contract.
CREATE TYPE "NutritionUnit" AS ENUM (
  'g',
  'kg',
  'ml',
  'L',
  'oz',
  'lb',
  'cup',
  'tbsp',
  'tsp',
  'serving',
  'piece'
);

ALTER TABLE "nutrition_logs"
  ALTER COLUMN "unit" DROP DEFAULT;

ALTER TABLE "nutrition_logs"
  ALTER COLUMN "unit" TYPE "NutritionUnit"
  USING CASE
    WHEN "unit" IN (
      'g',
      'kg',
      'ml',
      'L',
      'oz',
      'lb',
      'cup',
      'tbsp',
      'tsp',
      'serving',
      'piece'
    ) THEN "unit"::"NutritionUnit"
    ELSE 'serving'::"NutritionUnit"
  END;

ALTER TABLE "nutrition_logs"
  ALTER COLUMN "unit" SET DEFAULT 'serving';

-- One active TDEE snapshot per user.
CREATE UNIQUE INDEX one_active_tdee
  ON tdee_profiles(user_id)
  WHERE is_active = true;

-- One active macro target per user.
CREATE UNIQUE INDEX one_active_macro
  ON macro_targets(user_id)
  WHERE is_active = true;
