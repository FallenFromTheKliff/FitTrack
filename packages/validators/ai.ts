import { z } from "zod";

export const aiChatContextSchema = z.enum(["general", "tdee_adjustment", "training_plan", "nutrition"]);

export const aiChatSchema = z.object({
  context_type: aiChatContextSchema.optional(),
  message: z.string().trim().min(1, "Message is required.").max(2000, "Message must not exceed 2000 characters."),
  session_id: z.string().uuid("Session id must be a valid UUID.").optional(),
  start_new_session: z.boolean().optional()
});

export const aiGeneratePlanSchema = z.object({
  days_per_week: z.number().int().min(1, "Days per week must be at least 1.").max(7, "Days per week must not exceed 7."),
  duration_weeks: z.number().int().min(1, "Duration must be at least 1 week.").max(52, "Duration must not exceed 52 weeks."),
  preferences: z.string().trim().max(500, "Preferences must not exceed 500 characters.").optional()
});

export type AiChatData = z.infer<typeof aiChatSchema>;
export type AiGeneratePlanData = z.infer<typeof aiGeneratePlanSchema>;
