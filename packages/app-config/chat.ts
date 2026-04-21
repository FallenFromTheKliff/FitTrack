import { ApiClientError } from "@fittrack/api-client";

type AiSessionLike = {
  context_type?: string | null;
  title?: string | null;
};

export const AI_CONTEXT_LABELS: Record<string, string> = {
  general: "General coaching",
  tdee_adjustment: "TDEE adjustment",
  training_plan: "Training plan",
  nutrition: "Nutrition"
};

export const WEB_GREETING_MESSAGE =
  "Hello! I'm BrodigyAI. Ask me about training plans, nutrition, or your next workout.";

export const MOBILE_GREETING_MESSAGE =
  "Hello! I'm BrodigyAI. Ask me about training plans, nutrition, or your next workout.";

export function getAiChatErrorMessage(error: unknown, fallback = "Unable to send AI message.") {
  if (error instanceof ApiClientError) {
    if (error.kind === "timeout") {
      return "BrodigyAI timed out before the server responded. Please try again.";
    }

    if (error.kind === "network") {
      return "BrodigyAI is unreachable right now. Check the connection and try again.";
    }

    if (error.message.trim()) {
      return error.message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export function getAiContextLabel(contextType?: string | null) {
  if (!contextType) return "AI chat";
  return AI_CONTEXT_LABELS[contextType] ?? "AI chat";
}

export function getAiSessionDisplayTitle(session?: AiSessionLike | null) {
  const title = session?.title?.trim();
  if (title) return title;
  return getAiContextLabel(session?.context_type);
}
