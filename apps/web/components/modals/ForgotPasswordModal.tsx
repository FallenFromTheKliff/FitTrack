"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/axios";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { modalStyles } from "@/styles/modalStyles";
import type { FieldConfig } from "@/components/modals/DetailsModal";

import { FitText } from "@/components/fit/FitText";
import DetailsModal from "@/components/modals/DetailsModal";
import OTPModal from "@/components/modals/OTPModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Step = "email" | "otp" | "password";

function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }
  if (!("response" in error)) {
    return fallback;
  }
  const response = (error as { response?: { data?: unknown } }).response;
  if (!response || typeof response.data !== "object" || response.data === null) {
    return fallback;
  }
  if (!("message" in response.data)) {
    return fallback;
  }
  const message = (response.data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}

export default function ForgotPasswordModal({ isOpen, onClose }: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const { message, showMessage } = useTimedMessage(2400);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

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
    setIsSubmitting(false);
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
    setIsSubmitting(true);
    try {
      await api.post("/auth/forgot-password", {
        email: data.email?.trim() ?? ""
      });
      setIsSubmitting(false);
      setEmail(data.email?.trim() ?? "");
      showMessage("Verification code sent.");
      setStep("otp");
    } catch (error: unknown) {
      setIsSubmitting(false);
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
    setIsSubmitting(true);
    try {
      const { data: response } = await api.post<{ message?: string }>("/auth/reset-password", {
        token,
        newPassword: data.newPassword ?? ""
      });
      setIsSubmitting(false);
      setSuccessText(response.message ?? "Password reset successful.");
      setTimeout(() => {
        closeModal();
      }, 800);
    } catch (error: unknown) {
      setIsSubmitting(false);
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
