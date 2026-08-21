import { AppearancePanel } from "@/components/settings/PreferencesPanel";
import NotificationsPreferencesPanel from "@/components/settings/NotificationsPreferencesPanel";
import { PasswordPanel, PrivacyPanel } from "@/components/settings/SecurityPanel";
import { HelpPanel, TermsPanel } from "@/components/settings/SupportPanel";

import type { PrefKey } from "@/components/modals/settings/SettingsModal";

type SettingsModalContentProps = {
  activePref: PrefKey;
  onClose: () => void;
};

export default function SettingsModalContent({ activePref, onClose }: SettingsModalContentProps) {
  if (activePref === "appearance") return <AppearancePanel onClose={onClose} />;
  if (activePref === "notifications") return <NotificationsPreferencesPanel onClose={onClose} />;
  if (activePref === "password") return <PasswordPanel onClose={onClose} />;
  if (activePref === "privacy") return <PrivacyPanel onClose={onClose} />;
  if (activePref === "help") return <HelpPanel onClose={onClose} />;
  return <TermsPanel onClose={onClose} />;
}
