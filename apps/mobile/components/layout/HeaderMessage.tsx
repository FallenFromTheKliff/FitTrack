import React from "react";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useTypewriter } from "@/hooks/animations/text/useTypewriter";
import { makeHeaderMessageStyles } from "@/styles/shared/LayoutStyles";
import { SCREEN_NAMES, TAB_SUBTITLES, type TabKey } from "@/data/labels";

import { AnimatedFitText } from "@/components/fit/FitText";

type Props = { activeTab: TabKey };

export default React.memo(function HeaderMessage({ activeTab }: Props) {
  const { colors, settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const s = React.useMemo(() => makeHeaderMessageStyles(colors), [colors]);
  const isProfile = activeTab === "profile";
  const subtitle = TAB_SUBTITLES[activeTab];
  const shouldAnimate = settings.animationLevel !== "none";

  const { typed: typedName } = useTypewriter({
    text: SCREEN_NAMES[activeTab] ?? "",
    isActive: shouldAnimate,
    intervalMs: 38
  });

  const { typed: typedSubtitle } = useTypewriter({
    text: subtitle,
    isActive: shouldAnimate,
    intervalMs: 38
  });

  const isProfileShared = useSharedValue(isProfile ? 1 : 0);
  const onBrandColor = useSharedValue(colors.onBrand ?? "#FFFFFF");

  React.useEffect(() => {
    isProfileShared.value = isProfile ? 1 : 0;
  }, [isProfile, isProfileShared]);

  React.useEffect(() => {
    onBrandColor.value = colors.onBrand ?? "#FFFFFF";
  }, [colors.onBrand, onBrandColor]);

  const screenNameStyle = useAnimatedStyle(() => ({
    color: isProfileShared.value === 1 ? onBrandColor.value : ic.value.textPrimary
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));

  return (
      <Animated.View style={s.container}>
        <AnimatedFitText style={[s.screenName, screenNameStyle]} numberOfLines={1}>
          {shouldAnimate ? typedName : SCREEN_NAMES[activeTab]}
        </AnimatedFitText>
        {!isProfile && subtitle ? (
            <AnimatedFitText style={[s.message, subtitleStyle]} numberOfLines={1}>
              {shouldAnimate ? typedSubtitle : subtitle}
            </AnimatedFitText>
        ) : null}
      </Animated.View>
  );
});