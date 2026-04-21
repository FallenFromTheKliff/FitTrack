import { useMemo, useState, type ElementType, type FormEvent } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, Dumbbell, Lock, Mail, Phone, User } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthEntrance } from "@/hooks/animations/feature/useAuthEntrance";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { makeAuthStyles } from "@/styles/shared/AuthStyles";
import {
  coerceAuthPhilippineMobileInput,
  composeAuthPhilippineMobileNumber,
  formatAuthPhilippineMobileDigits,
  normalizeAuthPhilippineMobileNumber,
  registerSchema,
  type RegisterData,
} from "@fittrack/validators";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import BufferScreen from "@/components/loading/BufferScreen";
import OTPModal from "@/components/modals/auth/OTPModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

const PASS_REQ_HEIGHT = 210;
const PHONE_PREFIX_OPTIONS = [
  { label: "+63", value: "+63" },
  { label: "09", value: "09" },
] as const;

type PhonePrefixMode = (typeof PHONE_PREFIX_OPTIONS)[number]["value"];

export default function RegisterScreen() {
  const { register, commitLogin, sendOTP } = useAuth();
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
  const [statusTone, setStatusTone] = useState<"danger" | "brand">("brand");
  const [phonePrefixMode, setPhonePrefixMode] = useState<PhonePrefixMode>("+63");

  const loadingText = useLoadingText("Creating account", isLoading);
  const { message: statusText, showMessage: showStatus } = useTimedMessage(2000);
  const buttonLabel = isLoading ? loadingText : "Create Account";

  const { control, getValues, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  const passwordValue = watch("password");
  const showReqs = passwordValue.length > 0 && (isPasswordFocused || !isPasswordValid);

  const blurActiveWebElement = () => {
    if (Platform.OS !== "web") return;
    const activeElement = (globalThis as {
      document?: { activeElement?: { blur?: () => void } };
    }).document?.activeElement;
    activeElement?.blur?.();
  };

  const applyPhonePrefixMode = (nextMode: string) => {
    if (nextMode !== "+63" && nextMode !== "09") return;
    const nextPrefix = nextMode as PhonePrefixMode;
    const nextDigits = formatAuthPhilippineMobileDigits(getValues("phone") ?? "", nextPrefix);
    setPhonePrefixMode(nextPrefix);
    setValue("phone", composeAuthPhilippineMobileNumber(nextPrefix, nextDigits), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const { height: reqHeight, opacity: reqOpacity } = usePanelAnim({
    targetHeight: PASS_REQ_HEIGHT,
    visible: showReqs
  });

  const onSubmit = async (data: RegisterData) => {
    if (isLoading) return;
    setIsLoading(true);
    const normalizedPhone = normalizeAuthPhilippineMobileNumber(data.phone);
    const result = await register({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: normalizedPhone || undefined,
      password: data.password
    });
    if (result) {
      setPendingEmail(data.email);
      setShowOTP(true);
      setIsLoading(false);
      return;
    }
    setStatusTone("danger");
    showStatus("Could not create account. Please try again.");
    setIsLoading(false);
  };

  const handleOTPSuccess = async () => {
    Keyboard.dismiss();
    blurActiveWebElement();
    setShowOTP(false);
    setPendingEmail("");
    setShowBuffer(true);
  };

  const handleOTPResend = async () => {
    if (!pendingEmail) return;
    const result = await sendOTP(pendingEmail);
    if (!result.success) {
      setStatusTone("danger");
      showStatus("Could not resend the verification code.");
    }
  };

  const handleOTPDismiss = () => {
    Keyboard.dismiss();
    blurActiveWebElement();
    setShowOTP(false);
    setPendingEmail("");
    setStatusTone("brand");
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
  const submitRegistration = handleSubmit(onSubmit);
  const FormShell = (Platform.OS === "web" ? "form" : View) as ElementType;
  const formShellProps = Platform.OS === "web"
    ? {
        onSubmit: (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void submitRegistration();
        },
        style: { display: "contents" as const }
      }
    : {};

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
              onPress={() => {
                Keyboard.dismiss();
                blurActiveWebElement();
                router.replace("/(auth)/login");
              }}
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
            <FormShell {...formShellProps}>
            <View style={s.fields}>
              <FitInputField
                control={control}
                name="firstName"
                label="First Name"
                placeholder="Fit"
                errors={errors}
                icon={User}
                autoCapitalize="words"
                editable={!isLoading}
              />
              <FitInputField
                control={control}
                name="lastName"
                label="Last Name"
                placeholder="Track"
                errors={errors}
                icon={User}
                autoCapitalize="words"
                editable={!isLoading}
              />
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
                placeholder={phonePrefixMode === "+63" ? "9171234567" : "171234567"}
                errors={errors}
                icon={Phone}
                keyboardType="phone-pad"
                maxLength={13}
                editable={!isLoading}
                phonePrefixOptions={PHONE_PREFIX_OPTIONS}
                phonePrefixValue={phonePrefixMode}
                onPhonePrefixChange={applyPhonePrefixMode}
                formatInputValue={(currentValue) => formatAuthPhilippineMobileDigits(currentValue, phonePrefixMode)}
                sanitizeValue={(inputValue) => {
                  const next = coerceAuthPhilippineMobileInput(inputValue, phonePrefixMode);
                  if (next.mode !== phonePrefixMode) {
                    setPhonePrefixMode(next.mode);
                  }
                  return next.value;
                }}
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
                onPress={submitRegistration}
                disabled={isLoading}
                style={s.primaryBtn}
              />
              {statusText ? (
                <FitText
                  style={[
                    s.statusMessage,
                    { color: statusTone === "danger" ? colors.danger : colors.brand }
                  ]}
                >
                  {statusText}
                </FitText>
              ) : null}
            </FormShell>
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
