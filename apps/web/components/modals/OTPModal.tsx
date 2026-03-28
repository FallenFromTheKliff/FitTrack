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
const RESEND_SECS = 30;

type Props = {
  isOpen: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
  email?: string;
  onVerify?: (code: string) => Promise<{ success: boolean; error?: string }>;
  onResend?: () => Promise<void>;
};

export default function OTPModal({ isOpen, onSuccess, onDismiss, email, onVerify, onResend }: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const { verifyOTP } = useAuth();
  const s = modalStyles(colors);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [errorText, setErrorText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendSecs, setResendSecs] = useState(RESEND_SECS);
  const [resending, setResending] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyLabel = useLoadingText("VERIFYING", verifying);

  useEffect(() => {
    if (!isOpen) {
      setDigits(Array(OTP_LEN).fill(""));
      setErrorText("");
      setVerified(false);
      setResendSecs(RESEND_SECS);
      return;
    }
    const id = setInterval(() => setResendSecs((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    setTimeout(() => refs.current[0]?.focus(), 80);
    return () => clearInterval(id);
  }, [isOpen]);

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
    if (resendSecs > 0 || resending) return;
    setResending(true);
    setDigits(Array(OTP_LEN).fill(""));
    setErrorText("");
    if (onResend) await onResend();
    setResendSecs(RESEND_SECS);
    setResending(false);
    refs.current[0]?.focus();
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
      >
        <FitText as="p" style={s.otpInstruction}>
          {email
              ? `Enter the 6-digit code sent to ${maskAuthDestination(email)}.`
              : "Enter the 6-digit code sent to your registered device."}
        </FitText>
        <div style={s.otpRow}>
          {digits.map((d, i) => (
              <FitTextInput
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                maxLength={1}
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
        <FitButton
            label={verified ? "Verified!" : verifying ? verifyLabel : errorText || "VERIFY CODE"}
            variant="primary"
            fullWidth
            loading={verifying}
            disabled={verifying || verified}
            onClick={handleVerify}
        />
        <div style={s.otpResendRow}>
          <FitText style={s.otpResendText}>Didn&apos;t receive it?</FitText>
          {resendSecs > 0 ? (
              <FitText style={s.otpResendText}>Resend in {resendSecs}s</FitText>
          ) : (
              <FitButton variant="link" onClick={handleResend} disabled={resending} style={s.otpResendBtn}>
                {resending ? "Sending..." : "Resend Code"}
              </FitButton>
          )}
        </div>
      </FitModal>
  );
}
