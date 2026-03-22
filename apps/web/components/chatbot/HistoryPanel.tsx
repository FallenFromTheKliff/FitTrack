"use client";
import { useMemo, useState } from "react";
import { Bot, Search } from "lucide-react";

import { formatDate } from "@fittrack/utils";
import type { ChatSession } from "@/data/chat/chat";
import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { useDebounce } from "@fittrack/hooks";
import { chatbotStyles } from "@/styles/pageStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";

type Props = {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
};

function groupByDateLabel(sessions: ChatSession[]): [string, ChatSession[]][] {
  const map = new Map<string, ChatSession[]>();
  for (const s of sessions) {
    const existing = map.get(s.date) ?? [];
    existing.push(s);
    map.set(s.date, existing);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(dateStr, "MMM d, yyyy");
}

export default function HistoryPanel({ sessions, activeId, onSelect }: Props) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const s = chatbotStyles(colors);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return sessions;
    const q = debouncedQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q));
  }, [sessions, debouncedQuery]);

  const grouped = useMemo(() => groupByDateLabel(filtered), [filtered]);

  return (
      <>
        <div style={s.panelHeader}>
          <FitText style={{ fontSize: 14, fontWeight: 700 }}>Chat History</FitText>
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>{sessions.length} sessions</FitText>
        </div>
        <div style={s.searchWrap}>
          <Search size={13} color={colors.textMuted} style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <FitTextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              style={s.searchInput}
              className={fontClass}
          />
        </div>
        <div style={s.sessionList}>
          {grouped.length === 0 ? (
              <div style={s.emptyState}>
                <Bot size={32} color={colors.textMuted} strokeWidth={1.5} />
                <FitText style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>No conversations found</FitText>
              </div>
          ) : (
              grouped.map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 4px" }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <FitText as="span" style={{ fontSize: 10, fontWeight: 600, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                        {formatDateLabel(dateKey)}
                      </FitText>
                      <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </div>
                    {items.map((session) => (
                        <div
                            key={session.id}
                            style={s.sessionItem(session.id === activeId)}
                            onClick={() => onSelect(session.id)}
                            className={fontClass}
                        >
                          <div style={s.sessionIconWrap}>
                            <Bot size={16} color={session.id === activeId ? colors.brand : colors.textMuted} strokeWidth={1.5} />
                          </div>
                          <div style={s.sessionInfo}>
                            <FitText style={{ fontSize: 13, fontWeight: session.id === activeId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                              {session.title}
                            </FitText>
                            <FitText style={{ fontSize: 11, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", marginTop: 2 }}>
                              {session.preview}
                            </FitText>
                            <FitText style={{ fontSize: 10, color: colors.textMuted, display: "block", marginTop: 2 }}>
                              {session.messageCount} messages
                            </FitText>
                          </div>
                        </div>
                    ))}
                  </div>
              ))
          )}
        </div>
      </>
  );
}