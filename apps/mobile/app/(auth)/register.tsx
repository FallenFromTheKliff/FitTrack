import { useEffect, useMemo, useState, type ElementType, type FormEvent } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, Dumbbell, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react-native";

import { useAuth, type RegistrationProblem } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthEntrance } from "@/hooks/animations/feature/useAuthEntrance";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import {
  FITTRACK_LEGAL_VERSION,
  FITTRACK_PRIVACY_SECTIONS,
  FITTRACK_TERMS_SECTIONS,
} from "@fittrack/app-config";
import { makeAuthStyles } from "@/styles/shared/AuthStyles";
import {
  mobileRegisterSchema,
  type MobileRegisterData,
} from "@fittrack/validators";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import { LegalDocumentSections } from "@/components/legal/LegalDocumentSections";
import OTPModal from "@/components/modals/auth/OTPModal";
import SettingsModal from "@/components/modals/settings/SettingsModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";
import {
  formatRegistrationLockCountdown,
  getRegistrationLockExpiry,
  getRegistrationLockRemainingSeconds,
  type RegistrationLockMetadata,
} from "@/lib/registration-lock";

const PASS_REQ_HEIGHT = 210;

const sanitizeNameInput = (value: string) => value.replace(/[^\p{L} ]/gu, "");
const sanitizeMobileRemainder = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("9") ? digits.slice(0, 10) : "";
};

export default function RegisterScreen() {
  const {
    register,
    sendOTP,
    verifyOTP,
    clearRegistrationChallenge,
  } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { fadeIn, takeFlight } = useAuthEntrance();
  const s = useMemo(() => makeAuthStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedRegistrationTerms, setHasAcceptedRegistrationTerms] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [statusTone, setStatusTone] = useState<"danger" | "brand">("brand");
  const [registrationLock, setRegistrationLock] = useState<RegistrationLockMetadata | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);

  const loadingText = useLoadingText("Creating account", isLoading);
  const { message: statusText, showMessage: showStatus } = useTimedMessage(2000);
  const buttonLabel = isLoading ? loadingText : "Create Account";

  const { control, getValues, handleSubmit, trigger, watch, formState: { errors, isValid } } = useForm<MobileRegisterData>({
    resolver: zodResolver(mobileRegisterSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    },
    mode: "onChange",
    reValidateMode: "onChange"
  });
  const isRegistrationLocked = registrationLock !== null && lockSeconds > 0;
  const passwordValue = watch("password");
  const showReqs = passwordValue.length > 0 && (isPasswordFocused || !isPasswordValid);

  const applyRegistrationLock = (problem?: RegistrationProblem) => {
    if (
      problem?.status !== 423 ||
      typeof problem.retryAfterSeconds !== "number" ||
      !problem.lockedUntil
    ) {
      return false;
    }

    const metadata: RegistrationLockMetadata = {
      retryAfterSeconds: problem.retryAfterSeconds,
      lockedUntil: problem.lockedUntil,
    };
    const expiresAt = getRegistrationLockExpiry(metadata);
    setRegistrationLock(metadata);
    setLockExpiresAt(expiresAt);
    setLockSeconds(getRegistrationLockRemainingSeconds(expiresAt));
    return true;
  };

  useEffect(() => {
    if (!lockExpiresAt) return;

    const updateRemaining = () => {
      const remaining = getRegistrationLockRemainingSeconds(lockExpiresAt);
      setLockSeconds(remaining);
      if (remaining > 0) return;

      setRegistrationLock(null);
      setLockExpiresAt(null);
      setLockSeconds(0);
      setStatusTone("brand");
      showStatus("Registration lock expired. You can try again.");
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [lockExpiresAt, showStatus]);

  useEffect(
    () => () => {
      clearRegistrationChallenge();
    },
    [clearRegistrationChallenge],
  );

  const blurActiveWebElement = () => {
    if (Platform.OS !== "web") return;
    const activeElement = (globalThis as {
      document?: { activeElement?: { blur?: () => void } };
    }).document?.activeElement;
    activeElement?.blur?.();
  };

  const { height: reqHeight, opacity: reqOpacity } = usePanelAnim({
    targetHeight: PASS_REQ_HEIGHT,
    visible: showReqs
  });

  const createAccount = async (data: MobileRegisterData) => {
    if (isLoading || isRegistrationLocked) return;
    setIsLoading(true);
    const normalizedPhone = data.phone.trim();
    const normalizedEmail = data.email.trim();
    const result = await register({
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      phone: normalizedPhone || undefined,
      password: data.password,
      acceptedTerms: true,
      legalVersion: FITTRACK_LEGAL_VERSION,
    });
    if (result.success) {
      setPendingEmail(normalizedEmail);
      setShowOTP(true);
      setIsLoading(false);
      return;
    }
    if (applyRegistrationLock(result.problem)) {
      setStatusTone("danger");
      showStatus("Registration is temporarily locked. Verification and restart are disabled until the server lock expires.");
      setIsLoading(false);
      return;
    }
    setStatusTone("danger");
    showStatus(result.error);
    setIsLoading(false);
  };

  const requestRegistration = (data: MobileRegisterData) => {
    if (isRegistrationLocked) return;
    if (!hasAcceptedRegistrationTerms) {
      setShowTermsModal(true);
      return;
    }

    void createAccount(data);
  };

  const handleAcceptTerms = async () => {
    if (isLoading || isRegistrationLocked) return;
    const valid = await trigger();
    if (!valid) return;
    setHasAcceptedRegistrationTerms(true);
    setShowTermsModal(false);
    void createAccount(getValues());
  };

  const handleOTPSuccess = async () => {
    Keyboard.dismiss();
    blurActiveWebElement();
    setShowOTP(false);
    setPendingEmail("");
    clearRegistrationChallenge();
    setStatusTone("brand");
    showStatus("Email verified. Please sign in with your credentials.");
    router.replace("/(auth)/login");
  };

  const handleRegistrationOTPVerify = (code: string) =>
    verifyOTP(code, { persistSession: false });

  const handleOTPResend = async () => {
    if (!pendingEmail) {
      return { success: false as const, error: "No pending registration." };
    }
    return sendOTP(pendingEmail);
  };

  const handleOTPDismiss = () => {
    Keyboard.dismiss();
    blurActiveWebElement();
    setShowOTP(false);
    setPendingEmail("");
    clearRegistrationChallenge();
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
  const submitRegistration = handleSubmit(requestRegistration);
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
                editable={!isLoading && !isRegistrationLocked}
                sanitizeValue={sanitizeNameInput}
              />
              <FitInputField
                control={control}
                name="lastName"
                label="Last Name"
                placeholder="Track"
                errors={errors}
                icon={User}
                autoCapitalize="words"
                editable={!isLoading && !isRegistrationLocked}
                sanitizeValue={sanitizeNameInput}
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
                editable={!isLoading && !isRegistrationLocked}
              />
              <FitInputField
                control={control}
                name="phone"
                label="Phone Number"
                placeholder="9171234567"
                errors={errors}
                icon={Phone}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!isLoading && !isRegistrationLocked}
                phonePrefix="+63"
                sanitizeValue={sanitizeMobileRemainder}
              />
              <FitInputField
                control={control}
                name="password"
                label="Password"
                placeholder="••••••••"
                errors={errors}
                icon={Lock}
                secureTextEntry
                editable={!isLoading && !isRegistrationLocked}
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
                editable={!isLoading && !isRegistrationLocked}
              />
            </View>
              <FitButton
                label={buttonLabel}
                onPress={submitRegistration}
                disabled={isLoading || !isValid || isRegistrationLocked}
                style={s.primaryBtn}
              />
              {isRegistrationLocked ? (
                <FitText style={[s.statusMessage, { color: colors.danger }]}>
                  Registration locked. Try again in {formatRegistrationLockCountdown(lockSeconds)}. Verification and restart are disabled until the server lock expires.
                </FitText>
              ) : null}
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
              Review our{" "}
              <FitText
                accessibilityRole="button"
                onPress={() => setShowTermsModal(true)}
                style={s.termsLink}
              >
                Terms of Service
              </FitText>{" "}
              and{" "}
              <FitText
                accessibilityRole="button"
                onPress={() => setShowTermsModal(true)}
                style={s.termsLink}
              >
                Data Privacy Notice
              </FitText>
              .
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
        onVerify={handleRegistrationOTPVerify}
        onResend={handleOTPResend}
        onSuccess={handleOTPSuccess}
        onDismiss={handleOTPDismiss}
        registrationNotice="Your account is created only after the correct verification code is accepted."
        dismissLabel="Back to registration"
      />
      <SettingsModal
        visible={showTermsModal}
        title="Terms & Data Privacy"
        icon={ShieldCheck}
        showScrollHint
        onClose={() => {
          setShowTermsModal(false);
        }}
      >
        <View style={{ gap: 18, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 }}>
          <LegalDocumentSections
            eyebrow="Terms of Service"
            sections={FITTRACK_TERMS_SECTIONS}
          />
          <LegalDocumentSections
            eyebrow="Philippine Data Privacy Notice"
            sections={FITTRACK_PRIVACY_SECTIONS}
          />
          <View
            style={{
              borderTopColor: colors.border,
              borderTopWidth: 1,
              gap: 10,
              paddingTop: 14,
              paddingBottom: 4,
            }}
          >
            <FitText style={[s.termsText, { textAlign: "left" }]}>
              By continuing, you confirm that you reviewed policy version{" "}
              {FITTRACK_LEGAL_VERSION} and accept the Terms of Service and Data
              Privacy Notice.
            </FitText>
            <FitButton
              label="I ACCEPT & CREATE ACCOUNT"
              variant="primary"
              icon={ShieldCheck}
              onPress={handleAcceptTerms}
              disabled={isLoading || isRegistrationLocked}
              style={{ width: "100%" }}
            />
            <FitButton
              label="NOT NOW"
              variant="ghost"
              onPress={() => {
                setShowTermsModal(false);
                setStatusTone("danger");
                showStatus(
                  "Accept the terms and privacy notice before creating an account.",
                );
              }}
              disabled={isLoading || isRegistrationLocked}
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </SettingsModal>
    </>
  );
}
