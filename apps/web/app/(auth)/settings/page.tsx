"use client";

import { useState } from "react";
import { Bell, FileText, Palette, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FITTRACK_LEGAL_VERSION,
  FITTRACK_PRIVACY_SECTIONS,
  FITTRACK_TERMS_SECTIONS,
  type FitTrackLegalSection,
} from "@fittrack/app-config";

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
import GymProfileSection from "@/components/profile/GymProfileSection";

type SettingsModalKey =
  | "appearance"
  | "notifications"
  | "privacy"
  | "terms"
  | null;

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
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
        <SettingsLaunchCard
          icon={ShieldCheck}
          label="Data Privacy"
          body="Data use, retention, providers, and your Philippine privacy rights."
          onClick={() => onOpen("privacy")}
        />
      </div>
    </FitSection>
  );
}

function LegalModalContent({
  eyebrow,
  sections,
}: {
  eyebrow: string;
  sections: readonly FitTrackLegalSection[];
}) {
  const { colors } = useTheme();

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div
        style={{
          borderBottom: `1px solid ${colors.border}`,
          display: "grid",
          gap: 4,
          padding: "0 0 14px",
        }}
      >
        <FitText
          as="p"
          style={{
            color: colors.brand,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </FitText>
        <FitText
          as="p"
          style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.5 }}
        >
          Policy version {FITTRACK_LEGAL_VERSION}. Plain-language summary for
          FitTrack members, coaches, staff, and administrators.
        </FitText>
      </div>
      {sections.map((section, index) => (
        <div
          key={section.title}
          style={{
            borderBottom:
              index === sections.length - 1
                ? undefined
                : `1px solid ${colors.border}`,
            display: "grid",
            gap: 6,
            padding: "14px 0",
          }}
        >
          <FitText style={{ fontSize: 13.5, fontWeight: 850 }}>
            {section.title}
          </FitText>
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
          {user?.role !== "COACH" ? (
            <FitSection heading="Gym Identity & Hours" headingStyle={{ fontSize: 13 }}>
              <GymProfileSection canEdit={user?.role === "ADMIN"} />
            </FitSection>
          ) : null}
        </div>
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
          <LegalModalContent
            eyebrow="Terms of Service"
            sections={FITTRACK_TERMS_SECTIONS}
          />
        </FitModal>
        <FitModal
          isOpen={activeModal === "privacy"}
          onClose={() => setActiveModal(null)}
          title="Data Privacy Notice"
          subtitle="How SertFit Gym processes FitTrack data and how to exercise your rights."
          icon={ShieldCheck}
          maxWidth={720}
        >
          <LegalModalContent
            eyebrow="Philippine Data Privacy Notice"
            sections={FITTRACK_PRIVACY_SECTIONS}
          />
        </FitModal>
      </FitSection>
    );
  }

  return null;
}
