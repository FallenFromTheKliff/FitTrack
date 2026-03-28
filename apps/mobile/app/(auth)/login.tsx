import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Dumbbell, Lock, Mail } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthEntrance } from "@/hooks/animations/feature/useAuthEntrance";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { loginSchema, type LoginData } from "@fittrack/validators";
import { makeAuthStyles } from "@/styles/shared/AuthStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import BufferScreen from "@/components/loading/BufferScreen";
import ForgotPasswordModal from "@/components/modals/auth/ForgotPasswordModal";

export default function LoginScreen() {
  const { login, commitLogin } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { fadeIn, takeFlight } = useAuthEntrance();
  const s = useMemo(() => makeAuthStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const contentOpacity = useSharedValue(1);

  const loadingText = useLoadingText("Signing in", isLoading);
  const { message: statusText, showMessage: showStatus } = useTimedMessage(2000);
  const buttonLabel = isLoading ? loadingText : statusText || "Sign In";

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });

  const fadeOutAndShowBuffer = async () => {
    contentOpacity.value = withTiming(0, { duration: 200 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowBuffer(true);
  };

  const onSubmit = async (data: LoginData) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    const result = await login(data.email, data.password);
    setIsLoading(false);
    if (!result) {
      showStatus("Invalid credentials.");
      return;
    }
    if (result.needsOTP) {
      showStatus("Verification code sent. Check your email to continue.");
      return;
    }
    showStatus("Welcome back!");
    await fadeOutAndShowBuffer();
  };

  const heroStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: takeFlight.value }]
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value
  }));

  const screenFadeStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value
  }));

  if (showBuffer) {
    return (
      <BufferScreen
        onCommit={commitLogin}
        onDone={() => router.replace("/(tabs)/home")}
      />
    );
  }

  return (
    <Animated.View style={[s.screen, screenFadeStyle]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isLoading}
        >
          <Animated.View style={heroStyle}>
            <View style={s.iconCircle}>
              <Dumbbell size={36} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
            </View>
            <View style={s.titleBlock}>
              <FitText style={s.title}>FitTrack</FitText>
              <FitText style={s.subtitle}>SertFit Gym Member Portal</FitText>
            </View>
          </Animated.View>
          <Animated.View style={fadeStyle}>
            <View style={s.fields}>
              <FitInputField
                control={control}
                name="email"
                label="Email"
                placeholder="your.email@example.com"
                errors={errors}
                icon={Mail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              <FitInputField
                control={control}
                name="password"
                label="Password"
                placeholder="********"
                errors={errors}
                icon={Lock}
                secureTextEntry
                editable={!isLoading}
              />
              <FitText style={s.forgotPassword} onPress={() => setForgotOpen(true)}>
                Forgot Password?
              </FitText>
            </View>
            <FitButton
              label={buttonLabel}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              style={s.primaryBtn}
            />
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <FitText style={s.dividerText}>New to SertFit?</FitText>
              <View style={s.dividerLine} />
            </View>
            <FitButton
              label="Create Account"
              variant="ghost"
              onPress={() => router.push("/(auth)/register")}
              disabled={isLoading}
            />
            <FitText style={s.copyright}>(c) 2026 SertFit Gym. All rights reserved.</FitText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ForgotPasswordModal
        isVisible={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </Animated.View>
  );
}
