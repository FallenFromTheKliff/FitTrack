import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useAnimatedReaction, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { ShieldCheck } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme, useFontFamily } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { maskAuthDestination } from "@fittrack/utils";
import { makeOTPModalStyles } from "@/styles/modals/OTPStyles";

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
  onVerify?: (code: string) => Promise<{ success: boolean; error?: string }>;
  onResend?: () => Promise<void>;
};

export default function OTPModal({
  visible,
  destination,
  onSuccess,
  onDismiss,
  onVerify,
  onResend
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

  const inputRefs = useRef<Array<any>>(Array(OTP_LENGTH).fill(null));
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const buttonLabel = isVerified ? "Verified!" : isVerifying ? verifyingText : "Verify & Continue";
  const buttonDisabled = !isComplete || isVerifying || isVerified;

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

  const resetInactivity = useCallback(() => {
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
    if (!visible) return;
    setDigits(Array(OTP_LENGTH).fill(""));
    setWrongAttempts(0);
    setIsVerified(false);
    resetInactivity();
    startResendCountdown();
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
      if (verifiedTimer.current) clearTimeout(verifiedTimer.current);
    };
  }, [visible, resetInactivity, startResendCountdown]);

  const handleChange = (text: string, index: number) => {
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
    if (!isComplete || isVerifying || isVerified) return;
    setIsVerifying(true);
    const result = await (onVerify ?? verifyOTP)(code);
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
      const next = wrongAttempts + 1;
      setWrongAttempts(next);
      if (next >= MAX_WRONG_ATTEMPTS) onDismissRef.current();
      else {
        showError(
          `Incorrect. ${MAX_WRONG_ATTEMPTS - next} attempt${MAX_WRONG_ATTEMPTS - next === 1 ? "" : "s"} left.`
        );
        setDigits(Array(OTP_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;
    if (onResend) await onResend();
    else await sendOTP(destination);
    setDigits(Array(OTP_LENGTH).fill(""));
    setWrongAttempts(0);
    resetInactivity();
    startResendCountdown();
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={undefined}
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
              textStyle={errorText ? { color: colors.danger } : undefined}
            />
            <View style={s.resendRow}>
              <FitText style={s.resendText}>Resend OTP</FitText>
              {resendSeconds > 0 ? (
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
            <FitText style={s.copyright}>(c) 2026 SertFit Gym. All rights reserved.</FitText>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
