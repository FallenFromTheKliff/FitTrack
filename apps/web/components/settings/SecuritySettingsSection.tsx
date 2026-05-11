"use client";

import { useMemo, useState } from "react";
import { KeyRound, ShieldAlert, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sleep } from "@/utils/sleep";
import FitSection from "@/components/fit/FitSection";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { ConfirmModal, SecurityModal } from "@/components/modals";

export default function SecuritySettingsSection() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, deleteUser, logout } = useAuth();
  const { message, showMessage } = useTimedMessage(2400);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const terminateLabel = useLoadingText("TERMINATING ACCOUNT", isTerminating);

  const helperText = useMemo(() => {
    if (isAdmin) {
      return "Password changes stay here. Primary admin accounts cannot self-terminate from this surface.";
    }
    return "Keep account-sensitive actions in settings while personal and gym details stay on the profile surface.";
  }, [isAdmin]);

  const handleTerminate = async () => {
    if (isTerminating) return;
    setIsTerminating(true);
    showMessage("Terminating account...");
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setIsTerminating(false);
    setShowTerminateConfirm(false);
    if (deleteUser) await deleteUser();
    else await logout();
  };

  return (
    <>
      <FitSection
        heading="Security & Account"
        headingStyle={{ fontSize: 13 }}
        action={<ShieldAlert size={13} color={colors.brand} />}
      >
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <FitText as="p" style={{ fontSize: 13, color: colors.textMuted }}>
            {helperText}
          </FitText>
          {message ? (
            <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>
              {message}
            </FitText>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            <FitButton
              variant="primary"
              label="Change Password"
              icon={KeyRound}
              onClick={() => setShowSecurityModal(true)}
            />
            <FitButton
              variant="ghost"
              label="Open Profile Details"
              onClick={() => router.push("/profile")}
            />
            <FitButton
              variant="danger"
              label={isTerminating ? terminateLabel : "Request Account Termination"}
              icon={UserX}
              loading={isTerminating}
              disabled={isAdmin}
              onClick={() => setShowTerminateConfirm(true)}
            />
          </div>
        </div>
      </FitSection>
      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
      />
      <ConfirmModal
        isOpen={showTerminateConfirm}
        title="Request Account Termination?"
        message="This will permanently delete your account. This action cannot be undone."
        confirmLabel="TERMINATE ACCOUNT"
        loadingLabel={terminateLabel}
        loadingTitle="TERMINATING ACCOUNT"
        isDanger
        isLoading={isTerminating}
        onConfirm={handleTerminate}
        onCancel={() => setShowTerminateConfirm(false)}
      />
    </>
  );
}
