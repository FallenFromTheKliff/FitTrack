"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiClientError } from "@fittrack/api-client";
import {
  WEB_GREETING_MESSAGE,
  getAiChatErrorMessage,
} from "@fittrack/app-config";
import {
  aiChatMessagesQueryOptions,
  aiChatMutationOptions,
  aiChatSessionQueryOptions,
  aiChatSessionsQueryOptions,
  archiveAiChatSessionMutationOptions,
  restoreAiChatSessionMutationOptions,
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";
import { aiChatSchema } from "@fittrack/validators";

import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";
import type { ChatPanelMessage } from "@/components/chatbot/ChatPanel";

function normalizeSessionId(value: string | null) {
  if (!value || value === "new") return null;
  return value;
}

function isForbiddenError(error: unknown) {
  return error instanceof ApiClientError && error.status === 403;
}

export function useAiPageController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(2600);
  const { user } = useAuth();
  const hasBrodigyAccess =
    user?.role === "ADMIN" ||
    user?.role === "STAFF" ||
    user?.role === "COACH" ||
    (user?.role === "USER" && user.membershipAccess === "member");

  const sessionParam = searchParams.get("sessionId");
  const promptParam = searchParams.get("prompt")?.trim() ?? "";
  const shouldAutoStartPrompt = searchParams.get("autostart") === "1";
  const requestedSessionId = normalizeSessionId(sessionParam);
  const isExplicitNewSession = sessionParam === "new";

  const [input, setInput] = useState("");
  const [lastError, setLastError] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const autoPromptRef = useRef<string | null>(null);

  const sessionsQuery = useQuery({
    ...aiChatSessionsQueryOptions(webApiClient, { limit: 50 }),
    enabled: hasBrodigyAccess,
  });
  const sessions = sessionsQuery.data?.data ?? [];
  const firstActiveSessionId =
    sessions.find((session) => session.is_active)?.id ?? null;

  useEffect(() => {
    if (sessionParam !== null) return;
    router.replace(
      firstActiveSessionId
        ? `/ai?sessionId=${firstActiveSessionId}`
        : "/ai?sessionId=new",
    );
  }, [firstActiveSessionId, router, sessionParam]);

  useEffect(() => {
    if (!isExplicitNewSession || !promptParam || pendingMessage || input.trim())
      return;
    setInput(promptParam);
    setLastError("");
  }, [input, isExplicitNewSession, pendingMessage, promptParam]);

  const activeSessionId =
    requestedSessionId ?? (!isExplicitNewSession ? firstActiveSessionId : null);

  const sessionQuery = useQuery({
    ...aiChatSessionQueryOptions(webApiClient, activeSessionId ?? ""),
    enabled:
      hasBrodigyAccess &&
      !!activeSessionId &&
      !sessions.some((session) => session.id === activeSessionId),
  });

  const messagesQuery = useQuery({
    ...aiChatMessagesQueryOptions(webApiClient, activeSessionId ?? "", {
      limit: 100,
    }),
    enabled: hasBrodigyAccess && !!activeSessionId,
  });

  const sendMutation = useMutation(
    aiChatMutationOptions(webApiClient, queryClient, user?.id),
  );
  const archiveMutation = useMutation(
    archiveAiChatSessionMutationOptions(webApiClient, queryClient, user?.id),
  );
  const restoreMutation = useMutation(
    restoreAiChatSessionMutationOptions(webApiClient, queryClient),
  );
  const selectedSession =
    sessions.find((session) => session.id === activeSessionId) ??
    sessionQuery.data ??
    null;
  const isServerAccessDenied = [
    sessionsQuery.error,
    sessionQuery.error,
    messagesQuery.error,
    sendMutation.error,
    archiveMutation.error,
    restoreMutation.error,
  ].some(isForbiddenError);
  const isMemberLocked = !hasBrodigyAccess || isServerAccessDenied;
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
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
              : user?.role === "COACH"
                ? "Coach"
                : "Member"
          : "Non-member";
  const memberLockMessage = isServerAccessDenied
    ? "BrodigyAI access was denied for this account. Refresh your membership status or contact the gym if this looks incorrect."
    : membershipCardStatus === "pending_verification"
      ? "Your membership card payment is waiting for verification. BrodigyAI unlocks as soon as the card becomes active."
      : membershipCardStatus === "revoked"
        ? "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected."
        : "BrodigyAI access unlocks after this account has an active membership card.";

  const messages = useMemo<ChatPanelMessage[]>(() => {
    const records = (messagesQuery.data?.data ?? []).map<ChatPanelMessage>(
      (record) => ({
        from: record.role === "assistant" ? "ai" : "user",
        id: record.id,
        text: record.content,
      }),
    );

    if (records.length === 0) {
      records.push({ from: "ai", id: "greeting", text: WEB_GREETING_MESSAGE });
    }

    if (pendingMessage) {
      records.push({
        from: "user",
        id: "pending-user-message",
        text: pendingMessage,
      });
    }

    return records;
  }, [messagesQuery.data, pendingMessage]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      router.replace(`/ai?sessionId=${sessionId}`);
    },
    [router],
  );

  const handleStartFresh = useCallback(() => {
    setInput("");
    setLastError("");
    setPendingMessage(null);
    autoPromptRef.current = null;
    router.replace("/ai?sessionId=new");
  }, [router]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (isMemberLocked) return;
      const submittedInput = messageText;
      const parsed = aiChatSchema.safeParse({
        context_type: "general",
        message: submittedInput,
        ...(activeSessionId ? { session_id: activeSessionId } : {}),
        ...(!activeSessionId && isExplicitNewSession
          ? { start_new_session: true }
          : {}),
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
          router.replace(`/ai?sessionId=${result.session_id}`);
        }
      } catch (error) {
        const errorMessage = getAiChatErrorMessage(
          error,
          "Unable to send AI message.",
        );
        setInput(submittedInput);
        if (error instanceof ApiClientError && error.status === 410) {
          router.replace("/ai?sessionId=new");
        }
        setLastError(errorMessage);
        showMessage(errorMessage);
      } finally {
        setPendingMessage(null);
      }
    },
    [
      activeSessionId,
      isExplicitNewSession,
      isMemberLocked,
      router,
      sendMutation,
      showMessage,
    ],
  );

  const handleSend = useCallback(async () => {
    await sendMessage(input);
  }, [input, sendMessage]);

  useEffect(() => {
    if (!shouldAutoStartPrompt || !isExplicitNewSession || !promptParam) return;
    if (sendMutation.isPending || pendingMessage) return;
    if (autoPromptRef.current === promptParam) return;

    autoPromptRef.current = promptParam;
    void sendMessage(promptParam);
  }, [
    isExplicitNewSession,
    pendingMessage,
    promptParam,
    sendMessage,
    sendMutation.isPending,
    shouldAutoStartPrompt,
  ]);

  const handleDelete = useCallback(async () => {
    if (!activeSessionId || isMemberLocked) return;
    try {
      await archiveMutation.mutateAsync({ sessionId: activeSessionId });
      setLastError("");
      showMessage("Chat archived.");
      router.replace("/ai?sessionId=new");
      return activeSessionId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to archive chat.";
      setLastError(errorMessage);
      showMessage(errorMessage);
      return null;
    }
  }, [activeSessionId, archiveMutation, isMemberLocked, router, showMessage]);

  const handleRestore = useCallback(async () => {
    if (!selectedSession?.id || isMemberLocked) return null;
    try {
      await restoreMutation.mutateAsync({ sessionId: selectedSession.id });
      setLastError("");
      showMessage("Chat restored.");
      router.replace(`/ai?sessionId=${selectedSession.id}`);
      return selectedSession.id;
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError && error.status === 404
          ? "Restore is unavailable until the API reloads. Restart the current stack, then try again."
          : error instanceof Error
            ? error.message
            : "Unable to restore chat.";
      setLastError(errorMessage);
      showMessage(errorMessage);
      return null;
    }
  }, [isMemberLocked, restoreMutation, router, selectedSession, showMessage]);

  return {
    activeSessionId,
    deleteMutation: archiveMutation,
    handleDelete,
    handleRestore,
    handleSelectSession,
    handleSend,
    handleStartFresh,
    input,
    isMemberLocked,
    memberLockMessage,
    memberLockStatusLabel,
    isSelectedSessionDeleted: selectedSession
      ? !selectedSession.is_active
      : false,
    lastError,
    message,
    messages,
    restoreMutation,
    sendMutation,
    selectedSession,
    sessions,
    setInput,
  };
}
