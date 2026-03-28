import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, Dumbbell, Lock, Mail, Phone } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthEntrance } from "@/hooks/animations/feature/useAuthEntrance";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { makeAuthStyles } from "@/styles/shared/AuthStyles";
import { registerSchema, type RegisterData } from "@fittrack/validators";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import BufferScreen from "@/components/loading/BufferScreen";
import OTPModal from "@/components/modals/auth/OTPModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

const PASS_REQ_HEIGHT = 210;

export default function RegisterScreen() {
  const { register, commitLogin } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { fadeIn, takeFlight } = useAuthEntrance();
  const s = useMemo(() => makeAuthStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const loadingText = useLoadingText("Creating account", isLoading);
  const { message: statusText, showMessage: showStatus } = useTimedMessage(2000);
  const buttonLabel = isLoading ? loadingText : statusText || "Create Account";

  const { control, handleSubmit, watch, formState: { errors } } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", phone: "", password: "", confirmPassword: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  const passwordValue = watch("password");
  const showReqs = passwordValue.length > 0 && (isPasswordFocused || !isPasswordValid);

  const { height: reqHeight, opacity: reqOpacity } = usePanelAnim({
    targetHeight: PASS_REQ_HEIGHT,
    visible: showReqs
  });

  const onSubmit = async (data: RegisterData) => {
    if (isLoading) return;
    setIsLoading(true);
    const result = await register({
      email: data.email,
      phone: data.phone,
      password: data.password
    });
    if (result) {
      setPendingEmail(data.email);
      setPendingPhone(data.phone);
      setPendingPassword(data.password);
      setShowOTP(true);
      setIsLoading(false);
      return;
    }
    showStatus("Could not create account. Please try again.");
    setIsLoading(false);
  };

  const handleOTPSuccess = async () => {
    setShowOTP(false);
    setPendingEmail("");
    setPendingPhone("");
    setPendingPassword("");
    setShowBuffer(true);
  };

  const handleOTPResend = async () => {
    if (!pendingEmail || !pendingPassword) return;
    const result = await register({
      email: pendingEmail,
      phone: pendingPhone,
      password: pendingPassword
    });
    if (!result) {
      showStatus("Could not resend the verification code.");
    }
  };

  const handleOTPDismiss = () => {
    setShowOTP(false);
    setPendingEmail("");
    setPendingPhone("");
    setPendingPassword("");
    showStatus("Verification cancelled. Please try again.");
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: takeFlight.value }]
  }));
  const reqPanelStyle = useAnimatedStyle(() => ({
    overflow: "hidden",
    height: reqHeight.value,
    opacity: reqOpacity.value
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
    <>
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isLoading}
        >
          <Animated.View style={fadeStyle}>
            <FitButton
              variant="link"
              label="Back"
              onPress={() => router.replace("/(auth)/login")}
              icon={ArrowLeft}
              disabled={isLoading}
              style={s.backBtn}
              textStyle={{ textDecorationLine: "none" }}
            />
          </Animated.View>
          <Animated.View style={heroStyle}>
            <View style={s.iconCircle}>
              <Dumbbell size={36} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
            </View>
            <View style={s.titleBlock}>
              <FitText style={s.title}>Create Account</FitText>
              <FitText style={s.subtitle}>Join SertFit Gym today</FitText>
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
                name="phone"
                label="Phone Number"
                placeholder="09123456789"
                errors={errors}
                icon={Phone}
                keyboardType="phone-pad"
                maxLength={11}
                editable={!isLoading}
              />
              <FitInputField
                control={control}
                name="password"
                label="Password"
                placeholder="••••••••"
                errors={errors}
                icon={Lock}
                secureTextEntry
                editable={!isLoading}
                onFocusChange={setIsPasswordFocused}
              />
              <Animated.View style={reqPanelStyle}>
                <PasswordRequirements
                  password={passwordValue}
                  onValidationChange={setIsPasswordValid}
                />
              </Animated.View>
              <FitInputField
                control={control}
                name="confirmPassword"
                label="Confirm Password"
                placeholder="••••••••"
                errors={errors}
                icon={Lock}
                secureTextEntry
                editable={!isLoading}
              />
            </View>
            <FitButton
              label={buttonLabel}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              style={s.primaryBtn}
            />
            <FitText style={s.termsText}>
              By creating an account, you agree to our{" "}
              <FitText style={s.termsLink}>Terms of Service</FitText> and{" "}
              <FitText style={s.termsLink}>Privacy Policy</FitText>
            </FitText>
            <FitText style={s.copyright}>
              (c) 2026 SertFit Gym. All rights reserved.
            </FitText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      <OTPModal
        visible={showOTP}
        destination={pendingEmail}
        onResend={handleOTPResend}
        onSuccess={handleOTPSuccess}
        onDismiss={handleOTPDismiss}
      />
    </>
  );
}
