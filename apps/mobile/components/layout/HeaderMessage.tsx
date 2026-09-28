import React from "react";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useGlobalSearchParams } from "expo-router";
import { SCREEN_NAMES, TAB_SUBTITLES, type TabKey } from "@fittrack/app-config";
import { useTypewriter } from "@fittrack/hooks";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeHeaderMessageStyles } from "@/styles/shared/LayoutStyles";

import { AnimatedFitText } from "@/components/fit/FitText";

type Props = { activeTab: TabKey };

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getCoachBookingLabel(coachView?: string) {
  if (coachView === "clients") return "Clients";
  if (coachView === "earnings") return "Earnings";
  return "Sessions";
}

function getCoachScreenName(activeTab: TabKey, coachView?: string) {
  if (activeTab === "home") return "Dashboard";
  if (activeTab === "bookings") return getCoachBookingLabel(coachView);
  if (activeTab === "chathistory" || activeTab === "chatbot") return "BrodigyAI";
  return SCREEN_NAMES[activeTab] ?? "";
}

function getCoachSubtitle(activeTab: TabKey, coachView?: string) {
  if (activeTab === "home") {
    return "Coach work at a glance.";
  }
  if (activeTab === "bookings") {
    if (coachView === "clients") return "Review client progress.";
    if (coachView === "earnings") return "Track session revenue.";
    return "Manage coaching sessions.";
  }
  if (activeTab === "chathistory" || activeTab === "chatbot") {
    return "Ask BrodigyAI.";
  }
  return TAB_SUBTITLES[activeTab];
}

function usesBrandHeader(activeTab: TabKey) {
  return activeTab === "profile";
}

export default React.memo(function HeaderMessage({ activeTab }: Props) {
  const { user } = useAuth();
  const { colors, settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const searchParams = useGlobalSearchParams<{ coachView?: string | string[] }>();
  const s = React.useMemo(() => makeHeaderMessageStyles(colors), [colors]);
  const isProfile = activeTab === "profile";
  const isBrandHeader = usesBrandHeader(activeTab);
  const isCoach = user?.role === "COACH";
  const coachView = getSearchParamValue(searchParams.coachView);
  const screenName = isCoach ? getCoachScreenName(activeTab, coachView) : SCREEN_NAMES[activeTab] ?? "";
  const subtitle = (isCoach ? getCoachSubtitle(activeTab, coachView) : TAB_SUBTITLES[activeTab]) ?? "";
  const shouldAnimate = settings.animationLevel !== "none";

  const { typed: typedName } = useTypewriter({
    text: screenName,
    isActive: shouldAnimate,
    intervalMs: 38
  });

  const { typed: typedSubtitle } = useTypewriter({
    text: subtitle,
    isActive: shouldAnimate,
    intervalMs: 38
  });

  const isBrandHeaderShared = useSharedValue(isBrandHeader ? 1 : 0);
  const onBrandColor = useSharedValue(colors.onBrand ?? "#FFFFFF");

  React.useEffect(() => {
    isBrandHeaderShared.value = isBrandHeader ? 1 : 0;
  }, [isBrandHeader, isBrandHeaderShared]);

  React.useEffect(() => {
    onBrandColor.value = colors.onBrand ?? "#FFFFFF";
  }, [colors.onBrand, onBrandColor]);

  const screenNameStyle = useAnimatedStyle(() => ({
    color: isBrandHeaderShared.value === 1 ? onBrandColor.value : ic.value.textPrimary
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    color: isBrandHeaderShared.value === 1 ? onBrandColor.value : ic.value.textMuted,
    opacity: isBrandHeaderShared.value === 1 ? 0.84 : 1,
  }));

  return (
      <Animated.View style={s.container}>
        <AnimatedFitText style={[s.screenName, screenNameStyle]} numberOfLines={1}>
          {shouldAnimate ? typedName : screenName}
        </AnimatedFitText>
        {!isProfile && subtitle ? (
            <AnimatedFitText style={[s.message, subtitleStyle]} numberOfLines={1}>
              {shouldAnimate ? typedSubtitle : subtitle}
            </AnimatedFitText>
        ) : null}
      </Animated.View>
  );
});
