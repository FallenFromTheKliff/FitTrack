-- One active AI chat session per user and context.
CREATE UNIQUE INDEX one_active_ai_session_per_context
  ON ai_chat_sessions(user_id, context_type)
  WHERE is_active = true;
