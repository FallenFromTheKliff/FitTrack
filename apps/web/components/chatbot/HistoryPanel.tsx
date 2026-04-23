"use client";
import { useMemo } from "react";
import { Bot, RotateCcw, Trash2 } from "lucide-react";
import type { AiChatSessionRecord } from "@fittrack/types";

import { getAiContextLabel, getAiSessionDisplayTitle } from "@fittrack/app-config";
import { formatRelativeDateLabel, groupItemsByDate, timeAgo } from "@fittrack/utils";
import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";

import { FitButton, FitText } from "@/components/fit";

type Props = {
  activeId?: string | null;
  onSelect: (id: string) => void;
  onRequestDelete: () => void;
  onRestore: () => void;
  selectedSession: AiChatSessionRecord | null;
  statusFilter: "active" | "all" | "deleted";
  onStatusFilterChange: (value: "active" | "all" | "deleted") => void;
  sessions: AiChatSessionRecord[];
  isDeleting?: boolean;
  isRestoring?: boolean;
};

type GroupedSession = {
  date: string;
  session: AiChatSessionRecord;
};

export default function HistoryPanel({
  sessions,
  activeId,
  onRequestDelete,
  onRestore,
  onSelect,
  onStatusFilterChange,
  selectedSession,
  statusFilter,
  isDeleting = false,
  isRestoring = false
}: Props) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = chatbotStyles(colors);
  const filterOptions = useMemo(() => ([
    { label: "Active Chats", value: "active" as const },
    { label: "All Chats", value: "all" as const },
    { label: "Deleted Chats", value: "deleted" as const }
  ]), []);

  const grouped = useMemo(() => {
    const datedSessions: GroupedSession[] = sessions.map((session) => ({
      date: session.last_activity_at.slice(0, 10),
      session
    }));
    return groupItemsByDate(datedSessions, "desc");
  }, [sessions]);

  const selectedTitle = selectedSession ? getAiSessionDisplayTitle(selectedSession) : "No chat selected";
  const selectedContext = selectedSession ? getAiContextLabel(selectedSession.context_type) : "Pick a chat to manage it here.";
  const selectedStatus = selectedSession
    ? (selectedSession.is_active ? "Active chat" : "Deleted chat")
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={s.panelHeader}>
        <div>
          <FitText style={{ fontSize: 14, fontWeight: 700 }}>Chat History</FitText>
          <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            {sessions.length} {sessions.length === 1 ? "chat" : "chats"}
          </FitText>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 12px 12px" }}>
        {filterOptions.map((option) => (
          <FitButton
            key={option.value}
            variant="chip"
            label={option.label}
            active={statusFilter === option.value}
            onClick={() => onStatusFilterChange(option.value)}
          />
        ))}
      </div>
      <div
        style={{
          margin: "0 12px 12px",
          padding: 16,
          borderRadius: 16,
          border: `1px solid ${selectedSession?.is_active === false ? `${colors.danger}30` : colors.border}`,
          backgroundColor: colors.surfaceRaised,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: selectedSession ? "0 10px 24px rgba(0, 0, 0, 0.12)" : "none"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FitText
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "block"
            }}
          >
            Conversation
          </FitText>
          <FitText
            as="p"
            style={{
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.15,
              display: "block",
              margin: 0
            }}
          >
            {selectedTitle}
          </FitText>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <FitText
              as="span"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.textMuted,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface
              }}
            >
              {selectedContext}
            </FitText>
            {selectedStatus ? (
              <FitText
                as="span"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: selectedSession?.is_active ? colors.brand : colors.danger,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${selectedSession?.is_active ? `${colors.brand}33` : `${colors.danger}33`}`,
                  backgroundColor: selectedSession?.is_active ? `${colors.brand}14` : `${colors.danger}14`,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}
              >
                {selectedStatus}
              </FitText>
            ) : null}
          </div>
        </div>
        <FitText style={{ fontSize: 11, color: colors.textMuted }}>
          {selectedSession
            ? `Last active ${timeAgo(selectedSession.last_activity_at)}`
            : "Select a chat from the list to delete or restore it."}
        </FitText>
        {selectedSession ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 2 }}>
            {selectedSession.is_active ? (
              <FitButton
                variant="danger"
                icon={Trash2}
                iconOnly
                aria-label="Delete chat"
                onClick={onRequestDelete}
                loading={isDeleting}
                loadingLabel="Deleting"
                style={{ width: 42, height: 42, padding: 0 }}
              />
            ) : (
              <FitButton
                variant="danger"
                icon={RotateCcw}
                label="Restore Chat"
                onClick={onRestore}
                loading={isRestoring}
                loadingLabel="Restoring"
                style={{ minHeight: 40, paddingInline: 14 }}
              />
            )}
          </div>
        ) : null}
      </div>
      <div style={s.sessionList}>
        {grouped.length === 0 ? (
          <div style={s.emptyState}>
            <Bot size={32} color={colors.textMuted} strokeWidth={1.5} />
            <FitText style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
              {statusFilter === "deleted" ? "No deleted chats yet" : "No chats in this view yet"}
            </FitText>
          </div>
        ) : (
          grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 4px" }}>
                <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <FitText
                  as="span"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    whiteSpace: "nowrap"
                  }}
                >
                  {formatRelativeDateLabel(dateKey)}
                </FitText>
                <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </div>
              {items.map(({ session }) => {
                const isActive = session.id === activeId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    style={{
                      ...s.sessionItem(isActive),
                      width: "calc(100% - 16px)",
                      textAlign: "left"
                    }}
                    onClick={() => onSelect(session.id)}
                    className={fontClass}
                  >
                    <div style={s.sessionIconWrap}>
                      <Bot
                        size={16}
                        color={session.is_active ? (isActive ? colors.brand : colors.textMuted) : colors.danger}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div style={s.sessionInfo}>
                      <FitText
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block"
                        }}
                      >
                        {getAiSessionDisplayTitle(session)}
                      </FitText>
                      <FitText
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                          marginTop: 2
                        }}
                      >
                        {getAiContextLabel(session.context_type)}
                      </FitText>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                        <FitText style={{ fontSize: 10, color: colors.textMuted, display: "block" }}>
                          Last active {timeAgo(session.last_activity_at)}
                        </FitText>
                        {!session.is_active ? (
                          <FitText
                            as="span"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: colors.danger,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em"
                            }}
                          >
                            Deleted
                          </FitText>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
