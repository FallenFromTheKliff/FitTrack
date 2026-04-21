"use client";
import { useMemo, useState } from "react";
import { Bot, Search } from "lucide-react";
import type { AiChatSessionRecord } from "@fittrack/types";

import { getAiContextLabel, getAiSessionDisplayTitle } from "@fittrack/app-config";
import { formatRelativeDateLabel, groupItemsByDate, timeAgo } from "@fittrack/utils";
import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { useDebounce } from "@fittrack/hooks";
import { chatbotStyles } from "@/styles/pageStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";

type Props = {
  activeId?: string | null;
  onSelect: (id: string) => void;
  sessions: AiChatSessionRecord[];
};

type GroupedSession = {
  date: string;
  session: AiChatSessionRecord;
};

export default function HistoryPanel({ sessions, activeId, onSelect }: Props) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = chatbotStyles(colors);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return sessions;
    const normalizedQuery = debouncedQuery.toLowerCase();
    return sessions.filter((session) => {
      const title = getAiSessionDisplayTitle(session).toLowerCase();
      const contextLabel = getAiContextLabel(session.context_type).toLowerCase();
      return title.includes(normalizedQuery) || contextLabel.includes(normalizedQuery);
    });
  }, [debouncedQuery, sessions]);

  const grouped = useMemo(() => {
    const datedSessions: GroupedSession[] = filtered.map((session) => ({
      date: session.last_activity_at.slice(0, 10),
      session
    }));
    return groupItemsByDate(datedSessions, "desc");
  }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={s.panelHeader}>
        <FitText style={{ fontSize: 14, fontWeight: 700 }}>Chat History</FitText>
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>{sessions.length} sessions</FitText>
      </div>
      <div style={s.searchWrap}>
        <Search
          size={13}
          color={colors.textMuted}
          style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        <FitTextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations..."
          style={s.searchInput}
          className={fontClass}
        />
      </div>
      <div style={s.sessionList}>
        {grouped.length === 0 ? (
          <div style={s.emptyState}>
            <Bot size={32} color={colors.textMuted} strokeWidth={1.5} />
            <FitText style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
              No conversations found
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
                      <Bot size={16} color={isActive ? colors.brand : colors.textMuted} strokeWidth={1.5} />
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
                      <FitText style={{ fontSize: 10, color: colors.textMuted, display: "block", marginTop: 2 }}>
                        Last active {timeAgo(session.last_activity_at)}
                      </FitText>
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
