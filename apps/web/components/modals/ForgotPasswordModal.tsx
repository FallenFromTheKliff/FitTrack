"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useTheme } from "@/contexts/ThemeContext";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { maskAuthDestination } from "@fittrack/utils";
import {
  forgotPasswordMutationOptions,
  resetPasswordMutationOptions,
  verifyResetOtpMutationOptions
} from "@fittrack/query";
import { modalStyles } from "@/styles/modalStyles";
import { webApiClient } from "@/lib/api-client";
import { ApiClientError } from "@fittrack/api-client";
import type { ForgotPasswordStep } from "@/data/auth/auth";
import type { FieldConfig } from "@/components/modals/DetailsModal";

import { FitText } from "@/components/fit/FitText";
import ConfirmModal from "@/components/modals/ConfirmModal";
import DetailsModal from "@/components/modals/DetailsModal";
import OTPModal from "@/components/modals/OTPModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  portal?: "team" | "member";
};

function extractErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

const SAME_PASSWORD_MESSAGE = "Cannot change password to current password.";
const RESET_REQUEST_MESSAGE = "If an account matches, we'll send a verification code there.";
const RESET_REQUEST_COOLDOWN_MS = 60_000;
const RESET_REQUEST_COOLDOWN_STORAGE_KEY = "fittrack:forgot-password:resend-deadline";

function readResetRequestDeadline() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const deadline = Number(window.sessionStorage.getItem(RESET_REQUEST_COOLDOWN_STORAGE_KEY));
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      window.sessionStorage.removeItem(RESET_REQUEST_COOLDOWN_STORAGE_KEY);
      return 0;
    }
    return deadline;
  } catch {
    return 0;
  }
}

function persistResetRequestDeadline(deadline: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(RESET_REQUEST_COOLDOWN_STORAGE_KEY, String(deadline));
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function clearResetRequestDeadline() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(RESET_REQUEST_COOLDOWN_STORAGE_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function shouldBounceBackToOtp(error: unknown) {
  const message = extractErrorMessage(error, "");
  if (!message || message === SAME_PASSWORD_MESSAGE) {
    return false;
  }

  if (
    /(?:otp|verification code|code).*(?:invalid|expired|used)|(?:invalid|expired|used).*(?:otp|verification code|code)/i.test(
      message
    )
  ) {
    return true;
  }

  return error instanceof ApiClientError && typeof error.status === "number" && error.status < 500;
}

export default function ForgotPasswordModal({ isOpen, onClose, portal }: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const { message, showMessage } = useTimedMessage(2400);
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isSendConfirmationOpen, setIsSendConfirmationOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const sendInFlightRef = useRef(false);
  const forgotPasswordMutation = useMutation(forgotPasswordMutationOptions(webApiClient));
  const verifyResetOtpMutation = useMutation(verifyResetOtpMutationOptions(webApiClient));
  const resetPasswordMutation = useMutation(resetPasswordMutationOptions(webApiClient));
  const isSubmitting =
    forgotPasswordMutation.isPending ||
    verifyResetOtpMutation.isPending ||
    resetPasswordMutation.isPending;

  const sendingLabel = useLoadingText("SENDING CODE", forgotPasswordMutation.isPending);
  const resettingLabel = useLoadingText("RESETTING PASSWORD", resetPasswordMutation.isPending);

  const startResendCooldown = useCallback(() => {
    const deadline = Date.now() + RESET_REQUEST_COOLDOWN_MS;
    persistResetRequestDeadline(deadline);
    setResendAvailableAt(deadline);
  }, []);

  const emailFields = useMemo<FieldConfig[]>(() => [
    {
      name: "email",
      label: "Email Address",
      type: "email",
      required: true,
      placeholder: "you@example.com"
    }
  ], []);

  const passwordFields = useMemo<FieldConfig[]>(() => [
    {
      name: "newPassword",
      label: "New Password",
      type: "password",
      required: true,
      placeholder: "Enter your new password"
    }
  ], []);

  const resetState = useCallback(() => {
    setStep("email");
    setEmail("");
    setCode("");
    setPasswordDraft("");
    setPasswordValid(false);
    setErrorText("");
    setSuccessText("");
    setIsSendConfirmationOpen(false);
    setConfirmationEmail("");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    setResendAvailableAt(readResetRequestDeadline());
  }, []);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendSeconds(remaining);
      if (remaining === 0) {
        clearResetRequestDeadline();
        setResendAvailableAt(0);
      }
    };

    updateRemaining();
    const id = setInterval(updateRemaining, 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt]);

  const closeModal = () => {
    const isInitialRequestPending = step === "email" && (
      forgotPasswordMutation.isPending || sendInFlightRef.current
    );
    if (verifyResetOtpMutation.isPending || resetPasswordMutation.isPending || isInitialRequestPending) {
      return;
    }
    resetState();
    onClose();
  };

  const sendCode = (data: Record<string, string>) => {
    if (isSubmitting || isSendConfirmationOpen || sendInFlightRef.current) {
      return;
    }
    if (resendSeconds > 0) {
      setErrorText(`Please wait ${resendSeconds}s before requesting another OTP.`);
      return;
    }
    setErrorText("");
    setSuccessText("");
    const nextEmail = data.email?.trim() ?? "";
    if (!nextEmail) {
      return;
    }
    setEmail(nextEmail);
    setConfirmationEmail(nextEmail);
    setIsSendConfirmationOpen(true);
  };

  const cancelSendConfirmation = () => {
    if (isSubmitting || sendInFlightRef.current) {
      return;
    }
    setIsSendConfirmationOpen(false);
    setConfirmationEmail("");
  };

  const confirmSendCode = async () => {
    const requestedEmail = confirmationEmail.trim();
    if (!requestedEmail || isSubmitting || sendInFlightRef.current) {
      return;
    }

    sendInFlightRef.current = true;
    try {
      await forgotPasswordMutation.mutateAsync({
        email: requestedEmail,
        portal
      });
      startResendCooldown();
      setEmail(requestedEmail);
      setConfirmationEmail("");
      setIsSendConfirmationOpen(false);
      showMessage(RESET_REQUEST_MESSAGE);
      setStep("otp");
    } catch {
      setIsSendConfirmationOpen(false);
      setConfirmationEmail("");
      setErrorText("Unable to start account recovery. Please try again.");
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const resendCode = async () => {
    if (resendSeconds > 0 || forgotPasswordMutation.isPending || sendInFlightRef.current) {
      return;
    }
    sendInFlightRef.current = true;
    try {
      await forgotPasswordMutation.mutateAsync({
        email,
        portal
      });
      startResendCooldown();
      showMessage(RESET_REQUEST_MESSAGE);
    } catch {
      throw new Error("Unable to resend code. Try again.");
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const captureOtp = async (nextCode: string) => {
    setErrorText("");
    const trimmedCode = nextCode.trim();

    try {
      const verification = await verifyResetOtpMutation.mutateAsync({
        email,
        code: trimmedCode,
        portal
      });
      if (verification.verified === false) {
        return {
          success: false,
          error: "Invalid code. Try again."
        };
      }
      setCode(trimmedCode);
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: extractErrorMessage(error, "Invalid code. Try again.")
      };
    }
  };

  const resetPassword = async (data: Record<string, string>) => {
    if (isSubmitting) {
      return;
    }
    if (!code) {
      setErrorText("Verification code is missing.");
      setStep("otp");
      return;
    }
    if (!passwordValid) {
      setErrorText("Your password does not meet the requirements.");
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      const response = await resetPasswordMutation.mutateAsync({
        email,
        code,
        new_password: data.newPassword ?? "",
        portal
      });
      setSuccessText(response.message ?? "Password reset successful.");
      setTimeout(() => {
        closeModal();
      }, 800);
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error, "Unable to reset password.");
      if (shouldBounceBackToOtp(error)) {
        setCode("");
        setStep("otp");
        setErrorText(errorMessage);
        return;
      }
      setErrorText(errorMessage);
    }
  };

  return (
    <>
      <DetailsModal
        isOpen={isOpen && step === "email"}
        title="Forgot Password"
        subtitle="Enter your email. We'll send a verification code if an account matches."
        fields={emailFields}
        initialValues={{ email }}
        onSubmit={sendCode}
        onCancel={closeModal}
        submitLabel={
          resendSeconds > 0
            ? `WAIT ${resendSeconds}S`
            : forgotPasswordMutation.isPending
              ? sendingLabel
              : "SEND CODE"
        }
        isLoading={isSubmitting}
        submitDisabled={resendSeconds > 0}
      >
        {resendSeconds > 0 ? (
          <FitText style={s.hintText}>
            Please wait {resendSeconds}s before requesting another OTP.
          </FitText>
        ) : errorText ? (
          <FitText style={s.errorText}>{errorText}</FitText>
        ) : message ? (
          <FitText style={s.hintText}>{message}</FitText>
        ) : null}
      </DetailsModal>
      <OTPModal
        isOpen={isOpen && step === "otp"}
        email={email}
        resendSeconds={resendSeconds}
        initialError={step === "otp" ? errorText : ""}
        onVerify={captureOtp}
        onResend={resendCode}
        onSuccess={() => {
          setStep("password");
          setErrorText("");
          setSuccessText("");
        }}
        onChangeEmail={() => {
          setErrorText("");
          setCode("");
          setConfirmationEmail("");
          setStep("email");
        }}
        onDismiss={closeModal}
      />
      <DetailsModal
        isOpen={isOpen && step === "password"}
        title="Reset Password"
        subtitle="Create a new password to finish account recovery."
        fields={passwordFields}
        initialValues={{ newPassword: passwordDraft }}
        onChange={(values) => setPasswordDraft(values.newPassword ?? "")}
        onSubmit={resetPassword}
        onCancel={closeModal}
        submitLabel={resetPasswordMutation.isPending ? resettingLabel : "RESET PASSWORD"}
        isLoading={isSubmitting}
      >
        <PasswordRequirements
          password={passwordDraft}
          onValidationChange={setPasswordValid}
        />
        {errorText ? (
          <FitText style={s.errorText}>{errorText}</FitText>
        ) : successText ? (
          <FitText style={{ ...s.hintText, color: colors.success }}>{successText}</FitText>
        ) : message ? (
          <FitText style={s.hintText}>{message}</FitText>
        ) : null}
      </DetailsModal>
      <ConfirmModal
        isOpen={isOpen && isSendConfirmationOpen}
        title="Send verification code?"
        message={`We'll send a verification code to ${maskAuthDestination(confirmationEmail)} if an account matches.`}
        onConfirm={() => void confirmSendCode()}
        onCancel={cancelSendConfirmation}
        cancelLabel="Cancel"
        confirmLabel={forgotPasswordMutation.isPending ? sendingLabel : "Confirm"}
        loadingLabel="Sending code"
        loadingTitle="Sending verification code"
        isLoading={forgotPasswordMutation.isPending}
      />
    </>
  );
}
