import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";

import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeBrodigyStyles } from "@/styles/shared/ScreenStyles";
import ChatbotScreenContent from "@/components/chatbot/ChatbotScreenContent";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { useChatbotScreen } from "@/hooks/chatbot/useChatbotScreen";

export default function ChatbotScreen() {
  const router = useRouter();
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
    isSessionDeleted,
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
          isSessionDeleted={isSessionDeleted}
          lastError={lastError}
          messages={messages}
          onInputChange={setInput}
          onSend={send}
          sessionTitle={sessionTitle}
          statusMessage={statusMessage}
          styles={s}
        />
      </Animated.View>
      {isMemberLocked ? (
        <View
          accessibilityLabel="BrodigyAI membership upgrade required"
          accessibilityViewIsModal
          onStartShouldSetResponder={() => true}
          style={{
            alignItems: "center",
            backgroundColor: colors.overlay,
            bottom: 0,
            justifyContent: "center",
            left: 0,
            padding: 20,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 1000,
          }}
        >
          <View style={{ maxWidth: 520, width: "100%" }}>
            <PremiumFeatureGate
              actionLabel="Open Profile Settings"
              eyebrow="BRODIGYAI PREMIUM FEATURE"
              message={`${memberLockMessage} Upgrade or refresh your membership in Profile Settings to unlock BrodigyAI.`}
              onActionPress={() => router.push("/(tabs)/profile")}
              statusLabel={memberLockStatusLabel}
              title={
                memberLockStatusLabel === "Pending verification"
                  ? "Membership card verification in progress"
                  : memberLockStatusLabel === "Access denied"
                    ? "BrodigyAI access is unavailable"
                    : "Upgrade membership to unlock BrodigyAI"
              }
            />
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}
