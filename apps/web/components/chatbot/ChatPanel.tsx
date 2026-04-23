"use client";
import { useCallback, useEffect, useRef } from "react";
import { ArrowUp, Bot, ChevronLeft } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

export type ChatPanelMessage = {
  from: "ai" | "user";
  id: string;
  text: string;
};

type Props = {
  disabled?: boolean;
  input: string;
  isLoading?: boolean;
  isReadOnly?: boolean;
  messages: ChatPanelMessage[];
  onBack?: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  readOnlyMessage?: string;
  showBackButton?: boolean;
};

export default function ChatPanel({
  disabled = false,
  input,
  isLoading = false,
  isReadOnly = false,
  messages,
  onBack,
  onInputChange,
  onSend,
  placeholder = "Type a message...",
  readOnlyMessage = "This chat is deleted. Restore it from Deleted Chats to continue the conversation.",
  showBackButton = false
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = chatbotStyles(colors);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [isLoading, messages, scrollToBottom]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isReadOnly) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }, [isReadOnly, onSend]);

  const canSend = !disabled && !isLoading && !isReadOnly && !!input.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={s.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showBackButton && onBack ? (
            <FitButton
              variant="iconClear"
              icon={ChevronLeft}
              iconOnly
              iconSize={18}
              onClick={onBack}
              aria-label="Back to chat history"
              style={{ padding: 6 }}
            />
          ) : null}
          <FitText style={{ fontSize: 14, fontWeight: 700 }}>
            {isReadOnly ? "Deleted conversation" : "Conversation"}
          </FitText>
        </div>
        <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
          <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>B</FitText>
        </div>
      </div>
      <div style={s.messagesArea}>
        <div style={s.chatWallpaper} aria-hidden="true">
          <Bot size={180} color={colors.brand} strokeWidth={1.1} style={{ opacity: 0.08 }} />
        </div>
        {messages.map((message) =>
          message.from === "ai" ? (
            <div key={message.id} style={s.aiRow}>
              <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
                <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>B</FitText>
              </div>
              <div style={s.aiBubble}>
                <FitText style={{ fontSize: 13, lineHeight: 1.55 }}>{message.text}</FitText>
              </div>
            </div>
          ) : (
            <div key={message.id} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={s.userBubble}>
                <FitText style={{ fontSize: 13, lineHeight: 1.55, color: onBrandTextColor }}>{message.text}</FitText>
              </div>
            </div>
          )
        )}
        {isLoading ? (
          <div style={s.aiRow}>
            <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
              <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>B</FitText>
            </div>
            <div style={s.aiBubble}>
              <div style={s.dotsWrap}>
                <div style={s.dot} />
                <div style={s.dot} />
                <div style={s.dot} />
              </div>
            </div>
          </div>
          ) : null}
        <div ref={bottomRef} />
      </div>
      <div style={s.inputBar}>
        <div style={s.inputWrap}>
          <FitTextArea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            style={s.inputField}
            disabled={disabled || isReadOnly}
          />
        </div>
        <FitButton
          variant="primary"
          iconOnly
          icon={ArrowUp}
          iconSize={18}
          onClick={onSend}
          style={s.sendBtn}
          aria-label="Send message"
          disabled={!canSend}
        />
      </div>
      <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${colors.border}`, backgroundColor: colors.surface }}>
        <FitText style={{ fontSize: 11, color: colors.textMuted }}>
          {isReadOnly ? readOnlyMessage : "Press Enter to send. Shift+Enter inserts a new line."}
        </FitText>
      </div>
    </div>
  );
}
