"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";
import ChatPanel from "@/components/chatbot/ChatPanel";
import HistoryPanel from "@/components/chatbot/HistoryPanel";
import AiPageHeader from "@/components/chatbot/AiPageHeader";
import { useAiPageController } from "@/hooks/ai/useAiPageController";
import { ConfirmModal } from "@/components/modals";

export default function AiPage() {
  const { colors } = useTheme();
  const s = chatbotStyles(colors);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "archived"
  >("active");
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const {
    activeSessionId,
    deleteMutation,
    handleDelete,
    handleRestore,
    handleSelectSession,
    handleSend,
    handleStartFresh,
    input,
    isSelectedSessionDeleted,
    lastError,
    message,
    messages,
    restoreMutation,
    selectedSession,
    sendMutation,
    sessions,
    setInput,
  } = useAiPageController();

  const filteredSessions = useMemo(() => {
    switch (statusFilter) {
      case "active":
        return sessions.filter((session) => session.is_active);
      case "archived":
        return sessions.filter((session) => !session.is_active);
      default:
        return sessions;
    }
  }, [sessions, statusFilter]);

  useEffect(() => {
    if (!selectedSession || statusFilter === "all") return;
    const matchesFilter =
      statusFilter === "active"
        ? selectedSession.is_active
        : !selectedSession.is_active;
    if (matchesFilter) return;
    const fallbackSessionId = filteredSessions[0]?.id;
    if (fallbackSessionId) {
      handleSelectSession(fallbackSessionId);
      return;
    }
    handleStartFresh();
  }, [
    filteredSessions,
    handleSelectSession,
    handleStartFresh,
    selectedSession,
    statusFilter,
  ]);

  const handleConfirmDelete = async () => {
    const archivedSessionId = await handleDelete();
    if (!archivedSessionId) return;
    setDeleteConfirmOpen(false);
  };

  const handleRestoreSelectedSession = async () => {
    const restoredSessionId = await handleRestore();
    if (!restoredSessionId) return;
  };

  return (
    <div style={s.page}>
      <AiPageHeader
        dangerColor={colors.danger}
        lastError={lastError}
        message={message}
        mutedColor={colors.textMuted}
        onStartFresh={handleStartFresh}
      />
      <div
        data-brodigy-grid="true"
        style={{
          alignItems: "stretch",
          display: "grid",
          flex: 1,
          gap: 16,
          gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
          minHeight: "calc(100vh - 190px)",
          minWidth: 0,
        }}
      >
        <div style={{ ...s.panel, minHeight: 0 }}>
          <HistoryPanel
            activeId={activeSessionId}
            isDeleting={deleteMutation.isPending}
            isRestoring={restoreMutation.isPending}
            onRequestDelete={() => setDeleteConfirmOpen(true)}
            onRestore={() => void handleRestoreSelectedSession()}
            onSelect={handleSelectSession}
            onStatusFilterChange={setStatusFilter}
            selectedSession={selectedSession}
            sessions={filteredSessions}
            statusFilter={statusFilter}
          />
        </div>
        <div style={{ ...s.panel, minHeight: 0 }}>
          <ChatPanel
            disabled={sendMutation.isPending || isSelectedSessionDeleted}
            input={input}
            isLoading={sendMutation.isPending}
            isReadOnly={isSelectedSessionDeleted}
            messages={messages}
            onInputChange={setInput}
            onSend={handleSend}
            placeholder={
              isSelectedSessionDeleted
                ? "Restore this chat to continue the conversation."
                : "Ask BrodigyAI about training, nutrition, or your next session..."
            }
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) {
          [data-brodigy-grid="true"] {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
        }
      `}</style>
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Archive chat?"
        message="This chat will move to Archived Chats and can be restored later."
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmLabel="ARCHIVE CHAT"
        loadingLabel="Archiving chat"
        loadingTitle="Archiving chat"
        confirmIcon={Trash2}
        isLoading={deleteMutation.isPending}
        isDanger
      />
    </div>
  );
}
