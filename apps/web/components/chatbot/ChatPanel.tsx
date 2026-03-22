"use client";
import { useCallback, useRef, useState } from "react";
import { ArrowUp, Bot, ChevronLeft } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Msg = { id: string; text: string; from: "ai" | "user" };

type Props = {
  greeting: string;
  sessionTitle: string;
  showBackButton?: boolean;
  onBack?: () => void;
};

export default function ChatPanel({ greeting, sessionTitle, showBackButton = false, onBack }: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = chatbotStyles(colors);

  const [messages, setMessages] = useState<Msg[]>([{ id: "m1", text: greeting, from: "ai" }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const send = useCallback(() => {
    if (!input.trim()) return;
    const userMsg: Msg = { id: `u${Date.now()}`, text: input.trim(), from: "user" };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsLoading(true);
    setTimeout(scrollToBottom, 100);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          text: "I'm still being set up! Check back soon for personalized fitness coaching.",
          from: "ai"
        }
      ]);
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }, 1200);
  }, [input, scrollToBottom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  return (
    <>
      <div style={s.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showBackButton && onBack && (
            <FitButton
              variant="iconClear"
              icon={ChevronLeft}
              iconOnly
              iconSize={18}
              onClick={onBack}
              aria-label="Back to chat history"
              style={{ padding: 6 }}
            />
          )}
          <FitText style={{ fontSize: 14, fontWeight: 700 }}>{sessionTitle}</FitText>
        </div>
        <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
          <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>B</FitText>
        </div>
      </div>
      <div style={s.messagesArea}>
        <div style={s.chatWallpaper} aria-hidden="true">
          <Bot size={240} color={colors.brand} strokeWidth={1.1} style={{ opacity: 0.1 }} />
        </div>
        {messages.map((m) =>
          m.from === "ai" ? (
            <div key={m.id} style={s.aiRow}>
              <div style={{ ...s.aiAvatar, backgroundColor: `${colors.brand}22` }}>
                <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>B</FitText>
              </div>
              <div style={s.aiBubble}>
                <FitText style={{ fontSize: 13, lineHeight: 1.55 }}>{m.text}</FitText>
              </div>
            </div>
          ) : (
            <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={s.userBubble}>
                <FitText style={{ fontSize: 13, lineHeight: 1.55, color: onBrandTextColor }}>{m.text}</FitText>
              </div>
            </div>
          )
        )}
        {isLoading && (
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
        )}
        <div ref={bottomRef} />
      </div>
      <div style={s.inputBar}>
        <div style={s.inputWrap}>
          <FitTextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            style={s.inputField}
          />
        </div>
        <FitButton
          variant="primary"
          iconOnly
          icon={ArrowUp}
          iconSize={18}
          onClick={send}
          style={s.sendBtn}
          aria-label="Send message"
          disabled={!input.trim() || isLoading}
        />
      </div>
    </>
  );
}