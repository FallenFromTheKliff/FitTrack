"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, Bot, ChevronLeft } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import AiFormattedText from "@/components/ai/AiFormattedText";
import { guardAiResponseText } from "@fittrack/utils";

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
  readOnlyMessage = "This chat is archived. Restore it from Archived Chats to continue the conversation.",
  showBackButton = false,
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = chatbotStyles(colors);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendLockRef = useRef(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const canSend = !disabled && !isLoading && !isReadOnly && !!input.trim();

  useEffect(() => {
    scrollToBottom();
  }, [isLoading, messages, scrollToBottom]);

  useEffect(() => {
    const viewport = window.visualViewport;

    const syncKeyboardOffset = () => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      if (!isTyping || !viewport) {
        setKeyboardOffset(0);
        return;
      }

      const overlap = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      setKeyboardOffset(overlap > 80 ? overlap : 0);
    };

    const clearKeyboardOffset = () => setKeyboardOffset(0);

    window.addEventListener("focusin", syncKeyboardOffset);
    window.addEventListener("focusout", clearKeyboardOffset);
    viewport?.addEventListener("resize", syncKeyboardOffset);
    viewport?.addEventListener("scroll", syncKeyboardOffset);

    return () => {
      window.removeEventListener("focusin", syncKeyboardOffset);
      window.removeEventListener("focusout", clearKeyboardOffset);
      viewport?.removeEventListener("resize", syncKeyboardOffset);
      viewport?.removeEventListener("scroll", syncKeyboardOffset);
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend || sendLockRef.current) return;

    sendLockRef.current = true;
    Promise.resolve()
      .then(onSend)
      .catch(() => undefined)
      .finally(() => {
        sendLockRef.current = false;
      });
  }, [canSend, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isReadOnly) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend, isReadOnly],
  );

  const keyboardAwarePanelStyle = {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    height: "100%",
    "--brodigy-keyboard-offset": `${keyboardOffset}px`,
  } as CSSProperties;

  return (
    <div style={keyboardAwarePanelStyle}>
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
            {isReadOnly ? "Archived conversation" : "Conversation"}
          </FitText>
        </div>
        <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
          <FitText
            style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}
          >
            B
          </FitText>
        </div>
      </div>
      <div
        style={{
          ...s.messagesArea,
          paddingBottom: keyboardOffset ? keyboardOffset + 24 : undefined,
        }}
      >
        <div style={s.chatWallpaper} aria-hidden="true">
          <Bot
            size={360}
            color={colors.brand}
            strokeWidth={1.1}
            style={{ opacity: 0.08 }}
          />
        </div>
        {messages.map((message) =>
          message.from === "ai" ? (
            <div key={message.id} style={s.aiRow}>
              <div
                style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}
              >
                <FitText
                  style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}
                >
                  B
                </FitText>
              </div>
              <div style={s.aiBubble}>
                <AiFormattedText
                  text={guardAiResponseText(message.text)}
                  compact
                  style={{ fontSize: 13, lineHeight: 1.55 }}
                />
              </div>
            </div>
          ) : (
            <div
              key={message.id}
              style={{ display: "flex", justifyContent: "flex-end" }}
            >
              <div style={s.userBubble}>
                <FitText
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: onBrandTextColor,
                  }}
                >
                  {message.text}
                </FitText>
              </div>
            </div>
          ),
        )}
        {isLoading ? (
          <div style={s.aiRow}>
            <div
              style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}
            >
              <FitText
                style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}
              >
                B
              </FitText>
            </div>
            <div style={s.aiBubble}>
              <div
                style={s.dotsWrap}
                role="status"
                aria-label="Brodigy is thinking"
              >
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="brodigy-thinking-dot"
                    style={{ ...s.dot, animationDelay: `${index * 140}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <div
        style={{
          ...s.inputBar,
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          position: "relative",
          transform: keyboardOffset
            ? "translateY(calc(-1 * var(--brodigy-keyboard-offset)))"
            : undefined,
          transition: "transform 180ms ease",
          zIndex: 3,
        }}
      >
        <div style={s.inputWrap}>
          <FitTextArea
            id="brodigy-chat-message"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
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
          onClick={handleSend}
          style={s.sendBtn}
          aria-label="Send message"
          disabled={!canSend}
        />
      </div>
      <div
        style={{
          padding: "0 12px 12px",
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
        }}
      >
        <FitText style={{ fontSize: 11, color: colors.textMuted }}>
          {isReadOnly
            ? readOnlyMessage
            : "Press Enter to send. Shift+Enter inserts a new line."}
        </FitText>
      </div>
    </div>
  );
}
