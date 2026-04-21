-- One active or pending subscription per user.
CREATE UNIQUE INDEX subscriptions_one_active_per_user
  ON subscriptions(user_id)
  WHERE status IN ('active', 'past_due', 'pending_payment');
