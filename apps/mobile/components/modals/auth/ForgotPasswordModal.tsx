import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { KeyRound, Lock, Mail } from "lucide-react-native";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  forgotPasswordMutationOptions,
  resetPasswordMutationOptions,
  verifyResetOtpMutationOptions
} from "@fittrack/query";
import { toApiClientError } from "@fittrack/api-client";

import { useTheme, useFontFamily } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { makeForgotPasswordStyles } from "@/styles/modals/ForgotPasswordStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

type Props = {
  isVisible: boolean;
  onClose: () => void;
};

type EmailForm = {
  email: string;
};

type ResetForm = {
  newPassword: string;
};

type Step = "email" | "otp" | "password";

const OTP_LENGTH = 6;
const RESET_OTP_ERROR_TYPES = new Set([
  "INVALID_OTP",
  "OTP_EXPIRED",
  "OTP_ALREADY_USED",
  "OTP_LOCKED",
  "NOT_FOUND"
]);

function extractErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

function isResetOtpFailure(error: unknown) {
  const apiError = toApiClientError(error, "Could not reset password. Please try again.");
  const details = apiError.details;
  const type = details && typeof details === "object" && typeof (details as { type?: unknown }).type === "string"
    ? (details as { type: string }).type
    : undefined;
  return {
    apiError,
    shouldReturnToOtp: type !== undefined && RESET_OTP_ERROR_TYPES.has(type)
  };
}

export default function ForgotPasswordModal({ isVisible, onClose }: Props) {
  const { colors } = useTheme();
  const fontFamily = useFontFamily();
  const s = useMemo(() => makeForgotPasswordStyles(colors), [colors]);
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const { message, showMessage } = useTimedMessage(2200);
  const [step, setStep] = useState<Step>("email");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [code, setCode] = useState("");
  const [canResetPassword, setCanResetPassword] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const emailForm = useForm<EmailForm>({
    defaultValues: { email: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  const resetForm = useForm<ResetForm>({
    defaultValues: { newPassword: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  const forgotPasswordMutation = useMutation(forgotPasswordMutationOptions(mobileApiClient));
  const verifyResetOtpMutation = useMutation(verifyResetOtpMutationOptions(mobileApiClient));
  const resetPasswordMutation = useMutation(resetPasswordMutationOptions(mobileApiClient));
  const isSending = forgotPasswordMutation.isPending;
  const isVerifyingOtp = verifyResetOtpMutation.isPending;
  const isResetting = resetPasswordMutation.isPending;

  const sendingLabel = useLoadingText("SENDING CODE", isSending);
  const verifyingLabel = useLoadingText("VERIFYING OTP", isVerifyingOtp);
  const resettingLabel = useLoadingText("RESETTING PASSWORD", isResetting);
  const passwordValue = resetForm.watch("newPassword");

  const clearState = useCallback(() => {
    setStep("email");
    setDigits(Array(OTP_LENGTH).fill(""));
    setCode("");
    setCanResetPassword(false);
    setErrorText("");
    setSuccessText("");
    emailForm.reset({ email: "" });
    resetForm.reset({ newPassword: "" });
  }, [emailForm, resetForm]);

  useEffect(() => {
    if (!isVisible) {
      clearState();
      return;
    }
    setTimeout(() => inputRefs.current[0]?.focus(), 150);
  }, [clearState, isVisible]);

  useEffect(() => {
    if (isVisible && step === "otp") {
      setTimeout(() => inputRefs.current[0]?.focus(), 120);
    }
  }, [isVisible, step]);

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  const title = step === "email" ? "Forgot Password" : step === "otp" ? "Enter Verification Code" : "Set New Password";
  const subtitle = step === "email"
    ? "Enter your account email and we will send a reset code."
    : step === "otp"
      ? "Enter the 6-digit code from your email."
      : "Create your new password to finish resetting your account.";

  const busy = isSending || isVerifyingOtp || isResetting;
  const otpCode = digits.join("");
  const otpComplete = otpCode.length === OTP_LENGTH;

  const handleClose = () => {
    if (busy) {
      return;
    }
    clearState();
    onClose();
  };

  const submitEmail = emailForm.handleSubmit(async (values) => {
    setErrorText("");
    setSuccessText("");
    try {
      await forgotPasswordMutation.mutateAsync({
        email: values.email.trim()
      });
      showMessage("Code sent. Check your email.");
      setStep("otp");
      setDigits(Array(OTP_LENGTH).fill(""));
    } catch (error: unknown) {
      setErrorText(extractErrorMessage(error, "Could not send code. Please try again."));
    }
  });

  const continueToPassword = async () => {
    if (!otpComplete) {
      setErrorText("Enter all 6 digits.");
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      const verified = await verifyResetOtpMutation.mutateAsync({
        email: emailForm.getValues("email").trim(),
        code: otpCode
      });
      if (verified.verified === false) {
        setErrorText("Invalid OTP.");
        return;
      }
      setCode(otpCode);
      setCanResetPassword(false);
      setStep("password");
    } catch (error: unknown) {
      const apiError = toApiClientError(error, "Invalid OTP.");
      setCode("");
      setDigits(Array(OTP_LENGTH).fill(""));
      setCanResetPassword(false);
      setStep("otp");
      setErrorText(apiError.message);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setErrorText("");
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBackspace = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitReset = resetForm.handleSubmit(async (values) => {
    if (!code) {
      setErrorText("Enter the verification code first.");
      setStep("otp");
      return;
    }
    if (!canResetPassword) {
      setErrorText("Your password does not meet the requirements.");
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      const data = await resetPasswordMutation.mutateAsync({
        email: emailForm.getValues("email").trim(),
        code,
        new_password: values.newPassword
      });
      setSuccessText(data.message || "Password reset successful.");
      setTimeout(() => {
        clearState();
        onClose();
      }, 900);
    } catch (error: unknown) {
      const { apiError, shouldReturnToOtp } = isResetOtpFailure(error);
      if (shouldReturnToOtp) {
        setStep("otp");
        setDigits(Array(OTP_LENGTH).fill(""));
        setCode("");
        setCanResetPassword(false);
        resetForm.reset({ newPassword: "" });
      }
      setErrorText(apiError.message || extractErrorMessage(error, "Could not reset password. Please try again."));
    }
  });

  const leftAction = step === "email"
    ? handleClose
    : () => {
      if (busy) {
        return;
      }
      setErrorText("");
      setSuccessText("");
      setStep(step === "password" ? "otp" : "email");
    };

  const rightAction = step === "email"
    ? submitEmail
    : step === "otp"
      ? continueToPassword
      : submitReset;

  const rightLabel = step === "email"
    ? (isSending ? sendingLabel : "SEND CODE")
    : step === "otp"
      ? (isVerifyingOtp ? verifyingLabel : "CONTINUE")
      : (isResetting ? resettingLabel : "RESET PASSWORD");

  const rightDisabled = step === "email"
    ? isSending
    : step === "otp"
      ? !otpComplete || isVerifyingOtp
      : (isResetting || !canResetPassword);

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={undefined}
    >
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
            <View style={s.header}>
              <View style={s.iconCircle}>
                <KeyRound size={20} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
              </View>
              <FitText style={s.title}>{title}</FitText>
              <FitText style={s.subtitle}>{subtitle}</FitText>
            </View>
            <View style={s.body}>
              {step === "email" ? (
                <FitInputField
                  control={emailForm.control}
                  name="email"
                  label="Email"
                  placeholder="your.email@example.com"
                  errors={emailForm.formState.errors}
                  icon={Mail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!busy}
                  rules={{
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address"
                    }
                  }}
                />
              ) : step === "otp" ? (
                <View>
                  <View style={s.otpRow}>
                    {digits.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => {
                          inputRefs.current[index] = ref;
                        }}
                        value={digit}
                        maxLength={1}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        caretHidden
                        onChangeText={(value) => handleOtpChange(value, index)}
                        onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, index)}
                        style={[s.otpInput, digit ? s.otpInputFilled : undefined, { fontFamily }]}
                      />
                    ))}
                  </View>
                  <FitText style={s.helperText}>Need a new code? Go back and send it again.</FitText>
                </View>
              ) : (
                <View style={s.passwordBox}>
                  <FitInputField
                    control={resetForm.control}
                    name="newPassword"
                    label="New Password"
                    placeholder="Enter your new password"
                    errors={resetForm.formState.errors}
                    icon={Lock}
                    secureTextEntry
                    editable={!busy}
                    rules={{
                      required: "New password is required"
                    }}
                  />
                  <PasswordRequirements
                    password={passwordValue ?? ""}
                    onValidationChange={setCanResetPassword}
                  />
                </View>
              )}
              {errorText ? (
                <FitText style={s.errorText}>{errorText}</FitText>
              ) : successText ? (
                <FitText style={s.successText}>{successText}</FitText>
              ) : message ? (
                <FitText style={s.successText}>{message}</FitText>
              ) : null}
            </View>
            <View style={s.footer}>
              <FitButton
                label={step === "email" ? "CANCEL" : "BACK"}
                variant="ghost"
                onPress={leftAction}
                disabled={busy}
                style={s.buttonFlex}
              />
              <FitButton
                label={rightLabel}
                variant="primary"
                onPress={rightAction}
                disabled={rightDisabled}
                loading={isSending || isVerifyingOtp || isResetting}
                style={s.buttonFlex}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
