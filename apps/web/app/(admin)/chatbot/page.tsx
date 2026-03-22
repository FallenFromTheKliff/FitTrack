"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { MOCK_SESSIONS, GREETING_MESSAGE } from "@/data/chat/chat";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { chatbotStyles } from "@/styles/pageStyles";

import HistoryPanel from "@/components/chatbot/HistoryPanel";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function BrodigyAIPage() {
  const { colors } = useTheme();
  const s = chatbotStyles(colors);
  const fadeIn = useFadeIn();
  const historyPanelFade = useFadeIn({ fromY: 12, duration: 220 });
  const chatPanelFade = useFadeIn({ fromY: 16, duration: 260 });
  const themeTransition = useThemeTransition();

  const [isCompact, setIsCompact] = useState(false);
  const [activePanel, setActivePanel] = useState<"history" | "chat">("chat");
  const [panelSlideKey, setPanelSlideKey] = useState(0);
  const [panelSlideDir, setPanelSlideDir] = useState<"left" | "right">("right");
  const [activeId, setActiveId] = useState<string>("new");
  const { style: panelSlideStyle } = usePowerSlide(panelSlideKey, panelSlideDir);

  const activeSession = MOCK_SESSIONS.find((session) => session.id === activeId);
  const sessionTitle = activeSession ? activeSession.title : "New Chat";

  useEffect(() => {
    const evaluateCompact = () => {
      const screenWidth = window.screen?.availWidth || window.screen?.width || window.innerWidth;
      const viewportWidth = window.outerWidth || window.innerWidth;
      setIsCompact(viewportWidth <= screenWidth * 0.6);
    };
    evaluateCompact();
    window.addEventListener("resize", evaluateCompact);
    return () => window.removeEventListener("resize", evaluateCompact);
  }, []);

  useEffect(() => {
    if (!isCompact && activePanel !== "chat") setActivePanel("chat");
  }, [isCompact, activePanel]);

  const handleSelectSession = (id: string) => {
    setActiveId(id);
    if (isCompact) {
      setPanelSlideDir("right");
      setPanelSlideKey((k) => k + 1);
      setActivePanel("chat");
    }
  };

  const handleBackToHistory = () => {
    setPanelSlideDir("left");
    setPanelSlideKey((k) => k + 1);
    setActivePanel("history");
  };

  const showHistory = !isCompact || activePanel === "history";
  const showChat = !isCompact || activePanel === "chat";

  return (
    <section className={themeTransition} style={{ ...s.page, ...fadeIn }}>
      <div
        style={{
          ...s.panels,
          gridTemplateColumns: isCompact ? "1fr" : "320px 1fr",
          gap: isCompact ? 12 : 16
        }}
      >
        {showHistory && (
          <motion.div style={{ ...s.panel, ...historyPanelFade, ...(isCompact ? panelSlideStyle : {}) }}>
            <HistoryPanel
              sessions={MOCK_SESSIONS}
              activeId={activeId}
              onSelect={handleSelectSession}
            />
          </motion.div>
        )}
        {showChat && (
          <motion.div style={{ ...s.panel, ...chatPanelFade, ...(isCompact ? panelSlideStyle : {}) }}>
            <ChatPanel
              greeting={GREETING_MESSAGE}
              sessionTitle={sessionTitle}
              showBackButton={isCompact}
              onBack={handleBackToHistory}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}