-- Keep the DB-backed muscle contract complete when an earlier branch migration
-- was applied before all canonical system definitions were present.
INSERT INTO "muscle_definitions" ("id", "key", "name", "body_region", "aliases", "sort_order", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'chest', 'Chest', 'upper_body_push', '["pecs","pectorals"]'::jsonb, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'upper_chest', 'Upper Chest', 'upper_body_push', '["upper chest"]'::jsonb, 11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'lats', 'Lats', 'upper_body_pull', '["latissimus dorsi"]'::jsonb, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'upper_back', 'Upper Back', 'upper_body_pull', '["mid back","rhomboids"]'::jsonb, 21, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'traps', 'Traps', 'upper_body_pull', '["trapezius"]'::jsonb, 22, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'shoulders', 'Shoulders', 'shoulders', '["delts","deltoids"]'::jsonb, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'front_delts', 'Front Delts', 'shoulders', '["anterior delts"]'::jsonb, 31, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'side_delts', 'Side Delts', 'shoulders', '["lateral delts"]'::jsonb, 32, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'rear_delts', 'Rear Delts', 'shoulders', '["posterior delts"]'::jsonb, 33, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'biceps', 'Biceps', 'arms', '["bis"]'::jsonb, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'triceps', 'Triceps', 'arms', '["tris"]'::jsonb, 41, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'forearms', 'Forearms', 'arms', '["grip"]'::jsonb, 42, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'abs', 'Abs', 'core', '["abdominals"]'::jsonb, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'obliques', 'Obliques', 'core', '["side abs"]'::jsonb, 51, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'core', 'Core', 'core', '["trunk"]'::jsonb, 52, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'lower_back', 'Lower Back', 'core', '["spinal erectors","erectors"]'::jsonb, 53, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'glutes', 'Glutes', 'lower_body', '["butt","gluteals"]'::jsonb, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'quads', 'Quads', 'lower_body', '["quadriceps"]'::jsonb, 61, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hamstrings', 'Hamstrings', 'lower_body', '["hams"]'::jsonb, 62, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'calves', 'Calves', 'lower_body', '["gastroc","soleus"]'::jsonb, 63, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'adductors', 'Adductors', 'lower_body', '["inner thighs"]'::jsonb, 64, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'abductors', 'Abductors', 'lower_body', '["outer hips"]'::jsonb, 65, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hip_flexors', 'Hip Flexors', 'lower_body', '["iliopsoas"]'::jsonb, 66, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

UPDATE "muscle_definitions"
SET "is_active" = true,
    "is_system" = true
WHERE "is_system" = true
  AND "key" IN (
    'chest', 'upper_chest', 'lats', 'upper_back', 'traps', 'shoulders',
    'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms',
    'abs', 'obliques', 'core', 'lower_back', 'glutes', 'quads', 'hamstrings',
    'calves', 'adductors', 'abductors', 'hip_flexors'
  );
