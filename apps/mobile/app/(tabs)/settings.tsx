import { useMemo, useState } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { makeScreenStyles, makeSettingsStyles } from "@/styles/shared/ScreenStyles";
import { PREF_META } from "@/data/settings";

import SettingsModal, { type PrefKey } from "@/components/modals/settings/SettingsModal";
import SettingsModalContent from "@/components/settings/SettingsModalContent";
import SettingsSections from "@/components/settings/SettingsSections";

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
          <SettingsSections footerTextStyle={textMutedStyle} onSelect={setActivePref} styles={s} />
        </Animated.View>
      </Animated.ScrollView>
      {activeMeta ? (
        <SettingsModal
          visible={activePref !== null}
          title={activeMeta.title}
          icon={activeMeta.icon}
          showScrollHint
          onClose={closeModal}
        >
          <SettingsModalContent activePref={activePref!} onClose={closeModal} />
        </SettingsModal>
      ) : null}
    </Animated.View>
  );
}
