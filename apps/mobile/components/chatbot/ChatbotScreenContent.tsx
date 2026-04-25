import { useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { ArrowUp } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makeBrodigyStyles } from "@/styles/shared/ScreenStyles";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { FitText, FitTextInput } from "@/components/fit/FitText";

import type { ChatbotMessage } from "@/hooks/chatbot/useChatbotScreen";

type ChatbotScreenContentProps = {
  canSend: boolean;
  input: string;
  isFrozen: boolean;
  isMemberLocked: boolean;
  isPending: boolean;
  isSessionDeleted: boolean;
  lastError: string;
  memberLockMessage: string;
  memberLockStatusLabel: string;
  messages: ChatbotMessage[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  sessionTitle: string;
  statusMessage: string;
  styles: ReturnType<typeof makeBrodigyStyles>;
};

export default function ChatbotScreenContent({
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
  onInputChange,
  onSend,
  sessionTitle,
  statusMessage,
  styles
}: ChatbotScreenContentProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(timer);
  }, [isPending, messages]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
          {sessionTitle}
        </FitText>
        {lastError ? (
          <FitText style={{ fontSize: 12, color: colors.danger, marginBottom: 12 }}>
            {lastError}
          </FitText>
        ) : null}
        {statusMessage ? (
          <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
            {statusMessage}
          </FitText>
        ) : null}
        {isMemberLocked ? (
          <PremiumFeatureGate
            eyebrow="MEMBERSHIP CARD REQUIRED"
            statusLabel={memberLockStatusLabel}
            title={memberLockStatusLabel === "Pending verification" ? "Membership card verification in progress" : "BrodigyAI chat stays locked"}
            message={memberLockMessage}
          />
        ) : (
          <>
            {isSessionDeleted ? (
              <FitText style={{ fontSize: 12, color: colors.danger, marginBottom: 12 }}>
                This chat is deleted. Restore it from BrodigyAI history before sending another message.
              </FitText>
            ) : null}
            {messages.map((message) =>
              message.from === "ai" ? (
                <View key={message.id} style={[styles.aiBubbleRow, { marginBottom: 12 }]}>
                  <View style={[styles.aiAvatar, { backgroundColor: colors.brand + "22", borderColor: colors.brand + "44" }]}>
                    <FitText style={[styles.aiAvatarText, { color: colors.brand }]}>B</FitText>
                  </View>
                  <View style={styles.aiBubble}>
                    <FitText style={styles.aiBubbleText}>{message.text}</FitText>
                  </View>
                </View>
              ) : (
                <View key={message.id} style={{ marginBottom: 12 }}>
                  <View style={styles.userBubble}>
                    <FitText style={styles.userBubbleText}>{message.text}</FitText>
                  </View>
                </View>
              )
            )}
            {isPending ? (
              <View style={[styles.aiBubbleRow, { marginBottom: 12 }]}>
                <View style={[styles.aiAvatar, { backgroundColor: colors.brand + "22", borderColor: colors.brand + "44" }]}>
                  <FitText style={[styles.aiAvatarText, { color: colors.brand }]}>B</FitText>
                </View>
                <View style={styles.aiBubble}>
                  <View style={styles.dotsWrap}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.inputBar}>
        <View style={styles.inputWrap}>
          <FitTextInput
            placeholder={isFrozen ? "Account frozen" : isMemberLocked ? "Membership card required" : isSessionDeleted ? "Restore this chat to continue" : "Type a message"}
            value={input}
            onChangeText={onInputChange}
            editable={!isFrozen && !isMemberLocked && !isSessionDeleted && !isPending}
          />
        </View>
        <Pressable onPress={onSend} disabled={!canSend} style={[styles.sendBtn, !canSend && { opacity: 0.6 }]}>
          <ArrowUp size={20} color={colors.surface} strokeWidth={2.5} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
