import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Dumbbell, Lock, Mail } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthEntrance } from "@/hooks/animations/feature/useAuthEntrance";
import { useLoadingText } from "@fittrack/hooks";
import { loginSchema, type LoginData } from "@fittrack/validators";
import { makeAuthStyles } from "@/styles/shared/AuthStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import BufferScreen from "@/components/loading/BufferScreen";
import ForgotPasswordModal from "@/components/modals/auth/ForgotPasswordModal";

const WEB_AUTH_STATUS_KEY = "fittrack_mobile_auth_status";

export default function LoginScreen() {
  const {
    login,
    commitLogin,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { fadeIn, takeFlight } = useAuthEntrance();
  const s = useMemo(() => makeAuthStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [statusTone, setStatusTone] = useState<"danger" | "brand">("brand");
  const [statusText, setStatusText] = useState("");
  const contentOpacity = useSharedValue(1);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedStatusText =
    Platform.OS === "web"
      ? (globalThis.sessionStorage?.getItem(WEB_AUTH_STATUS_KEY)?.trim() ?? "")
      : "";
  const visibleStatusText = statusText || persistedStatusText;

  const loadingText = useLoadingText("Signing in", isLoading);
  const buttonLabel = isLoading ? loadingText : "Sign In";

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const showStatus = useCallback(
    (message: string, options?: { autoClearMs?: number | null }) => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
      setStatusText(message);
      if (options?.autoClearMs === null) {
        statusTimerRef.current = null;
        return;
      }
      const autoClearMs = options?.autoClearMs ?? 2000;
      statusTimerRef.current = setTimeout(() => {
        setStatusText("");
        statusTimerRef.current = null;
      }, autoClearMs);
    },
    [],
  );

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    },
    [],
  );

  const fadeOutAndShowBuffer = async () => {
    contentOpacity.value = withTiming(0, { duration: 200 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowBuffer(true);
  };

  useEffect(() => {
    if (showBuffer || isAuthLoading || !isAuthenticated) return;
    router.replace("/(tabs)/home");
  }, [isAuthenticated, isAuthLoading, router, showBuffer]);

  const onSubmit = async (data: LoginData) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    const result = await login(data.email.trim(), data.password);
    setIsLoading(false);
    if ("error" in result) {
      setStatusTone("danger");
      if (Platform.OS === "web") {
        globalThis.sessionStorage?.setItem(WEB_AUTH_STATUS_KEY, result.error);
      }
      showStatus(result.error, {
        autoClearMs: result.reason === "ACCOUNT_LOCKED" ? null : 2000,
      });
      return;
    }
    if (Platform.OS === "web") {
      globalThis.sessionStorage?.removeItem(WEB_AUTH_STATUS_KEY);
    }
    if (result.needsOTP) {
      setStatusTone("brand");
      showStatus("Verification code sent. Check your email to continue.");
      return;
    }
    setStatusTone("brand");
    showStatus("Welcome back!");
    await fadeOutAndShowBuffer();
  };

  const heroStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: takeFlight.value }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const screenFadeStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));
  const submitCredentials = handleSubmit(onSubmit);

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
              <Dumbbell
                size={36}
                color={colors.onBrand ?? "#FFFFFF"}
                strokeWidth={2}
              />
            </View>
            <View style={s.titleBlock}>
              <FitText style={s.title}>FitTrack</FitText>
              <FitText style={s.subtitle}>SertFit Gym Member Portal</FitText>
            </View>
          </Animated.View>
          <Animated.View style={fadeStyle}>
            <View>
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
                <FitText
                  style={s.forgotPassword}
                  onPress={() => setForgotOpen(true)}
                >
                  Forgot Password?
                </FitText>
              </View>
              <FitButton
                label={buttonLabel}
                onPress={submitCredentials}
                disabled={isLoading}
                style={s.primaryBtn}
              />
            </View>
            {visibleStatusText ? (
              <FitText
                style={[
                  s.statusMessage,
                  {
                    color:
                      statusTone === "danger" || persistedStatusText
                        ? colors.danger
                        : colors.brand,
                  },
                ]}
              >
                {visibleStatusText}
              </FitText>
            ) : null}
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
            <FitText style={s.copyright}>
              (c) 2026 SertFit Gym. All rights reserved.
            </FitText>
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
