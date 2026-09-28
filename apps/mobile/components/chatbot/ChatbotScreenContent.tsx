import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextStyle } from "react-native";
import { ArrowUp } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { guardAiResponseText } from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { makeBrodigyStyles } from "@/styles/shared/ScreenStyles";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import AiFormattedText from "@/components/chatbot/AiFormattedText";
import BrodigyThinkingIndicator from "@/components/chatbot/BrodigyThinkingIndicator";

import type { ChatbotMessage } from "@/hooks/chatbot/useChatbotScreen";

const BRODIGY_COMPOSER_MIN_HEIGHT = 52;
const BRODIGY_COMPOSER_MAX_HEIGHT = 136;

type ChatbotScreenContentProps = {
  canSend: boolean;
  input: string;
  isFrozen: boolean;
  isMemberLocked: boolean;
  isPending: boolean;
  isSessionDeleted: boolean;
  keyboardVerticalOffset: number;
  lastError: string;
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
  keyboardVerticalOffset,
  lastError,
  messages,
  onInputChange,
  onSend,
  sessionTitle,
  statusMessage,
  styles
}: ChatbotScreenContentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [inputHeight, setInputHeight] = useState(BRODIGY_COMPOSER_MIN_HEIGHT);

  const handleInputContentSizeChange = (event: {
    nativeEvent: { contentSize: { height: number } };
  }) => {
    const measuredHeight = event.nativeEvent.contentSize.height;
    if (!Number.isFinite(measuredHeight)) return;

    const nextHeight = Math.min(
      BRODIGY_COMPOSER_MAX_HEIGHT,
      Math.max(BRODIGY_COMPOSER_MIN_HEIGHT, Math.ceil(measuredHeight)),
    );
    setInputHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  useEffect(() => {
    if (input.length === 0) setInputHeight(BRODIGY_COMPOSER_MIN_HEIGHT);
  }, [input]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(timer);
  }, [isPending, messages]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
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
                    <AiFormattedText text={guardAiResponseText(message.text)} textStyle={styles.aiBubbleText} />
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
                  <BrodigyThinkingIndicator />
                </View>
              </View>
            ) : null}
        </>
      </ScrollView>
      <View style={[styles.inputBar, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
        <View style={[styles.inputWrap, { height: inputHeight }]}>
          <FitTextInput
            nativeID="brodigyai-message-input"
            accessibilityLabel="Type a message"
            placeholder={isFrozen ? "Account frozen" : isMemberLocked ? "Membership card required" : isSessionDeleted ? "Restore this chat to continue" : "Type a message"}
            value={input}
            onChangeText={onInputChange}
            onContentSizeChange={handleInputContentSizeChange}
            multiline
            numberOfLines={2}
            scrollEnabled={inputHeight >= BRODIGY_COMPOSER_MAX_HEIGHT}
            submitBehavior="newline"
            style={[
              styles.inputText,
              Platform.OS === "web"
                ? ({ scrollbarWidth: "none" } as unknown as TextStyle)
                : null,
            ]}
            editable={!isFrozen && !isMemberLocked && !isSessionDeleted && !isPending}
          />
        </View>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[styles.sendBtn, !canSend && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
        >
          <ArrowUp size={20} color={colors.surface} strokeWidth={2.5} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
