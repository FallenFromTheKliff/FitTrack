"use client";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLoadingText } from "@fittrack/hooks";
import { maskAuthDestination } from "@fittrack/utils";
import { modalStyles } from "@/styles/modalStyles";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";

const OTP_LEN = 6;
const RESEND_SECS = 60;

type Props = {
  isOpen: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
  email?: string;
  neutralMessage?: string;
  resendSeconds?: number;
  initialError?: string;
  onVerify?: (code: string) => Promise<{ success: boolean; error?: string }>;
  onResend?: () => Promise<void>;
  onChangeEmail?: () => void;
};

export default function OTPModal({
  isOpen,
  onSuccess,
  onDismiss,
  email,
  neutralMessage,
  resendSeconds,
  initialError = "",
  onVerify,
  onResend,
  onChangeEmail
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const { verifyOTP } = useAuth();
  const s = modalStyles(colors);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [errorText, setErrorText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [localResendSecs, setLocalResendSecs] = useState(RESEND_SECS);
  const [resending, setResending] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyLabel = useLoadingText("VERIFYING", verifying);
  const isResendControlled = resendSeconds !== undefined;
  const effectiveResendSecs = resendSeconds ?? localResendSecs;

  useEffect(() => {
    if (!isOpen) {
      setDigits(Array(OTP_LEN).fill(""));
      setErrorText("");
      setVerified(false);
      setResending(false);
      if (!isResendControlled) {
        setLocalResendSecs(RESEND_SECS);
      }
      return;
    }
    if (initialError) {
      setErrorText(initialError);
    }
    const focusTimeout = setTimeout(() => refs.current[0]?.focus(), 80);
    return () => clearTimeout(focusTimeout);
  }, [initialError, isOpen, isResendControlled]);

  useEffect(() => {
    if (!isOpen || isResendControlled) {
      return;
    }

    const id = setInterval(() => {
      setLocalResendSecs((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, isResendControlled]);

  const handleChange = (val: string, i: number) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    setErrorText("");
    if (digit && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
    }
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < OTP_LEN) { setErrorText("Enter the 6-digit code."); return; }
    if (verified) return;
    setVerifying(true);
    const verifyFn = onVerify ?? verifyOTP;
    const [result] = await Promise.all([
      verifyFn(code),
      new Promise((r) => setTimeout(r, 2800))
    ]);
    if (result.success) {
      setVerifying(false);
      setVerified(true);
      await new Promise((r) => setTimeout(r, 200));
      onSuccess();
      return;
    }
    setVerifying(false);
    setErrorText(result.error ?? "Invalid code. Try again.");
    setDigits(Array(OTP_LEN).fill(""));
    refs.current[0]?.focus();
  };

  const handleResend = async () => {
    if (effectiveResendSecs > 0 || resending) return;
    setResending(true);
    setDigits(Array(OTP_LEN).fill(""));
    setErrorText("");
    try {
      await onResend?.();
      if (!isResendControlled) {
        setLocalResendSecs(RESEND_SECS);
      }
      refs.current[0]?.focus();
    } catch (error: unknown) {
      setErrorText(
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : "Unable to resend code. Try again."
      );
    } finally {
      setResending(false);
    }
  };

  return (
      <FitModal
          isOpen={isOpen}
          onClose={onDismiss}
          title="Security Verification"
          iconNode={<ShieldCheck size={15} color={onBrandTextColor} strokeWidth={2} />}
          titleStyle={{ fontSize: 14, fontWeight: 600 }}
          maxWidth={400}
          closeAriaLabel="Close"
          noScroll
          closeDisabled={verifying}
          footer={
            <FitButton
                label={verified ? "Verified!" : verifying ? verifyLabel : "VERIFY CODE"}
                variant="primary"
                fullWidth
                loading={verifying}
                disabled={verifying || verified}
                onClick={handleVerify}
            />
          }
      >
        <FitText as="p" style={s.otpInstruction}>
          {neutralMessage ?? (email
              ? `Enter the 6-digit code sent to ${maskAuthDestination(email)}.`
              : "Enter the 6-digit code sent to your registered device.")}
        </FitText>
        <div style={s.otpRow}>
          {digits.map((d, i) => (
              <FitTextInput
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                maxLength={1}
                aria-label={`Verification code digit ${i + 1}`}
                onChange={(e) => handleChange(e.target.value, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                style={s.otpBox(!!d)}
              />
          ))}
        </div>
        {errorText && (
            <div style={s.errorBanner}>
              <FitText style={s.errorBannerText}>{errorText}</FitText>
            </div>
        )}
        <div style={s.otpResendRow}>
          <FitText style={s.otpResendText}>Didn&apos;t receive it?</FitText>
          {effectiveResendSecs > 0 ? (
              <FitText style={s.otpResendText}>Resend in {effectiveResendSecs}s</FitText>
          ) : (
              <FitButton variant="link" onClick={handleResend} disabled={resending} style={s.otpResendBtn}>
                {resending ? "Sending..." : "Resend Code"}
              </FitButton>
          )}
        </div>
        {onChangeEmail ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <FitButton
              variant="link"
              onClick={onChangeEmail}
              disabled={verifying || resending}
              style={s.otpResendBtn}
            >
              Change email
            </FitButton>
          </div>
        ) : null}
      </FitModal>
  );
}
