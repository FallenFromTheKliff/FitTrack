"use client";
import { useMemo } from "react";
import { Bot, RotateCcw, Trash2 } from "lucide-react";
import type { AiChatSessionRecord } from "@fittrack/types";

import {
  getAiContextLabel,
  getAiSessionDisplayTitle,
} from "@fittrack/app-config";
import {
  formatRelativeDateLabel,
  groupItemsByDate,
  timeAgo,
} from "@fittrack/utils";
import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";

import { FitButton, FitText } from "@/components/fit";

type Props = {
  activeId?: string | null;
  onSelect: (id: string) => void;
  onRequestDelete: () => void;
  onRestore: () => void;
  selectedSession: AiChatSessionRecord | null;
  statusFilter: "active" | "all" | "archived";
  onStatusFilterChange: (value: "active" | "all" | "archived") => void;
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
  isRestoring = false,
}: Props) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = chatbotStyles(colors);
  const filterOptions = useMemo(
    () => [
      { label: "Active Chats", value: "active" as const },
      { label: "All Chats", value: "all" as const },
      { label: "Archived Chats", value: "archived" as const },
    ],
    [],
  );

  const grouped = useMemo(() => {
    const datedSessions: GroupedSession[] = sessions.map((session) => ({
      date: session.last_activity_at.slice(0, 10),
      session,
    }));
    return groupItemsByDate(datedSessions, "desc");
  }, [sessions]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div style={s.panelHeader}>
        <div style={{ minWidth: 0 }}>
          <FitText style={{ fontSize: 14, fontWeight: 700 }}>
            Chat History
          </FitText>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          <FitText
            style={{
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {sessions.length} {sessions.length === 1 ? "chat" : "chats"}
          </FitText>
          {selectedSession ? (
            selectedSession.is_active ? (
              <FitButton
                variant="danger"
                icon={Trash2}
                iconOnly
                aria-label="Archive chat"
                onClick={onRequestDelete}
                loading={isDeleting}
                loadingLabel="Deleting"
                style={{ flexShrink: 0, width: 34, height: 34, padding: 0 }}
              />
            ) : (
              <FitButton
                variant="danger"
                icon={RotateCcw}
                iconOnly
                aria-label="Restore chat"
                onClick={onRestore}
                loading={isRestoring}
                loadingLabel="Restoring"
                style={{ flexShrink: 0, width: 34, height: 34, padding: 0 }}
              />
            )
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "14px 12px 12px",
        }}
      >
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
      <div style={s.sessionList}>
        {grouped.length === 0 ? (
          <div style={s.emptyState}>
            <Bot size={32} color={colors.textMuted} strokeWidth={1.5} />
            <FitText
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {statusFilter === "archived"
                ? "No archived chats yet"
                : "No chats in this view yet"}
            </FitText>
          </div>
        ) : (
          grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px 4px",
                }}
              >
                <div
                  style={{ flex: 1, height: 1, backgroundColor: colors.border }}
                />
                <FitText
                  as="span"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRelativeDateLabel(dateKey)}
                </FitText>
                <div
                  style={{ flex: 1, height: 1, backgroundColor: colors.border }}
                />
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
                      textAlign: "left",
                    }}
                    onClick={() => onSelect(session.id)}
                    className={fontClass}
                  >
                    <div style={s.sessionIconWrap}>
                      <Bot
                        size={16}
                        color={
                          session.is_active
                            ? isActive
                              ? colors.brand
                              : colors.textMuted
                            : colors.danger
                        }
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
                          display: "block",
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
                          marginTop: 2,
                        }}
                      >
                        {getAiContextLabel(session.context_type)}
                      </FitText>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
                        <FitText
                          style={{
                            fontSize: 10,
                            color: colors.textMuted,
                            display: "block",
                          }}
                        >
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
                              letterSpacing: "0.08em",
                            }}
                          >
                            Archived
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
