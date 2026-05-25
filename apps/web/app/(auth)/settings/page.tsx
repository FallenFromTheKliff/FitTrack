"use client";

import { useState, type ReactNode } from "react";
import { Bell, FileText, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { FitModal } from "@/components/modals";
import { useAuth } from "@/contexts/AuthContext";

import AppearanceSettingsSection from "@/components/settings/AppearanceSettingsSection";
import AppFeedbackSettingsSection from "@/components/settings/AppFeedbackSettingsSection";
import FeedbackInboxSection from "@/components/settings/FeedbackInboxSection";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import SecuritySettingsSection from "@/components/settings/SecuritySettingsSection";

type SettingsModalKey = "appearance" | "notifications" | "terms" | null;

function SettingsLaunchCard({
  body,
  icon,
  label,
  onClick,
}: {
  body: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  const { colors } = useTheme();
  const Icon = icon;

  return (
    <FitButton
      variant="card"
      onClick={onClick}
      showTrailing
      style={{
        alignItems: "center",
        borderRadius: 8,
        justifyContent: "flex-start",
        minHeight: 82,
        padding: 14,
        textAlign: "left",
      }}
    >
      <span style={{ alignItems: "center", display: "flex", gap: 12, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            alignItems: "center",
            backgroundColor: `${colors.brand}12`,
            border: `1px solid ${colors.brand}24`,
            borderRadius: 8,
            color: colors.brand,
            display: "inline-flex",
            height: 38,
            justifyContent: "center",
            width: 38,
          }}
        >
          <Icon size={17} />
        </span>
        <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 850 }}>
            {label}
          </FitText>
          <FitText as="span" style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.35 }}>
            {body}
          </FitText>
        </span>
      </span>
    </FitButton>
  );
}

function PreferenceLaunchSection({
  onOpen,
}: {
  onOpen: (key: Exclude<SettingsModalKey, null>) => void;
}) {
  const { colors } = useTheme();

  return (
    <FitSection
      heading="Preferences"
      headingStyle={{ fontSize: 13 }}
      action={<Palette size={13} color={colors.brand} />}
    >
      <div
        className="settings-launch-grid"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          padding: 16,
        }}
      >
        <SettingsLaunchCard
          icon={Palette}
          label="Appearance"
          body="Theme, font, and motion controls."
          onClick={() => onOpen("appearance")}
        />
        <SettingsLaunchCard
          icon={Bell}
          label="Notifications"
          body="Email groups for bookings, payments, and system notices."
          onClick={() => onOpen("notifications")}
        />
        <SettingsLaunchCard
          icon={FileText}
          label="Terms & Conditions"
          body="Policies, agreements, and account responsibilities."
          onClick={() => onOpen("terms")}
        />
      </div>
    </FitSection>
  );
}

function TermsModalContent() {
  const { colors } = useTheme();
  const sections: Array<{ heading: string; body: ReactNode }> = [
    {
      heading: "Account Responsibility",
      body: "FitTrack accounts are tied to the named gym member, coach, staff member, or administrator. Keep credentials private and report suspicious access to SertFit staff.",
    },
    {
      heading: "Bookings And Payments",
      body: "Venue reservations, coach appointments, and membership payments remain subject to staff verification when paid by cash or when a provider callback is still processing.",
    },
    {
      heading: "Health And Training",
      body: "Workout, nutrition, assessment, and AI guidance support gym activity but do not replace professional medical advice or in-person coaching judgment.",
    },
    {
      heading: "Data And Communication",
      body: "FitTrack uses booking, attendance, progress, payment, and feedback records to operate the gym portal and send relevant account notices.",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {sections.map((section) => (
        <div
          key={section.heading}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "grid",
            gap: 6,
            padding: 12,
          }}
        >
          <FitText style={{ fontSize: 13, fontWeight: 850 }}>{section.heading}</FitText>
          <FitText as="p" style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>
            {section.body}
          </FitText>
        </div>
      ))}
    </div>
  );
}

export default function GymSettingsPage() {
  const { user } = useAuth();
  const [activeModal, setActiveModal] = useState<SettingsModalKey>(null);
  const fadeIn = useFadeIn();
  const appearanceFade = useFadeIn({ fromY: 8, duration: 180 });
  const notificationsFade = useFadeIn({ fromY: 16, duration: 260 });
  const supportFade = useFadeIn({ fromY: 20, duration: 300 });
  const themeTransition = useThemeTransition();

  if (user?.role) {
    return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        <div style={appearanceFade}>
          <PreferenceLaunchSection onOpen={setActiveModal} />
        </div>
        <div style={notificationsFade}>
          <SecuritySettingsSection />
        </div>
        <div style={supportFade}>
          <AppFeedbackSettingsSection />
        </div>
        <div style={supportFade}>
          <FeedbackInboxSection />
        </div>
        <style>{`
          @media (max-width: 900px) {
            .settings-theme-grid { grid-template-columns: 1fr !important; }
            .settings-font-grid { grid-template-columns: 1fr !important; }
            .settings-launch-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <FitModal
          isOpen={activeModal === "appearance"}
          onClose={() => setActiveModal(null)}
          title="Appearance"
          subtitle="Adjust theme, font, and motion."
          icon={Palette}
          maxWidth={760}
        >
          <AppearanceSettingsSection />
        </FitModal>
        <FitModal
          isOpen={activeModal === "notifications"}
          onClose={() => setActiveModal(null)}
          title="Notification Preferences"
          subtitle="Choose which account notices are sent by email."
          icon={Bell}
          maxWidth={700}
        >
          <NotificationPreferencesSection />
        </FitModal>
        <FitModal
          isOpen={activeModal === "terms"}
          onClose={() => setActiveModal(null)}
          title="Terms & Conditions"
          subtitle="Review current FitTrack web portal policies."
          icon={FileText}
          maxWidth={680}
        >
          <TermsModalContent />
        </FitModal>
      </FitSection>
    );
  }

  return null;
}
