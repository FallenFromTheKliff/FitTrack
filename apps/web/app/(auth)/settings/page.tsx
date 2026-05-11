"use client";

import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import FitSection from "@/components/fit/FitSection";
import { useAuth } from "@/contexts/AuthContext";

import AppearanceSettingsSection from "@/components/settings/AppearanceSettingsSection";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import SecuritySettingsSection from "@/components/settings/SecuritySettingsSection";

export default function GymSettingsPage() {
  const { user } = useAuth();
  const fadeIn = useFadeIn();
  const appearanceFade = useFadeIn({ fromY: 8, duration: 180 });
  const detailsFade = useFadeIn({ fromY: 12, duration: 220 });
  const notificationsFade = useFadeIn({ fromY: 16, duration: 260 });
  const themeTransition = useThemeTransition();

  if (user?.role) {
    return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        <div style={appearanceFade}>
          <AppearanceSettingsSection />
        </div>
        <div style={detailsFade}>
          <NotificationPreferencesSection />
        </div>
        <div style={notificationsFade}>
          <SecuritySettingsSection />
        </div>
        <style>{`
          @media (max-width: 900px) {
            .settings-theme-grid { grid-template-columns: 1fr !important; }
            .settings-font-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </FitSection>
    );
  }

  return null;
}
