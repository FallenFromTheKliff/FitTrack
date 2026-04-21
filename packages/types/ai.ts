export type AiChatContext = "general" | "tdee_adjustment" | "training_plan" | "nutrition";

export type AiChatRole = "user" | "assistant";

export type AiChatAction = "ADJUST_TDEE" | "GENERATE_PLAN" | "LOG_NUTRITION";

export type AiPaginationParams = {
  limit?: number;
  page?: number;
};

export type AiChatRequest = {
  context_type?: AiChatContext;
  message: string;
  session_id?: string;
  start_new_session?: boolean;
};

export type AiTrainingPlanExerciseRecord = {
  category: string;
  duration_seconds: number | null;
  exercise_id: string;
  exercise_name: string;
  id: string;
  muscle_group: string;
  notes: string | null;
  order_index: number;
  reps: number | null;
  rest_seconds: number;
  sets: number;
  weight_kg_target: string | null;
};

export type AiTrainingPlanScheduleDayRecord = {
  day_of_week: number;
  exercises: AiTrainingPlanExerciseRecord[];
  focus_label: string | null;
  id: string;
  notes: string | null;
  week_number: number;
};

export type AiTrainingPlanDetailRecord = {
  coach_id: string | null;
  created_at: string;
  days_per_week: number;
  duration_weeks: number;
  goal: string;
  id: string;
  is_active: boolean;
  is_template: boolean;
  schedule_days: AiTrainingPlanScheduleDayRecord[];
  source: string;
  title: string;
  updated_at: string;
  user_id: string;
};

export type AiChatActionResult = Record<string, unknown> | AiTrainingPlanDetailRecord | null;

export type AiChatResponse = {
  action_result: AiChatActionResult;
  action_triggered: AiChatAction | null | string;
  reply: string;
  session_id: string;
};

export type AiChatSessionRecord = {
  context_type: AiChatContext;
  created_at: string;
  id: string;
  is_active: boolean;
  last_activity_at: string;
  title: string | null;
  updated_at: string;
  user_id: string;
};

export type AiChatMessageRecord = {
  action_triggered: string | null;
  content: string;
  created_at: string;
  id: string;
  role: AiChatRole;
  session_id: string;
  updated_at: string;
};

export type AiGeneratePlanInput = {
  days_per_week: number;
  duration_weeks: number;
  preferences?: string;
};
