"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useTheme } from "@/contexts/ThemeContext";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { forgotPasswordMutationOptions, resetPasswordMutationOptions } from "@fittrack/query";
import { modalStyles } from "@/styles/modalStyles";
import { webApiClient } from "@/lib/api-client";
import type { ForgotPasswordStep } from "@/data/auth/auth";
import type { FieldConfig } from "@/components/modals/DetailsModal";

import { FitText } from "@/components/fit/FitText";
import DetailsModal from "@/components/modals/DetailsModal";
import OTPModal from "@/components/modals/OTPModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function extractErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export default function ForgotPasswordModal({ isOpen, onClose }: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const { message, showMessage } = useTimedMessage(2400);
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const forgotPasswordMutation = useMutation(forgotPasswordMutationOptions(webApiClient));
  const resetPasswordMutation = useMutation(resetPasswordMutationOptions(webApiClient));
  const isSubmitting = forgotPasswordMutation.isPending || resetPasswordMutation.isPending;

  const sendingLabel = useLoadingText("SENDING CODE", isSubmitting && step === "email");
  const resettingLabel = useLoadingText("RESETTING PASSWORD", isSubmitting && step === "password");

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
    setToken("");
    setPasswordDraft("");
    setPasswordValid(false);
    setErrorText("");
    setSuccessText("");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    resetState();
    onClose();
  };

  const sendCode = async (data: Record<string, string>) => {
    if (isSubmitting) {
      return;
    }
    setErrorText("");
    setSuccessText("");
    try {
      await forgotPasswordMutation.mutateAsync({
        email: data.email?.trim() ?? ""
      });
      setEmail(data.email?.trim() ?? "");
      showMessage("Verification code sent.");
      setStep("otp");
    } catch (error: unknown) {
      setErrorText(extractErrorMessage(error, "Unable to send verification code."));
    }
  };

  const captureOtp = async (code: string) => {
    setToken(code);
    setErrorText("");
    return { success: true };
  };

  const resetPassword = async (data: Record<string, string>) => {
    if (isSubmitting) {
      return;
    }
    if (!token) {
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
        token,
        newPassword: data.newPassword ?? ""
      });
      setSuccessText(response.message ?? "Password reset successful.");
      setTimeout(() => {
        closeModal();
      }, 800);
    } catch (error: unknown) {
      setErrorText(extractErrorMessage(error, "Unable to reset password."));
    }
  };

  return (
    <>
      <DetailsModal
        isOpen={isOpen && step === "email"}
        title="Forgot Password"
        subtitle="Enter your account email and we will send a verification code."
        fields={emailFields}
        initialValues={{ email }}
        onSubmit={sendCode}
        onCancel={closeModal}
        submitLabel={sendingLabel}
        isLoading={isSubmitting}
      >
        {errorText ? (
          <FitText style={s.errorText}>{errorText}</FitText>
        ) : message ? (
          <FitText style={s.hintText}>{message}</FitText>
        ) : null}
      </DetailsModal>
      <OTPModal
        isOpen={isOpen && step === "otp"}
        email={email}
        onVerify={captureOtp}
        onSuccess={() => {
          setStep("password");
          setErrorText("");
          setSuccessText("");
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
        submitLabel={resettingLabel}
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
    </>
  );
}
