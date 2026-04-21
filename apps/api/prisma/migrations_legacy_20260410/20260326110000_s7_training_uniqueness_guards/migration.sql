-- One active non-template training plan per user.
CREATE UNIQUE INDEX one_active_plan_per_user
  ON training_plans(user_id)
  WHERE is_active = true AND is_template = false;

-- No duplicate exercise sets per session and exercise pair.
CREATE UNIQUE INDEX exercise_log_set_unique
  ON exercise_logs(session_id, exercise_id, set_number);
