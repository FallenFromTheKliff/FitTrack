"use client";

import { useMemo, useState } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import FitSection from "@/components/fit/FitSection";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { SecurityModal } from "@/components/modals";

export default function SecuritySettingsSection() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  const helperText = useMemo(() => {
    if (isAdmin) {
      return "Password changes and profile security stay here. Sensitive account lifecycle requests are handled through staff support.";
    }
    return "Keep account-sensitive actions in settings while personal details stay on the profile surface.";
  }, [isAdmin]);

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
          </div>
        </div>
      </FitSection>
      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
      />
    </>
  );
}
