-- No duplicate active availability slots for a coach.
CREATE UNIQUE INDEX coach_slot_unique
  ON coach_availability_slots(coach_id, day_of_week, start_time)
  WHERE is_active = true;

-- One active or pending coach-member relationship per pair.
CREATE UNIQUE INDEX coach_client_active_unique
  ON coach_client_relationships(coach_id, member_id)
  WHERE status IN ('pending', 'active');
