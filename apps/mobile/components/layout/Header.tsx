import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Bell, ChevronLeft, HelpCircle, Menu } from "lucide-react-native";
import { type TabKey } from "@fittrack/app-config";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeHeaderStyles } from "@/styles/shared/LayoutStyles";

import HeaderMessage from "@/components/layout/HeaderMessage";

type HeaderProps = {
  onMenuPress: () => void;
  onHelpPress?: () => void;
  onNotificationsPress?: () => void;
  activeTab: TabKey;
  showBack?: boolean;
  onBackPress?: () => void;
  isDimmed?: boolean;
  unreadCount?: number;
};

export default function Header({
  onMenuPress,
  onHelpPress,
  onNotificationsPress,
  activeTab,
  showBack,
  onBackPress,
  isDimmed,
  unreadCount = 0,
}: HeaderProps) {
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
        <View style={s.headerActions}>
          <Pressable
            onPress={onHelpPress}
            style={[s.menuButton, s.headerActionButton]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open page help"
          >
            <HelpCircle size={22} color={iconColor} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={onNotificationsPress}
            style={[s.menuButton, s.headerActionButton]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "Open notifications"
            }
          >
            <Bell size={22} color={iconColor} strokeWidth={2} />
            {unreadCount > 0 ? (
              <View style={s.notificationBadge}>
                <Text style={s.notificationBadgeText}>
                  {unreadCount > 99 ? "99+" : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {showOverlayBlur && (
            <Animated.View style={[StyleSheet.absoluteFill, dimOverlayStyle]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
            </Animated.View>
        )}
      </Animated.View>
  );
}
