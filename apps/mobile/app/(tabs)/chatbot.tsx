import { useMemo } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";

import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeBrodigyStyles } from "@/styles/shared/ScreenStyles";
import ChatbotScreenContent from "@/components/chatbot/ChatbotScreenContent";
import { useChatbotScreen } from "@/hooks/chatbot/useChatbotScreen";

export default function ChatbotScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBrodigyStyles(colors), [colors]);
  const {
    canSend,
    input,
    isFrozen,
    isMemberLocked,
    isPending,
    lastError,
    memberLockMessage,
    memberLockStatusLabel,
    messages,
    send,
    sessionTitle,
    setInput,
    statusMessage
  } = useChatbotScreen({ isFocused });

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.View style={[base.content, screenStyle, contentStyle]}>
        <ChatbotScreenContent
          canSend={canSend}
          input={input}
          isFrozen={isFrozen}
          isMemberLocked={isMemberLocked}
          isPending={isPending}
          lastError={lastError}
          memberLockMessage={memberLockMessage}
          memberLockStatusLabel={memberLockStatusLabel}
          messages={messages}
          onInputChange={setInput}
          onSend={send}
          sessionTitle={sessionTitle}
          statusMessage={statusMessage}
          styles={s}
        />
      </Animated.View>
    </Animated.View>
  );
}
