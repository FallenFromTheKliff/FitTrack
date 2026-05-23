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
    return "Review your client work, coaching sessions, earnings, and training tools.";
  }
  if (activeTab === "bookings") {
    if (coachView === "clients") return "Review member profiles and client readiness.";
    if (coachView === "earnings") return "Review completed coaching work and expected earnings.";
    return "Track coaching appointments and session status.";
  }
  return TAB_SUBTITLES[activeTab];
}

export default React.memo(function HeaderMessage({ activeTab }: Props) {
  const { user } = useAuth();
  const { colors, settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const searchParams = useGlobalSearchParams<{ coachView?: string | string[] }>();
  const s = React.useMemo(() => makeHeaderMessageStyles(colors), [colors]);
  const isProfile = activeTab === "profile";
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
