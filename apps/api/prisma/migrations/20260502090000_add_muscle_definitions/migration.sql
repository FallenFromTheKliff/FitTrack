CREATE TABLE "muscle_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "body_region" VARCHAR(80) NOT NULL,
  "aliases" JSONB,
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "muscle_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "muscle_definitions_key_key" ON "muscle_definitions"("key");
CREATE INDEX "muscle_definitions_body_region_is_active_idx" ON "muscle_definitions"("body_region", "is_active");
CREATE INDEX "muscle_definitions_is_active_sort_order_idx" ON "muscle_definitions"("is_active", "sort_order");

INSERT INTO "muscle_definitions" ("key", "name", "body_region", "aliases", "sort_order", "is_system")
VALUES
  ('chest', 'Chest', 'upper_body_push', '["pecs","pectorals"]'::jsonb, 10, true),
  ('upper_chest', 'Upper Chest', 'upper_body_push', '["upper chest"]'::jsonb, 11, true),
  ('lats', 'Lats', 'upper_body_pull', '["latissimus dorsi"]'::jsonb, 20, true),
  ('upper_back', 'Upper Back', 'upper_body_pull', '["mid back","rhomboids"]'::jsonb, 21, true),
  ('traps', 'Traps', 'upper_body_pull', '["trapezius"]'::jsonb, 22, true),
  ('shoulders', 'Shoulders', 'shoulders', '["delts","deltoids"]'::jsonb, 30, true),
  ('front_delts', 'Front Delts', 'shoulders', '["anterior delts"]'::jsonb, 31, true),
  ('side_delts', 'Side Delts', 'shoulders', '["lateral delts"]'::jsonb, 32, true),
  ('rear_delts', 'Rear Delts', 'shoulders', '["posterior delts"]'::jsonb, 33, true),
  ('biceps', 'Biceps', 'arms', '["bis"]'::jsonb, 40, true),
  ('triceps', 'Triceps', 'arms', '["tris"]'::jsonb, 41, true),
  ('forearms', 'Forearms', 'arms', '["grip"]'::jsonb, 42, true),
  ('abs', 'Abs', 'core', '["abdominals"]'::jsonb, 50, true),
  ('obliques', 'Obliques', 'core', '["side abs"]'::jsonb, 51, true),
  ('core', 'Core', 'core', '["trunk"]'::jsonb, 52, true),
  ('lower_back', 'Lower Back', 'core', '["spinal erectors","erectors"]'::jsonb, 53, true),
  ('glutes', 'Glutes', 'lower_body', '["butt","gluteals"]'::jsonb, 60, true),
  ('quads', 'Quads', 'lower_body', '["quadriceps"]'::jsonb, 61, true),
  ('hamstrings', 'Hamstrings', 'lower_body', '["hams"]'::jsonb, 62, true),
  ('calves', 'Calves', 'lower_body', '["gastroc","soleus"]'::jsonb, 63, true),
  ('adductors', 'Adductors', 'lower_body', '["inner thighs"]'::jsonb, 64, true),
  ('abductors', 'Abductors', 'lower_body', '["outer hips"]'::jsonb, 65, true),
  ('hip_flexors', 'Hip Flexors', 'lower_body', '["iliopsoas"]'::jsonb, 66, true);
