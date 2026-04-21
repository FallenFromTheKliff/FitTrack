"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { chatbotStyles } from "@/styles/pageStyles";
import ChatPanel from "@/components/chatbot/ChatPanel";
import HistoryPanel from "@/components/chatbot/HistoryPanel";
import AiPageHeader from "@/components/chatbot/AiPageHeader";
import { useAiPageController } from "@/hooks/ai/useAiPageController";

export default function AiPage() {
  const { colors } = useTheme();
  const s = chatbotStyles(colors);
  const {
    activeSessionId,
    archiveMutation,
    handleArchive,
    handleSelectSession,
    handleSend,
    handleStartFresh,
    input,
    lastError,
    message,
    messages,
    sendMutation,
    sessionTitle,
    sessions,
    setInput
  } = useAiPageController();

  return (
    <div style={s.page}>
      <AiPageHeader
        activeSessionId={activeSessionId}
        dangerColor={colors.danger}
        isArchiving={archiveMutation.isPending}
        lastError={lastError}
        message={message}
        mutedColor={colors.textMuted}
        onArchive={handleArchive}
        onStartFresh={handleStartFresh}
      />
      <div className="grid min-h-[70vh] flex-1 items-stretch gap-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <div style={s.panel}>
          <HistoryPanel
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
          />
        </div>
        <div style={s.panel}>
          <ChatPanel
            disabled={sendMutation.isPending}
            input={input}
            isLoading={sendMutation.isPending}
            messages={messages}
            onInputChange={setInput}
            onSend={handleSend}
            sessionTitle={sessionTitle}
            placeholder="Ask BrodigyAI about training, nutrition, or your next session..."
          />
        </div>
      </div>
    </div>
  );
}
