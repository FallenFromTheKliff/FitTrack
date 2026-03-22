import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { makeScreenStyles, makeSettingsStyles } from "@/styles/shared/ScreenStyles";
import { PREF_META } from "@/data/settings";

import { AnimatedFitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import SettingsModal, { type PrefKey } from "@/components/modals/settings/SettingsModal";
import { AppearancePanel, NotificationsPanel } from "@/components/settings/PreferencesPanel";
import { PasswordPanel, PrivacyPanel } from "@/components/settings/SecurityPanel";
import { HelpPanel, TermsPanel } from "@/components/settings/SupportPanel";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { baseStyle, textMutedStyle } = useThemeTransition();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeSettingsStyles(colors), [colors]);
  const [activePref, setActivePref] = useState<PrefKey | null>(null);

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const activeMeta = activePref ? PREF_META[activePref] : null;
  const closeModal = () => setActivePref(null);

  return (
      <Animated.View style={[base.screen, baseStyle]}>
        <Animated.ScrollView
            style={[base.content, screenStyle]}
            contentContainerStyle={base.scrollContent}
            showsVerticalScrollIndicator={false}
        >
          <Animated.View style={contentStyle}>
            <FitSection heading="PREFERENCES">
              <FitCard
                icon={PREF_META.notifications.icon}
                  label="Notifications"
                  subtitle="Push notifications, email alerts"
                  hasBorder
                  onPress={() => setActivePref("notifications")}
              />
              <FitCard
                icon={PREF_META.appearance.icon}
                  label="Appearance"
                  subtitle="Theme, font, and animations"
                  hasBorder
                  onPress={() => setActivePref("appearance")}
              />
            </FitSection>
            <FitSection heading="SECURITY">
              <FitCard
                icon={PREF_META.password.icon}
                  label="Change Password"
                  subtitle="Update your password"
                  hasBorder
                  onPress={() => setActivePref("password")}
              />
              <FitCard
                icon={PREF_META.privacy.icon}
                  label="Privacy Settings"
                  subtitle="Manage your data"
                  onPress={() => setActivePref("privacy")}
              />
            </FitSection>
            <FitSection heading="SUPPORT">
              <FitCard
                icon={PREF_META.help.icon}
                  label="Help Center"
                  subtitle="FAQs and support"
                  hasBorder
                  onPress={() => setActivePref("help")}
              />
              <FitCard
                icon={PREF_META.terms.icon}
                  label="Terms & Conditions"
                  subtitle="Read our policies"
                  onPress={() => setActivePref("terms")}
              />
            </FitSection>
            <View style={s.footer}>
              <AnimatedFitText style={[s.footerText, textMutedStyle]}>FitTrack Version 1.0.0</AnimatedFitText>
              <AnimatedFitText style={[s.footerText, textMutedStyle]}>© 2026 SertFit Gym</AnimatedFitText>
            </View>
          </Animated.View>
        </Animated.ScrollView>
        {activeMeta && (
            <SettingsModal
                visible={activePref !== null}
                title={activeMeta.title}
                icon={activeMeta.icon}
                onClose={closeModal}
            >
              {activePref === "appearance" && <AppearancePanel onClose={closeModal} />}
              {activePref === "notifications" && <NotificationsPanel onClose={closeModal} />}
              {activePref === "password" && <PasswordPanel onClose={closeModal} />}
              {activePref === "privacy" && <PrivacyPanel onClose={closeModal} />}
              {activePref === "help" && <HelpPanel onClose={closeModal} />}
              {activePref === "terms" && <TermsPanel onClose={closeModal} />}
            </SettingsModal>
        )}
      </Animated.View>
  );
}