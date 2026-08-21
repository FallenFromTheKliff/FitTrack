import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useAnimatedReaction, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { ShieldCheck } from "lucide-react-native";

import {
  useAuth,
  type RegistrationOperationResult,
  type RegistrationProblem,
} from "@/contexts/AuthContext";
import { useTheme, useFontFamily } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { maskAuthDestination } from "@fittrack/utils";
import { makeOTPModalStyles } from "@/styles/modals/OTPStyles";
import {
  formatRegistrationLockCountdown,
  getRegistrationLockExpiry,
  getRegistrationLockRemainingSeconds,
  type RegistrationLockMetadata,
} from "@/lib/registration-lock";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

const OTP_LENGTH = 6;
const MAX_WRONG_ATTEMPTS = 5;
const RESEND_SECONDS = 55;
const INACTIVITY_MS = 5 * 60 * 1000;
const VERIFIED_SHOW_MS = 200;
const VERIFIED_EXIT_MS = 180;

type Props = {
  visible: boolean;
  destination: string;
  onSuccess: () => void;
  onDismiss: () => void;
  onVerify?: (code: string) => Promise<RegistrationOperationResult>;
  onResend?: () => Promise<RegistrationOperationResult>;
  registrationNotice?: string;
  dismissLabel?: string;
};

function getLockMetadata(problem?: RegistrationProblem): RegistrationLockMetadata | null {
  if (
    problem?.status !== 423 ||
    typeof problem.retryAfterSeconds !== "number" ||
    !problem.lockedUntil
  ) {
    return null;
  }

  return {
    retryAfterSeconds: problem.retryAfterSeconds,
    lockedUntil: problem.lockedUntil,
  };
}

function getTerminalMessage(problem?: RegistrationProblem, fallback?: string) {
  switch (problem?.type) {
    case "REGISTRATION_CHALLENGE_EXPIRED":
      return "This verification code expired. Go back to registration to start again.";
    case "REGISTRATION_CHALLENGE_COMPLETED":
      return "This registration was already completed. Please sign in with your credentials.";
    case "REGISTRATION_UNAVAILABLE":
      return "This registration could not be completed because the identity changed. Go back and try again.";
    default:
      return fallback;
  }
}

export default function OTPModal({
  visible,
  destination,
  onSuccess,
  onDismiss,
  onVerify,
  onResend,
  registrationNotice,
  dismissLabel,
}: Props) {
  const { verifyOTP, sendOTP } = useAuth();
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const fontFamily = useFontFamily();
  const s = useMemo(() => makeOTPModalStyles(colors), [colors]);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [registrationLock, setRegistrationLock] = useState<RegistrationLockMetadata | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);

  const inputRefs = useRef<Array<any>>(Array(OTP_LENGTH).fill(null));
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockActiveRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const onSuccessRef = useRef(onSuccess);

  const { opacity, scale } = useOverlayAnim(visible, "scale");
  const successSignal = useSharedValue(0);
  const verifyingText = useLoadingText("Verifying", isVerifying);
  const { message: errorText, showMessage: showError } = useTimedMessage(2500);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    onSuccessRef.current = onSuccess;
  }, [onDismiss, onSuccess]);

  const finishSuccess = useCallback(() => {
    onSuccessRef.current();
  }, []);

  useAnimatedReaction(
    () => successSignal.value,
    (val, prev) => {
      if (val === 1 && prev !== 1) {
        runOnJS(finishSuccess)();
      }
    },
    [finishSuccess]
  );

  const code = digits.join("");
  const isComplete = code.length === OTP_LENGTH;
  const isLocked = lockActiveRef.current && lockSeconds > 0;

  const buttonLabel = isLocked
    ? `Locked · ${formatRegistrationLockCountdown(lockSeconds)}`
    : isVerified
      ? "Verified!"
      : isVerifying
        ? verifyingText
        : "Verify & Continue";
  const buttonDisabled =
    !isComplete || isVerifying || isVerified || isLocked || !!terminalMessage;

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface
  }));
  const titleStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const subtitleStyle = useAnimatedStyle(() => ({ color: ic.value.textSecondary }));

  const blurOtpInputs = useCallback(() => {
    inputRefs.current.forEach((inputRef) => inputRef?.blur?.());
    if (Platform.OS === "web") {
      const activeElement = (globalThis as {
        document?: { activeElement?: { blur?: () => void } };
      }).document?.activeElement;
      activeElement?.blur?.();
    }
  }, []);

  const focusFirstInput = useCallback(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  const activateLock = useCallback(
    (problem?: RegistrationProblem) => {
      const metadata = getLockMetadata(problem);
      if (!metadata) return false;

      const expiresAt = getRegistrationLockExpiry(metadata);
      lockActiveRef.current = true;
      setRegistrationLock(metadata);
      setLockExpiresAt(expiresAt);
      setLockSeconds(getRegistrationLockRemainingSeconds(expiresAt));
      setDigits(Array(OTP_LENGTH).fill(""));
      setIsVerifying(false);
      setTerminalMessage(null);
      setResendSeconds(0);
      blurOtpInputs();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
      return true;
    },
    [blurOtpInputs],
  );

  const resetInactivity = useCallback(() => {
    if (lockActiveRef.current) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      blurOtpInputs();
      onDismissRef.current();
    }, INACTIVITY_MS);
  }, [blurOtpInputs]);

  const startResendCountdown = useCallback(() => {
    setResendSeconds(RESEND_SECONDS);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!visible) {
      blurOtpInputs();
    }
  }, [blurOtpInputs, visible]);

  useEffect(() => {
    if (!lockExpiresAt) return;

    const updateRemaining = () => {
      const remaining = getRegistrationLockRemainingSeconds(lockExpiresAt);
      setLockSeconds(remaining);
      if (remaining > 0) return;

      lockActiveRef.current = false;
      setRegistrationLock(null);
      setLockExpiresAt(null);
      setLockSeconds(0);
      setWrongAttempts(0);
      showError("Registration lock expired. You can request a new code.");
      resetInactivity();
      focusFirstInput();
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [focusFirstInput, lockExpiresAt, resetInactivity, showError]);

  useEffect(() => {
    if (!visible) return;
    setDigits(Array(OTP_LENGTH).fill(""));
    setWrongAttempts(0);
    setIsVerified(false);
    lockActiveRef.current = false;
    setRegistrationLock(null);
    setLockExpiresAt(null);
    setLockSeconds(0);
    setTerminalMessage(null);
    resetInactivity();
    startResendCountdown();
    focusTimer.current = setTimeout(() => inputRefs.current[0]?.focus(), 200);
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
      if (verifiedTimer.current) clearTimeout(verifiedTimer.current);
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [focusFirstInput, resetInactivity, startResendCountdown, visible]);

  const handleChange = (text: string, index: number) => {
    if (isLocked || terminalMessage) return;
    resetInactivity();
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (isLocked || terminalMessage) return;
    if (key === "Backspace" && !digits[index] && index > 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!isComplete || isVerifying || isVerified || isLocked || terminalMessage) return;
    setIsVerifying(true);
    let result: RegistrationOperationResult;
    try {
      result = await (onVerify ?? verifyOTP)(code);
    } catch {
      result = {
        success: false,
        error: "Unable to verify the code. Please try again.",
      };
    }
    if (result.success) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
      blurOtpInputs();
      setIsVerifying(false);
      setIsVerified(true);
      verifiedTimer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(0.95, { duration: 200 });
        setTimeout(() => {
          successSignal.value = 1;
        }, VERIFIED_EXIT_MS);
      }, VERIFIED_SHOW_MS);
    } else {
      setIsVerifying(false);
      if (activateLock(result.problem)) return;

      const terminal = getTerminalMessage(result.problem, result.error);
      if (result.problem?.type === "REGISTRATION_CHALLENGE_EXPIRED" ||
          result.problem?.type === "REGISTRATION_CHALLENGE_COMPLETED" ||
          result.problem?.type === "REGISTRATION_UNAVAILABLE") {
        setTerminalMessage(terminal ?? "Registration verification is no longer available.");
        setDigits(Array(OTP_LENGTH).fill(""));
        blurOtpInputs();
        return;
      }

      const remainingAttempts = result.problem?.remainingAttempts;
      const next =
        typeof remainingAttempts === "number"
          ? MAX_WRONG_ATTEMPTS - remainingAttempts
          : wrongAttempts + 1;
      setWrongAttempts(Math.max(0, next));
      showError(
        remainingAttempts == null
          ? result.error || "Incorrect verification code."
          : `${result.error || "Incorrect verification code."} ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} left.`,
      );
      setDigits(Array(OTP_LENGTH).fill(""));
      focusFirstInput();
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || isLocked || terminalMessage) return;
    let result: RegistrationOperationResult;
    try {
      result = onResend ? await onResend() : await sendOTP(destination);
    } catch {
      result = {
        success: false,
        error: "Could not resend the verification code.",
      };
    }
    if (!result.success) {
      if (activateLock(result.problem)) return;
      const terminal = getTerminalMessage(result.problem, result.error);
      if (result.problem?.type === "REGISTRATION_CHALLENGE_EXPIRED" ||
          result.problem?.type === "REGISTRATION_CHALLENGE_COMPLETED" ||
          result.problem?.type === "REGISTRATION_UNAVAILABLE") {
        setTerminalMessage(terminal ?? "Registration verification is no longer available.");
        return;
      }
      showError(result.error || "Could not resend the verification code.");
      return;
    }
    setDigits(Array(OTP_LENGTH).fill(""));
    resetInactivity();
    startResendCountdown();
    focusFirstInput();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={isLocked ? undefined : onDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, pointerEvents: "none" as const }]} />
          <Animated.View style={[s.card, cardStyle]}>
            <View style={s.iconCircle}>
              <ShieldCheck size={34} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
            </View>
            <AnimatedFitText style={[s.title, titleStyle]}>
              Verify OTP
            </AnimatedFitText>
            <AnimatedFitText style={[s.subtitle, subtitleStyle]}>
              {"Enter the 6-digit code sent to\n"}
              <FitText style={s.phoneMasked}>{maskAuthDestination(destination)}</FitText>
            </AnimatedFitText>
            {registrationNotice ? (
              <FitText style={s.notice}>{registrationNotice}</FitText>
            ) : null}
            {registrationLock && isLocked ? (
              <View style={s.lockNotice}>
                <FitText style={s.lockTitle}>Registration temporarily locked</FitText>
                <FitText style={s.lockText}>
                  Too many incorrect codes. Try again in {formatRegistrationLockCountdown(lockSeconds)}. Verification, resend, and restart are disabled until the server lock expires.
                </FitText>
              </View>
            ) : null}
            <View style={s.digitRow}>
              {digits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref: any) => {
                    inputRefs.current[i] = ref;
                  }}
                  style={[
                    s.digitBox,
                    digit ? s.digitBoxFilled : undefined,
                    (isLocked || !!terminalMessage) && s.digitBoxDisabled,
                    { fontFamily },
                  ]}
                  value={digit}
                  onChangeText={(text) => handleChange(text, i)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, i)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  caretHidden
                  editable={!isLocked && !terminalMessage}
                />
              ))}
            </View>
            <FitButton
              label={buttonLabel}
              onPress={handleVerify}
              variant="primary"
              disabled={buttonDisabled}
              loading={isVerifying}
              style={s.verifyBtn}
              textStyle={errorText || terminalMessage ? { color: colors.danger } : undefined}
            />
            {terminalMessage ? (
              <FitText style={s.errorText}>{terminalMessage}</FitText>
            ) : errorText ? (
              <FitText style={s.errorText}>{errorText}</FitText>
            ) : null}
            <View style={s.resendRow}>
              <FitText style={s.resendText}>Resend OTP</FitText>
              {isLocked ? (
                <FitText style={[s.resendText, { color: colors.danger }]}>
                  {"  locked  "}
                  {formatRegistrationLockCountdown(lockSeconds)}
                </FitText>
              ) : resendSeconds > 0 ? (
                <FitText style={s.resendText}>
                  {"  in  "}
                  <FitText
                    style={{ color: colors.textPrimary, fontWeight: "700" }}
                  >
                    {resendSeconds}
                  </FitText>
                  <FitText style={{ color: colors.textMuted }}> s</FitText>
                </FitText>
              ) : (
                <FitButton
                  label="Resend"
                  variant="link"
                  onPress={handleResend}
                  style={s.resendBtn}
                  textStyle={{ textDecorationLine: "none" }}
                />
              )}
            </View>
            {!isLocked && dismissLabel ? (
              <FitButton
                label={dismissLabel}
                variant="link"
                onPress={onDismiss}
                disabled={isVerifying}
                style={s.dismissBtn}
                textStyle={{ textDecorationLine: "none" }}
              />
            ) : null}
            <FitText style={s.copyright}>(c) 2026 SertFit Gym. All rights reserved.</FitText>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
