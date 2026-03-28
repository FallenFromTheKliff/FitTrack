import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Menu, ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeHeaderStyles } from "@/styles/shared/LayoutStyles";

import HeaderMessage from "@/components/layout/HeaderMessage";
import { type TabKey } from "@/data/labels";

type HeaderProps = {
  onMenuPress: () => void;
  activeTab: TabKey;
  showBack?: boolean;
  onBackPress?: () => void;
  isDimmed?: boolean;
};

export default function Header({ onMenuPress, activeTab, showBack, onBackPress, isDimmed }: HeaderProps) {
  const { colors, activeIconColor } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const s = React.useMemo(() => makeHeaderStyles(colors), [colors]);
  const isProfile = activeTab === "profile";
  const dimOpacity = useSharedValue(isDimmed ? 1 : 0);
  const isProfileShared = useSharedValue(isProfile ? 1 : 0);
  const brandColor = useSharedValue(colors.brand);

  React.useEffect(() => {
    isProfileShared.value = isProfile ? 1 : 0;
  }, [isProfile, isProfileShared]);

  React.useEffect(() => {
    brandColor.value = colors.brand;
  }, [colors.brand, brandColor]);

  React.useEffect(() => {
    dimOpacity.value = isDimmed ? 1 : 0;
  }, [dimOpacity, isDimmed]);

  const iconColor = isProfile ? (colors.onBrand ?? "#FFFFFF") : (activeIconColor ?? colors.textPrimary);
  const showOverlayBlur = !!isDimmed;

  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: isProfileShared.value === 1 ? brandColor.value : ic.value.surface
  }));
  const dimOverlayStyle = useAnimatedStyle(() => ({ opacity: dimOpacity.value }));

  return (
      <Animated.View style={[s.header, headerStyle]}>
        <Pressable
            onPress={showBack ? onBackPress : onMenuPress}
            style={s.menuButton}
            hitSlop={8}
        >
          {showBack ? (
              <ChevronLeft size={28} color={iconColor} strokeWidth={2} />
          ) : (
              <Menu size={28} color={iconColor} strokeWidth={2} />
          )}
        </Pressable>
        <HeaderMessage activeTab={activeTab} />
        {showOverlayBlur && (
            <Animated.View style={[StyleSheet.absoluteFill, dimOverlayStyle]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
            </Animated.View>
        )}
      </Animated.View>
  );
}
