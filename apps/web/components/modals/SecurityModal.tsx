"use client";
import { useState, useEffect, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { useLoadingText } from "@fittrack/hooks";
import { sleep } from "@/utils/sleep";
import { modalStyles } from "@/styles/modalStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";
import ConfirmModal from "@/components/modals/ConfirmModal";
import PasswordRequirements from "@/components/requirements/PasswordRequirements";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const SAME_PASSWORD_MESSAGE = "Cannot change password to current password.";

export default function SecurityModal({ isOpen, onClose, onSuccess }: Props) {
  const { verifyCurrentPassword, changePassword, logout } = useAuth();
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const submitLabel = useLoadingText("SAVING CHANGES", isSubmitting);
  const logoutLabel = useLoadingText("LOGGING OUT", isLoggingOut);
  const showRequirements = newPassword.length > 0;

  useEffect(() => {
    if (isOpen) setErrors({});
  }, [isOpen]);

  const renderPasswordField = ({
    label,
    id,
    value,
    onChange,
    show,
    onToggle,
    error,
    showLabel,
    hideLabel,
    extra
  }: {
    label: string;
    id: string;
    value: string;
    onChange: (value: string) => void;
    show: boolean;
    onToggle: () => void;
    error?: string;
    showLabel: string;
    hideLabel: string;
    extra?: ReactNode;
  }) => (
    <div style={s.securityFieldWrap}>
      <FitText as="label" htmlFor={id} style={s.fieldLabel}>{label}</FitText>
      <div style={s.securityInputRow(error ? colors.danger : colors.fieldBorder)}>
        <Lock size={15} color={colors.textMuted} />
        <FitTextInput
          id={id}
          aria-label={label}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••"
          style={s.securityInput}
        />
        <FitButton
          variant="link"
          iconOnly
          icon={show ? EyeOff : Eye}
          iconSize={16}
          onClick={onToggle}
          style={s.securityVisibilityToggle}
          aria-label={show ? hideLabel : showLabel}
        />
      </div>
      {extra ?? null}
      {error ? <FitText style={s.securityErrorText}>{error}</FitText> : null}
    </div>
  );

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setErrors({});
    setIsSubmitting(false);
  };

  const resetAndClose = () => {
    resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const nextErrors: Record<string, string> = {};
    const currentPasswordValue = currentPassword.trim();
    const newPasswordValue = newPassword.trim();
    const confirmPasswordValue = confirmNewPassword.trim();
    if (!currentPasswordValue) nextErrors.currentPassword = "Confirm old password is required.";
    if (!newPasswordValue) nextErrors.newPassword = "New password is required.";
    if (!isPasswordValid) nextErrors.newPassword = "New password does not meet requirements.";
    if (!confirmPasswordValue) nextErrors.confirmNewPassword = "Confirm new password is required.";
    if (newPasswordValue && confirmPasswordValue && newPasswordValue !== confirmPasswordValue) {
      nextErrors.confirmNewPassword = "Passwords do not match.";
    }
    if (currentPasswordValue && newPasswordValue && currentPasswordValue === newPasswordValue) {
      nextErrors.newPassword = SAME_PASSWORD_MESSAGE;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (verifyCurrentPassword) {
      const isCurrentPasswordValid = await verifyCurrentPassword(currentPasswordValue);
      if (!isCurrentPasswordValid) {
        setErrors({ currentPassword: "Current password is incorrect." });
        return;
      }
    }
    setIsSubmitting(true);
    if (changePassword) {
      const result = await changePassword(currentPasswordValue, newPasswordValue);
      if (!result.success) {
        setIsSubmitting(false);
        if ((result.error ?? "").includes("current password")) {
          setErrors({ newPassword: SAME_PASSWORD_MESSAGE });
          return;
        }
        setErrors({ currentPassword: result.error ?? "Unable to update password." });
        return;
      }
    }
    await sleep(FEEDBACK_DURATION_MS.standard);
    setIsSubmitting(false);
    resetFields();
    onClose();
    setShowLogoutConfirm(true);
    onSuccess?.();
  };

  const handleLogoutConfirm = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setIsLoggingOut(false);
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <>
      <FitModal
        isOpen={isOpen}
        onClose={resetAndClose}
        title="Change Password"
        iconNode={<KeyRound size={15} color={onBrandTextColor} strokeWidth={2} />}
        maxWidth={560}
        closeAriaLabel="Close change password modal"
        noScroll
        hideFooterDivider
        contentStyle={{ display: "grid", gap: 12 }}
        footer={
          <FitButton
            variant="primary"
            label={isSubmitting ? submitLabel : "SAVE CHANGES"}
            loading={isSubmitting}
            onClick={handleSubmit}
            style={{ flex: 1 }}
          />
        }
      >
        {renderPasswordField({
          label: "Confirm Old Password",
          id: "current-password",
          value: currentPassword,
          onChange: (value) => {
            setCurrentPassword(value);
            if (errors.currentPassword) setErrors((prev) => ({ ...prev, currentPassword: "" }));
          },
          show: showCurrentPassword,
          onToggle: () => setShowCurrentPassword((prev) => !prev),
          error: errors.currentPassword,
          showLabel: "Show current password",
          hideLabel: "Hide current password"
        })}
        {renderPasswordField({
          label: "New Password",
          id: "new-password",
          value: newPassword,
          onChange: (value) => {
            setNewPassword(value);
            if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: "" }));
          },
          show: showNewPassword,
          onToggle: () => setShowNewPassword((prev) => !prev),
          error: errors.newPassword,
          showLabel: "Show new password",
          hideLabel: "Hide new password",
          extra: showRequirements ? <PasswordRequirements password={newPassword} onValidationChange={setIsPasswordValid} /> : undefined
        })}
        {renderPasswordField({
          label: "Confirm New Password",
          id: "confirm-new-password",
          value: confirmNewPassword,
          onChange: (value) => {
            setConfirmNewPassword(value);
            if (errors.confirmNewPassword) setErrors((prev) => ({ ...prev, confirmNewPassword: "" }));
          },
          show: showConfirmNewPassword,
          onToggle: () => setShowConfirmNewPassword((prev) => !prev),
          error: errors.confirmNewPassword,
          showLabel: "Show confirm new password",
          hideLabel: "Hide confirm new password"
        })}
      </FitModal>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Changing Sensitive Info"
        message="Your password has been updated. For account security, you will be logged out and must sign in again."
        confirmLabel={isLoggingOut ? logoutLabel : "SIGN OUT"}
        loadingLabel={logoutLabel}
        loadingTitle="LOGGING OUT"
        isLoading={isLoggingOut}
        isDanger={false}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutConfirm}
      />
    </>
  );
}
