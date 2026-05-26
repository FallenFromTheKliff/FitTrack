"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { chatbotStyles } from "@/styles/pageStyles";
import ChatPanel from "@/components/chatbot/ChatPanel";
import HistoryPanel from "@/components/chatbot/HistoryPanel";
import AiPageHeader from "@/components/chatbot/AiPageHeader";
import { useAiPageController } from "@/hooks/ai/useAiPageController";
import { ConfirmModal } from "@/components/modals";
import { FitButton } from "@/components/fit";

export default function AiPage() {
  const { user } = useAuth();

  if (user?.role) {
    return <BrodigyAiPageBody role={user.role} />;
  }

  return null;
}

function getChatPlaceholder(role: string) {
  if (role === "USER") {
    return "Ask BrodigyAI about your training plan, recovery, bookings, or membership...";
  }

  return "Ask BrodigyAI about revenue, attendance, staffing, inventory, or gym operations...";
}

function BrodigyAiPageBody({ role }: { role: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => chatbotStyles(colors), [colors]);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "archived"
  >("active");
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isMobileBrodigy, setIsMobileBrodigy] = useState(false);
  const [mobilePane, setMobilePane] = useState<"chat" | "history">("history");
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
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const syncMobileState = () => setIsMobileBrodigy(mediaQuery.matches);

    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

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

  const handleSelectSessionForView = useCallback(
    (sessionId: string) => {
      handleSelectSession(sessionId);
      if (isMobileBrodigy) setMobilePane("chat");
    },
    [handleSelectSession, isMobileBrodigy],
  );

  const handleStartFreshForView = useCallback(() => {
    handleStartFresh();
    if (isMobileBrodigy) setMobilePane("chat");
  }, [handleStartFresh, isMobileBrodigy]);

  const pageStyle = useMemo(
    () => ({
      ...s.page,
      height: "calc(100vh - 154px)",
      ...fadeIn
    }),
    [fadeIn, s.page]
  );

  return (
    <div className={themeTransition} data-brodigy-page="true" style={pageStyle}>
      <AiPageHeader
        dangerColor={colors.danger}
        lastError={lastError}
        message={message}
        mutedColor={colors.textMuted}
      />
      <div
        data-brodigy-grid="true"
        data-mobile-pane={mobilePane}
        style={{
          alignItems: "stretch",
          display: "grid",
          flex: 1,
          gap: 16,
          gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
          minHeight: 0,
          minWidth: 0,
          position: "relative",
        }}
      >
        <div className="brodigy-mobile-panel brodigy-history-panel" style={{ ...s.panel, minHeight: 0 }}>
          <div className="brodigy-compact-new-chat">
            <FitButton
              variant="primary"
              label="New Chat"
              icon={Plus}
              fullWidth
              onClick={handleStartFreshForView}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HistoryPanel
              activeId={activeSessionId}
              isDeleting={deleteMutation.isPending}
              isRestoring={restoreMutation.isPending}
              onRequestDelete={() => setDeleteConfirmOpen(true)}
              onRestore={() => void handleRestoreSelectedSession()}
              onSelect={handleSelectSessionForView}
              onStatusFilterChange={setStatusFilter}
              selectedSession={selectedSession}
              sessions={filteredSessions}
              statusFilter={statusFilter}
            />
          </div>
        </div>
        <div
          className="brodigy-mobile-panel brodigy-chat-panel"
          style={{
            ...s.panel,
            minHeight: 0,
          }}
        >
          <ChatPanel
            disabled={sendMutation.isPending || isSelectedSessionDeleted}
            input={input}
            isLoading={sendMutation.isPending}
            isReadOnly={isSelectedSessionDeleted}
            messages={messages}
            onBack={() => setMobilePane("history")}
            onInputChange={setInput}
            onSend={handleSend}
            placeholder={
              isSelectedSessionDeleted
                ? "Restore this chat to continue the conversation."
                : getChatPlaceholder(role)
            }
            showBackButton={isMobileBrodigy}
          />
        </div>
      </div>
      <style>{`
        .brodigy-compact-new-chat {
          display: block;
          padding: 12px 12px 0;
        }

        @media (max-width: 980px) {
          [data-brodigy-grid="true"] {
            grid-template-columns: 1fr !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden;
            position: relative;
          }

          .brodigy-mobile-panel {
            grid-area: 1 / 1;
            min-width: 0;
            transition:
              opacity 220ms ease,
              transform 220ms ease;
          }

          [data-mobile-pane="history"] .brodigy-history-panel,
          [data-mobile-pane="chat"] .brodigy-chat-panel {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
          }

          [data-mobile-pane="history"] .brodigy-chat-panel {
            opacity: 0;
            pointer-events: none;
            transform: translateX(14px);
          }

          [data-mobile-pane="chat"] .brodigy-history-panel {
            opacity: 0;
            pointer-events: none;
            transform: translateX(-14px);
          }

          .brodigy-compact-new-chat {
            display: block;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .brodigy-mobile-panel {
            animation: none !important;
            transition: none !important;
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
