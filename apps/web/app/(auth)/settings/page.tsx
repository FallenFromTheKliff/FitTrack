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
      className="settings-launch-card"
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
      <span
        className="settings-launch-card-content"
        style={{
          alignItems: "center",
          display: "flex",
          flex: "1 1 auto",
          gap: 12,
          minWidth: 0,
          width: "100%",
        }}
      >
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
        <span
          className="settings-launch-card-copy"
          style={{ display: "grid", flex: "1 1 auto", gap: 4, minWidth: 0 }}
        >
          <FitText
            className="settings-launch-card-label"
            style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 850 }}
          >
            {label}
          </FitText>
          <FitText
            as="span"
            className="settings-launch-card-body"
            style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.35 }}
          >
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
  const canViewGymProfile = user?.role === "ADMIN" || user?.role === "STAFF";
  const fadeIn = useFadeIn();
  const appearanceFade = useFadeIn({ fromY: 8, duration: 180 });
  const notificationsFade = useFadeIn({ fromY: 16, duration: 260 });
  const supportFade = useFadeIn({ fromY: 20, duration: 300 });
  const themeTransition = useThemeTransition();

  if (user?.role) {
    return (
      <FitSection
        as="section"
        heading=""
        hideHeading
        bare
        noPadding
        className={`settings-page ${themeTransition}`}
        style={fadeIn}
      >
        {canViewGymProfile ? (
          <div className="settings-gym-section" style={appearanceFade}>
            <FitSection heading="Gym Identity & Hours" headingStyle={{ fontSize: 13 }}>
              <GymProfileSection canEdit={user?.role === "ADMIN"} />
            </FitSection>
          </div>
        ) : null}
        <div className="settings-preferences-section" style={appearanceFade}>
          <PreferenceLaunchSection onOpen={setActiveModal} />
        </div>
        <div className="settings-security-section" style={notificationsFade}>
          <SecuritySettingsSection />
        </div>
        <div className="settings-support-section" style={supportFade}>
          <AppFeedbackSettingsSection />
        </div>
        <div className="settings-feedback-inbox-section" style={supportFade}>
          <FeedbackInboxSection />
        </div>
        <style>{`
          .settings-page {
            max-width: 100%;
            min-width: 0;
            width: 100%;
          }

          .settings-page > div,
          .settings-page > div > section {
            max-width: 100%;
            min-width: 0;
          }

          .settings-launch-grid,
          .settings-launch-card,
          .settings-launch-card-content,
          .settings-launch-card-copy {
            min-width: 0;
          }

          .settings-launch-card-content {
            flex: 1 1 auto;
            max-width: 100%;
            width: 100%;
          }

          .settings-launch-card-copy {
            flex: 1 1 auto;
            max-width: 100%;
          }

          .settings-launch-card-label,
          .settings-launch-card-body {
            display: block;
            max-width: 100%;
            min-width: 0;
            overflow-wrap: anywhere;
            white-space: normal;
          }

          .settings-launch-card > svg {
            flex: 0 0 auto;
          }

          @media (max-width: 900px) {
            .settings-theme-grid { grid-template-columns: 1fr !important; }
            .settings-font-grid { grid-template-columns: 1fr !important; }
            .settings-launch-grid { grid-template-columns: 1fr !important; }
          }

          @media (max-width: 640px) {
            .settings-page > div,
            .settings-page > div > section {
              width: 100%;
            }

            .settings-launch-grid {
              padding: 12px !important;
            }

            .settings-launch-card {
              padding: 12px !important;
            }

            .settings-launch-card-content {
              gap: 10px;
            }

            .settings-page h4 {
              font-size: 13px !important;
              line-height: 1.2 !important;
              max-width: 100%;
              overflow-wrap: anywhere;
            }

            .settings-page p {
              font-size: 12px !important;
              line-height: 1.4 !important;
              max-width: 100%;
              overflow-wrap: anywhere;
            }

            .settings-page button {
              font-size: 13px !important;
              line-height: 1.25 !important;
              min-height: 44px !important;
              min-width: 0;
              max-width: 100%;
            }

            .settings-page button > span {
              font-size: 13px !important;
              line-height: 1.25 !important;
              max-width: 100%;
              min-width: 0;
              overflow-wrap: anywhere;
              white-space: normal !important;
            }

            .settings-page label {
              font-size: 12px !important;
              line-height: 1.3 !important;
              max-width: 100%;
              overflow-wrap: anywhere;
            }

            .settings-page input,
            .settings-page textarea {
              font-size: 13px !important;
              line-height: 1.4 !important;
              max-width: 100%;
              min-width: 0;
            }

            .settings-page [role="switch"] {
              min-height: 44px !important;
            }

            .settings-page > div span {
              max-width: 100%;
              min-width: 0;
              overflow-wrap: anywhere;
            }

            .settings-launch-card-label {
              font-size: 14px !important;
              line-height: 1.2 !important;
            }

            .settings-launch-card-body {
              font-size: 12px !important;
              line-height: 1.35 !important;
            }

            .settings-feedback-inbox-section > div > div > span:first-child {
              font-size: 15px !important;
              line-height: 1.25 !important;
            }

            .settings-feedback-inbox-section > div > div > div > div > span {
              font-size: 13px !important;
              line-height: 1.25 !important;
            }

            .settings-feedback-inbox-section > div > div > span:nth-child(2),
            .settings-feedback-inbox-section > div > div > div span {
              font-size: 12px !important;
              line-height: 1.35 !important;
            }

            .settings-feedback-inbox-section > div > div > span:first-child {
              font-size: 15px !important;
              line-height: 1.25 !important;
            }
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
