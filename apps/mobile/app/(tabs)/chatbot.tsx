import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ArrowUp } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeBrodigyStyles } from "@/styles/shared/ScreenStyles";
import { GREETING_MESSAGE } from "@/data/chat";

import { FitText, FitTextInput } from "@/components/fit/FitText";

type Msg = { id: string; text: string; from: "ai" | "user" };

export default function ChatbotScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBrodigyStyles(colors), [colors]);

  const [messages, setMessages] = useState<Msg[]>([{ id: "m1", text: GREETING_MESSAGE, from: "ai" }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const isFrozen = user?.status === "frozen";

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const send = () => {
    if (isFrozen) return;
    if (!input.trim()) return;
    const userMsg: Msg = { id: `u${Date.now()}`, text: input.trim(), from: "user" };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          text: "I'm still being set up! Check back soon for personalized fitness coaching. 🏋️",
          from: "ai"
        }
      ]);
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1200);
  };

  const canSend = !isFrozen && !!input.trim() && !isLoading;

  return (
      <Animated.View style={base.screen}>
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={80}
        >
          <Animated.View style={[base.content, screenStyle, contentStyle]}>
            <ScrollView
                ref={scrollRef}
                style={s.messagesArea}
                contentContainerStyle={{ paddingBottom: 20 }}
                scrollEventThrottle={16}
            >
              {messages.map((m) =>
                  m.from === "ai" ? (
                      <View key={m.id} style={[s.aiBubbleRow, { marginBottom: 12 }]}>
                        <View style={[s.aiAvatar, { backgroundColor: colors.brand + "22", borderColor: colors.brand + "44" }]}>
                          <FitText style={[s.aiAvatarText, { color: colors.brand }]}>B</FitText>
                        </View>
                        <View style={s.aiBubble}>
                          <FitText style={s.aiBubbleText}>{m.text}</FitText>
                        </View>
                      </View>
                  ) : (
                      <View key={m.id} style={{ marginBottom: 12 }}>
                        <View style={s.userBubble}>
                          <FitText style={s.userBubbleText}>{m.text}</FitText>
                        </View>
                      </View>
                  )
              )}
              {isLoading && (
                  <View style={[s.aiBubbleRow, { marginTop: 8 }]}>
                    <View style={[s.aiAvatar, { backgroundColor: colors.brand + "22", borderColor: colors.brand + "44" }]}>
                      <FitText style={[s.aiAvatarText, { color: colors.brand }]}>B</FitText>
                    </View>
                    <View style={s.aiBubble}>
                      <View style={s.dotsWrap}>
                        <View style={s.dot} />
                        <View style={s.dot} />
                        <View style={s.dot} />
                      </View>
                    </View>
                  </View>
              )}
            </ScrollView>
          </Animated.View>
          <View style={s.inputBar}>
            <View style={s.inputWrap}>
              <FitTextInput
                  placeholder={isFrozen ? "Account frozen" : "Type a message"}
                  value={input}
                  onChangeText={setInput}
                  editable={!isFrozen && !isLoading}
              />
            </View>
            <Pressable onPress={send} disabled={!canSend} style={[s.sendBtn, !canSend && { opacity: 0.6 }]}>
              <ArrowUp size={20} color={colors.surface} strokeWidth={2.5} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
  );
}
