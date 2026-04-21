import { View } from "react-native";

import { PREF_META } from "@/data/settings";
import { makeSettingsStyles } from "@/styles/shared/ScreenStyles";
import { AnimatedFitText } from "@/components/fit/FitText";
import FitCard from "@/components/fit/FitCard";
import FitSection from "@/components/fit/FitSection";

import type { PrefKey } from "@/components/modals/settings/SettingsModal";

type SettingsSectionsProps = {
  footerTextStyle: object;
  onSelect: (key: PrefKey) => void;
  styles: ReturnType<typeof makeSettingsStyles>;
};

export default function SettingsSections({ footerTextStyle, onSelect, styles }: SettingsSectionsProps) {
  return (
    <>
      <FitSection heading="PREFERENCES">
        <FitCard
          icon={PREF_META.notifications.icon}
          label="Notifications"
          subtitle="Push notifications, email alerts"
          hasBorder
          onPress={() => onSelect("notifications")}
        />
        <FitCard
          icon={PREF_META.appearance.icon}
          label="Appearance"
          subtitle="Theme, font, and animations"
          hasBorder
          onPress={() => onSelect("appearance")}
        />
      </FitSection>
      <FitSection heading="SECURITY">
        <FitCard
          icon={PREF_META.password.icon}
          label="Change Password"
          subtitle="Update your password"
          hasBorder
          onPress={() => onSelect("password")}
        />
        <FitCard
          icon={PREF_META.privacy.icon}
          label="Privacy Settings"
          subtitle="Manage your data"
          onPress={() => onSelect("privacy")}
        />
      </FitSection>
      <FitSection heading="SUPPORT">
        <FitCard
          icon={PREF_META.help.icon}
          label="Help Center"
          subtitle="FAQs and support"
          hasBorder
          onPress={() => onSelect("help")}
        />
        <FitCard
          icon={PREF_META.terms.icon}
          label="Terms & Conditions"
          subtitle="Read our policies"
          onPress={() => onSelect("terms")}
        />
      </FitSection>
      <View style={styles.footer}>
        <AnimatedFitText style={[styles.footerText, footerTextStyle]}>FitTrack Version 1.0.0</AnimatedFitText>
        <AnimatedFitText style={[styles.footerText, footerTextStyle]}>(c) 2026 SertFit Gym</AnimatedFitText>
      </View>
    </>
  );
}
