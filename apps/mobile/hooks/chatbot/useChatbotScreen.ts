import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@fittrack/api-client";
import {
  MOBILE_GREETING_MESSAGE,
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
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isMemberLocked = !!user && !hasMemberCardAccess;
  const memberLockStatusLabel = membershipCardStatus === "pending_verification"
    ? "Pending verification"
    : membershipCardStatus === "revoked"
      ? "Revoked"
      : hasMemberCardAccess
        ? "Member"
        : "Non-member";
  const memberLockMessage = membershipCardStatus === "pending_verification"
    ? "Your membership card payment is waiting for verification. BrodigyAI unlocks as soon as the card becomes active."
    : membershipCardStatus === "revoked"
      ? "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected."
      : "BrodigyAI chat unlocks after this account has an active membership card.";

  useEffect(() => {
    setActiveSessionId(requestedSessionId);
  }, [requestedSessionId]);

  const sessionsQuery = useQuery({
    ...aiChatSessionsQueryOptions(mobileApiClient, { limit: 50 }),
    enabled: isFocused
  });
  const sessions = sessionsQuery.data?.data ?? [];

  const sessionQuery = useQuery({
    ...aiChatSessionQueryOptions(mobileApiClient, activeSessionId ?? ""),
    enabled: isFocused && !!activeSessionId && !sessions.some((session) => session.id === activeSessionId)
  });

  const messagesQuery = useQuery({
    ...aiChatMessagesQueryOptions(mobileApiClient, activeSessionId ?? "", { limit: 100 }),
    enabled: isFocused && !!activeSessionId
  });

  const sendMutation = useMutation(aiChatMutationOptions(mobileApiClient, queryClient, user?.id));
  const selectedSession = sessions.find((session) => session.id === activeSessionId) ?? sessionQuery.data ?? null;

  const messages = useMemo<ChatbotMessage[]>(() => {
    const liveMessages = (messagesQuery.data?.data ?? []).map<ChatbotMessage>((message) => ({
      id: message.id,
      text: message.content,
      from: message.role === "assistant" ? "ai" : "user"
    }));

    if (liveMessages.length === 0) {
      liveMessages.push({ id: "greeting", text: MOBILE_GREETING_MESSAGE, from: "ai" });
    }

    if (pendingMessage) {
      liveMessages.push({ id: "pending-message", text: pendingMessage, from: "user" });
    }

    return liveMessages;
  }, [messagesQuery.data, pendingMessage]);

  const send = async () => {
    if (isFrozen || isMemberLocked) return;
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const parsed = aiChatSchema.safeParse({
      context_type: chatContext,
      message: trimmedInput,
      ...(activeSessionId ? { session_id: activeSessionId } : {}),
      ...(!activeSessionId && requestedNewSession ? { start_new_session: true } : {})
    });

    if (!parsed.success) {
      setLastError(parsed.error.issues[0]?.message ?? "Message is required.");
      return;
    }

    setLastError("");
    setInput("");
    setPendingMessage(trimmedInput);

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
      setInput(trimmedInput);
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
    canSend: !isFrozen && !isMemberLocked && !sendMutation.isPending && !!input.trim(),
    input,
    isFrozen,
    isMemberLocked,
    isPending: sendMutation.isPending,
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
