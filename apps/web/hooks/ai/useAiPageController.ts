"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiClientError } from "@fittrack/api-client";
import {
  WEB_GREETING_MESSAGE,
  getAiChatErrorMessage,
  getAiSessionDisplayTitle
} from "@fittrack/app-config";
import {
  aiChatMessagesQueryOptions,
  aiChatMutationOptions,
  aiChatSessionQueryOptions,
  aiChatSessionsQueryOptions,
  archiveAiChatSessionMutationOptions
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";
import { aiChatSchema } from "@fittrack/validators";

import { webApiClient } from "@/lib/api-client";
import type { ChatPanelMessage } from "@/components/chatbot/ChatPanel";

function normalizeSessionId(value: string | null) {
  if (!value || value === "new") return null;
  return value;
}

export function useAiPageController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(2600);

  const sessionParam = searchParams.get("sessionId");
  const promptParam = searchParams.get("prompt")?.trim() ?? "";
  const shouldAutoStartPrompt = searchParams.get("autostart") === "1";
  const requestedSessionId = normalizeSessionId(sessionParam);
  const isExplicitNewSession = sessionParam === "new";

  const [input, setInput] = useState("");
  const [lastError, setLastError] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const autoPromptRef = useRef<string | null>(null);

  const sessionsQuery = useQuery(aiChatSessionsQueryOptions(webApiClient, { limit: 50 }));
  const sessions = sessionsQuery.data?.data ?? [];
  const firstSessionId = sessions[0]?.id ?? null;

  useEffect(() => {
    if (sessionParam !== null || !firstSessionId) return;
    router.replace(`/ai?sessionId=${firstSessionId}`);
  }, [firstSessionId, router, sessionParam]);

  useEffect(() => {
    if (!isExplicitNewSession || !promptParam || pendingMessage || input.trim()) return;
    setInput(promptParam);
    setLastError("");
  }, [input, isExplicitNewSession, pendingMessage, promptParam]);

  const activeSessionId = requestedSessionId ?? (!isExplicitNewSession ? firstSessionId : null);

  const sessionQuery = useQuery({
    ...aiChatSessionQueryOptions(webApiClient, activeSessionId ?? ""),
    enabled: !!activeSessionId && !sessions.some((session) => session.id === activeSessionId)
  });

  const messagesQuery = useQuery({
    ...aiChatMessagesQueryOptions(webApiClient, activeSessionId ?? "", { limit: 100 }),
    enabled: !!activeSessionId
  });

  const sendMutation = useMutation(aiChatMutationOptions(webApiClient, queryClient));
  const archiveMutation = useMutation(archiveAiChatSessionMutationOptions(webApiClient, queryClient));
  const selectedSession = sessions.find((session) => session.id === activeSessionId) ?? sessionQuery.data ?? null;

  const messages = useMemo<ChatPanelMessage[]>(() => {
    const records = (messagesQuery.data?.data ?? []).map<ChatPanelMessage>((record) => ({
      from: record.role === "assistant" ? "ai" : "user",
      id: record.id,
      text: record.content
    }));

    if (records.length === 0) {
      records.push({ from: "ai", id: "greeting", text: WEB_GREETING_MESSAGE });
    }

    if (pendingMessage) {
      records.push({ from: "user", id: "pending-user-message", text: pendingMessage });
    }

    return records;
  }, [messagesQuery.data, pendingMessage]);

  const handleSelectSession = useCallback((sessionId: string) => {
    router.replace(`/ai?sessionId=${sessionId}`);
  }, [router]);

  const handleStartFresh = useCallback(() => {
    setInput("");
    setLastError("");
    setPendingMessage(null);
    autoPromptRef.current = null;
    router.replace("/ai?sessionId=new");
  }, [router]);

  const sendMessage = useCallback(async (messageText: string) => {
    const trimmedInput = messageText.trim();
    const parsed = aiChatSchema.safeParse({
      context_type: "general",
      message: trimmedInput,
      ...(activeSessionId ? { session_id: activeSessionId } : {}),
      ...(!activeSessionId && isExplicitNewSession ? { start_new_session: true } : {})
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
        router.replace(`/ai?sessionId=${result.session_id}`);
      }
    } catch (error) {
      const errorMessage = getAiChatErrorMessage(error, "Unable to send AI message.");
      setInput(trimmedInput);
      if (error instanceof ApiClientError && error.status === 410) {
        router.replace("/ai?sessionId=new");
      }
      setLastError(errorMessage);
      showMessage(errorMessage);
    } finally {
      setPendingMessage(null);
    }
  }, [activeSessionId, isExplicitNewSession, router, sendMutation, showMessage]);

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
    shouldAutoStartPrompt
  ]);

  const handleArchive = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await archiveMutation.mutateAsync({ sessionId: activeSessionId });
      setLastError("");
      showMessage("Conversation archived.");
      router.replace("/ai?sessionId=new");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to archive conversation.";
      setLastError(errorMessage);
      showMessage(errorMessage);
    }
  }, [activeSessionId, archiveMutation, router, showMessage]);

  return {
    activeSessionId,
    archiveMutation,
    handleArchive,
    handleSelectSession,
    handleSend,
    handleStartFresh,
    input,
    lastError,
    message,
    messages,
    sendMutation,
    sessionTitle: selectedSession ? getAiSessionDisplayTitle(selectedSession) : "New conversation",
    sessions,
    setInput
  };
}
