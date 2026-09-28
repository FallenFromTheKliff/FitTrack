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
import { PremiumGate } from "@/components/member-only/MemberOnlyPrimitives";

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
    isMemberLocked,
    isSelectedSessionDeleted,
    lastError,
    message,
    memberLockMessage,
    memberLockStatusLabel,
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
      ...fadeIn,
      minWidth: 0,
      position: "relative" as const
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
        aria-hidden={isMemberLocked}
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
          pointerEvents: isMemberLocked ? "none" : "auto",
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
          <div className="brodigy-history-content" style={{ flex: 1, minHeight: 0 }}>
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
            disabled={isMemberLocked || sendMutation.isPending || isSelectedSessionDeleted}
            input={input}
            isLoading={sendMutation.isPending}
            isReadOnly={isMemberLocked || isSelectedSessionDeleted}
            messages={messages}
            onBack={() => setMobilePane("history")}
            onInputChange={setInput}
            onSend={handleSend}
            placeholder={
              isMemberLocked
                ? "Active Membership Card required to use BrodigyAI."
                : isSelectedSessionDeleted
                  ? "Restore this chat to continue the conversation."
                  : getChatPlaceholder(role)
            }
            showBackButton={isMobileBrodigy}
          />
        </div>
      </div>
      {isMemberLocked ? (
        <div
          aria-label="BrodigyAI membership upgrade required"
          aria-modal="true"
          className="brodigy-membership-overlay"
          data-brodigy-membership-overlay="true"
          role="dialog"
          style={{
            alignItems: "center",
            backgroundColor: colors.overlay,
            display: "flex",
            inset: 0,
            justifyContent: "center",
            padding: 24,
            position: "absolute",
            zIndex: 20,
          }}
        >
          <div
            className="brodigy-membership-gate-wrap"
            data-brodigy-membership-gate-wrap="true"
            style={{
              maxHeight: "100%",
              maxWidth: 560,
              minWidth: 0,
              overflow: "auto",
              width: "100%",
            }}
          >
            <PremiumGate
              actionHref="/profile"
              actionLabel="Open Profile Settings"
              eyebrow="BRODIGYAI PREMIUM FEATURE"
              message={`${memberLockMessage} Purchase or activate your Membership Card in Profile Settings to unlock BrodigyAI.`}
              statusLabel={memberLockStatusLabel}
              title={
                memberLockStatusLabel === "Pending verification"
                  ? "Membership card verification in progress"
                  : memberLockStatusLabel === "Access denied"
                    ? "BrodigyAI access is unavailable"
                    : "Active Membership Card required to unlock BrodigyAI"
              }
            />
          </div>
        </div>
      ) : null}
      <style>{`
        .brodigy-compact-new-chat {
          display: block;
          padding: 12px 12px 0;
        }

        [data-brodigy-page="true"] {
          min-width: 0;
        }

        [data-brodigy-membership-overlay="true"] {
          min-width: 0;
          overflow: auto;
        }

        [data-brodigy-membership-gate-wrap="true"] {
          min-width: 0;
        }

        [data-brodigy-membership-gate-wrap="true"] .member-premium-gate {
          min-width: 0;
          width: 100%;
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

          [data-brodigy-membership-overlay="true"] {
            padding: 16px !important;
          }

          [data-brodigy-membership-gate-wrap="true"] {
            max-width: none !important;
          }
        }

        @media (max-width: 640px) {
          [data-brodigy-membership-overlay="true"] {
            align-items: flex-start !important;
            padding: 12px !important;
          }

          [data-brodigy-membership-gate-wrap="true"] {
            max-height: none !important;
            margin: auto;
            overflow: visible;
            width: 100% !important;
          }

          .brodigy-compact-new-chat button {
            font-size: 13px !important;
            line-height: 1.25 !important;
            min-height: 44px !important;
            padding: 10px 14px !important;
          }

          .brodigy-history-content,
          .brodigy-history-content > div,
          .brodigy-history-content > div > div {
            min-width: 0;
          }

          .brodigy-history-content > div > div:first-child > div:first-child > span {
            font-size: 14px !important;
            line-height: 1.2 !important;
            max-width: 100%;
            overflow-wrap: anywhere;
            white-space: normal !important;
          }

          .brodigy-history-content > div > div:first-child > div:nth-child(2) > span {
            font-size: 11px !important;
            line-height: 1.2 !important;
            max-width: 100%;
          }

          .brodigy-history-content > div > div:nth-child(2) > button {
            font-size: 12px !important;
            line-height: 1.2 !important;
            min-height: 44px !important;
          }

          .brodigy-history-content > div > div:nth-child(2) > button > span {
            font-size: 12px !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
          }

          .brodigy-history-content > div > div:nth-child(3) button {
            min-height: 44px !important;
            min-width: 0;
          }

          .brodigy-history-content > div > div:nth-child(3) button > div:nth-child(2) {
            min-width: 0;
            max-width: 100%;
          }

          .brodigy-history-content > div > div:nth-child(3) button > div:nth-child(2) > span:first-child {
            font-size: 12px !important;
            line-height: 1.25 !important;
          }

          .brodigy-history-content > div > div:nth-child(3) button > div:nth-child(2) > span:nth-child(2),
          .brodigy-history-content > div > div:nth-child(3) button > div:nth-child(2) > div > span {
            font-size: 10px !important;
            line-height: 1.25 !important;
            max-width: 100%;
          }

          .brodigy-history-content > div > div:nth-child(3) > div > div:first-child > span {
            font-size: 10px !important;
            line-height: 1.2 !important;
          }

          .brodigy-history-content button[aria-label="Archive chat"],
          .brodigy-history-content button[aria-label="Restore chat"],
          .brodigy-chat-panel button[aria-label="Back to chat history"],
          .brodigy-chat-panel button[aria-label="Send message"] {
            height: 44px !important;
            min-height: 44px !important;
            min-width: 44px !important;
            padding: 0 !important;
            width: 44px !important;
          }

          .brodigy-chat-panel > div > div:first-child > div:first-child > span {
            font-size: 14px !important;
            line-height: 1.2 !important;
          }

          .brodigy-chat-panel > div > div:first-child > div:nth-child(2) > span {
            font-size: 12px !important;
            line-height: 1.2 !important;
          }

          .brodigy-chat-panel > div > div:nth-child(2) {
            min-width: 0;
          }

          .brodigy-chat-panel > div > div:nth-child(2) span {
            font-size: 12.5px !important;
            line-height: 1.45 !important;
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          .brodigy-chat-panel > div > div:nth-child(4) > span {
            display: block;
            font-size: 10px !important;
            line-height: 1.35 !important;
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          .brodigy-chat-panel #brodigy-chat-message {
            font-size: 13px !important;
            line-height: 1.4 !important;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .brodigy-membership-gate-wrap .member-premium-gate-copy > span:first-child {
            font-size: 9px !important;
            line-height: 1.2 !important;
          }

          .brodigy-membership-gate-wrap .member-premium-gate-copy > span:last-child {
            font-size: 15px !important;
            line-height: 1.25 !important;
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          .brodigy-membership-gate-wrap .member-premium-gate-status {
            font-size: 10px !important;
            line-height: 1.2 !important;
            padding: 6px 8px !important;
          }

          .brodigy-membership-gate-wrap .member-premium-gate > p {
            font-size: 12px !important;
            line-height: 1.45 !important;
          }

          .brodigy-membership-gate-wrap .member-premium-gate > button {
            font-size: 13px !important;
            line-height: 1.2 !important;
            min-height: 44px !important;
            padding: 10px 14px !important;
          }

          .brodigy-membership-gate-wrap .member-premium-gate > button > span {
            font-size: 13px !important;
            line-height: 1.2 !important;
            max-width: 100%;
            overflow-wrap: anywhere;
            white-space: normal !important;
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
