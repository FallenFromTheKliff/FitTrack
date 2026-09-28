import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@fittrack/api-client";
import {
  MOBILE_GREETING_MESSAGE,
  WEB_GREETING_MESSAGE,
  getAiChatErrorMessage,
  getAiSessionDisplayTitle
} from "@fittrack/app-config";
import {
  aiChatMessagesQueryOptions,
  aiChatMutationOptions,
  aiChatSessionQueryOptions,
  aiChatSessionsQueryOptions
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";
import { aiChatSchema } from "@fittrack/validators";

import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";

export type ChatbotMessage = { id: string; text: string; from: "ai" | "user" };
type UseChatbotScreenOptions = { isFocused?: boolean };

function normalizeParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveChatContext(from?: string | string[]) {
  const source = normalizeParam(from);
  if (source === "nutrition") return "nutrition" as const;
  return "general" as const;
}

function normalizeSessionId(value?: string | string[]) {
  const sessionId = normalizeParam(value);
  if (!sessionId || sessionId === "new") return null;
  return sessionId;
}

function isForbiddenError(error: unknown) {
  return error instanceof ApiClientError && error.status === 403;
}

export function useChatbotScreen({ isFocused = true }: UseChatbotScreenOptions = {}) {
  const params = useLocalSearchParams<{ from?: string | string[]; sessionId?: string | string[] }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { message: statusMessage, showMessage } = useTimedMessage(2400);

  const requestedSessionId = normalizeSessionId(params.sessionId);
  const requestedNewSession = normalizeParam(params.sessionId) === "new";
  const chatContext = resolveChatContext(params.from);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(requestedSessionId);
  const [input, setInput] = useState("");
  const [lastError, setLastError] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const isFrozen = user?.status === "frozen";
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const isCoachRole = user?.role === "COACH";
  const hasBrodigyAccess =
    user?.role === "ADMIN" ||
    user?.role === "STAFF" ||
    isCoachRole ||
    (user?.role === "USER" && user.membershipAccess === "member");
  const greetingMessage = isCoachRole ? WEB_GREETING_MESSAGE : MOBILE_GREETING_MESSAGE;

  useEffect(() => {
    setActiveSessionId(requestedSessionId);
  }, [requestedSessionId]);

  const sessionsQuery = useQuery({
    ...aiChatSessionsQueryOptions(mobileApiClient, { limit: 50 }),
    enabled: isFocused && hasBrodigyAccess
  });
  const sessions = sessionsQuery.data?.data ?? [];

  const sessionQuery = useQuery({
    ...aiChatSessionQueryOptions(mobileApiClient, activeSessionId ?? ""),
    enabled: isFocused && hasBrodigyAccess && !!activeSessionId && !sessions.some((session) => session.id === activeSessionId)
  });

  const messagesQuery = useQuery({
    ...aiChatMessagesQueryOptions(mobileApiClient, activeSessionId ?? "", { limit: 100 }),
    enabled: isFocused && hasBrodigyAccess && !!activeSessionId
  });

  const sendMutation = useMutation(aiChatMutationOptions(mobileApiClient, queryClient, user?.id));
  const selectedSession = sessions.find((session) => session.id === activeSessionId) ?? sessionQuery.data ?? null;
  const isSessionDeleted = selectedSession ? !selectedSession.is_active : false;
  const isServerAccessDenied = [
    sessionsQuery.error,
    sessionQuery.error,
    messagesQuery.error,
    sendMutation.error,
  ].some(isForbiddenError);
  const isMemberLocked = !hasBrodigyAccess || isServerAccessDenied;
  const memberLockStatusLabel = isServerAccessDenied
    ? "Access denied"
    : membershipCardStatus === "pending_verification"
      ? "Pending verification"
      : membershipCardStatus === "revoked"
        ? "Revoked"
        : hasBrodigyAccess
          ? user?.role === "ADMIN"
            ? "Admin"
            : user?.role === "STAFF"
              ? "Staff"
              : isCoachRole
                ? "Coach"
                : "Member"
          : "Non-member";
  const memberLockMessage = isServerAccessDenied
    ? "BrodigyAI access was denied for this account. Refresh your membership status or contact the gym if this looks incorrect."
    : membershipCardStatus === "pending_verification"
      ? "Your membership card payment is waiting for verification. BrodigyAI unlocks as soon as the card becomes active."
      : membershipCardStatus === "revoked"
        ? "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected."
        : "BrodigyAI chat unlocks after this account has an active membership card.";

  const messages = useMemo<ChatbotMessage[]>(() => {
    const liveMessages = (messagesQuery.data?.data ?? []).map<ChatbotMessage>((message) => ({
      id: message.id,
      text: message.content,
      from: message.role === "assistant" ? "ai" : "user"
    }));

    if (liveMessages.length === 0) {
      liveMessages.push({ id: "greeting", text: greetingMessage, from: "ai" });
    }

    if (pendingMessage) {
      liveMessages.push({ id: "pending-message", text: pendingMessage, from: "user" });
    }

    return liveMessages;
  }, [greetingMessage, messagesQuery.data, pendingMessage]);

  const send = async () => {
    if (isFrozen || isMemberLocked || isSessionDeleted) return;
    const submittedInput = input;
    if (!submittedInput.trim()) return;

    const parsed = aiChatSchema.safeParse({
      context_type: chatContext,
      message: submittedInput,
      ...(activeSessionId ? { session_id: activeSessionId } : {}),
      ...(!activeSessionId && requestedNewSession ? { start_new_session: true } : {})
    });

    if (!parsed.success) {
      setLastError(parsed.error.issues[0]?.message ?? "Message is required.");
      return;
    }

    setLastError("");
    setInput("");
    setPendingMessage(submittedInput);

    try {
      const result = await sendMutation.mutateAsync(parsed.data);
      setLastError("");
      if (result.session_id !== activeSessionId) {
        setActiveSessionId(result.session_id);
        router.replace({
          pathname: "/(tabs)/chatbot",
          params: {
            from: normalizeParam(params.from) ?? "chatbot",
            sessionId: result.session_id
          }
        });
      }
    } catch (error) {
      const errorMessage = getAiChatErrorMessage(error, "Unable to send AI message.");
      setInput(submittedInput);
      if (error instanceof ApiClientError && error.status === 410) {
        setActiveSessionId(null);
        router.replace({
          pathname: "/(tabs)/chatbot",
          params: {
            from: normalizeParam(params.from) ?? "chatbot",
            sessionId: "new"
          }
        });
      }
      setLastError(errorMessage);
      showMessage(errorMessage);
    } finally {
      setPendingMessage(null);
    }
  };

  return {
    canSend: !isFrozen && !isMemberLocked && !isSessionDeleted && !sendMutation.isPending && !!input.trim(),
    input,
    isFrozen,
    isMemberLocked,
    isPending: sendMutation.isPending,
    isSessionDeleted,
    lastError,
    memberLockMessage,
    memberLockStatusLabel,
    messages,
    send,
    sessionTitle: selectedSession ? getAiSessionDisplayTitle(selectedSession) : "New conversation",
    setInput,
    statusMessage
  };
}
