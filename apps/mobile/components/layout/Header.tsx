import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Bell, ChevronLeft, HelpCircle, Menu } from "lucide-react-native";
import { type TabKey } from "@fittrack/app-config";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function usesBrandHeader(activeTab: TabKey) {
  return activeTab === "profile";
}

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
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const s = React.useMemo(
    () => makeHeaderStyles(colors, { compact: viewportWidth < 360, topInset: insets.top }),
    [colors, insets.top, viewportWidth],
  );
  const isBrandHeader = usesBrandHeader(activeTab);
  const dimOpacity = useSharedValue(isDimmed ? 1 : 0);
  const isBrandHeaderShared = useSharedValue(isBrandHeader ? 1 : 0);
  const brandColor = useSharedValue(colors.brand);

  React.useEffect(() => {
    isBrandHeaderShared.value = isBrandHeader ? 1 : 0;
  }, [isBrandHeader, isBrandHeaderShared]);

  React.useEffect(() => {
    brandColor.value = colors.brand;
  }, [colors.brand, brandColor]);

  React.useEffect(() => {
    dimOpacity.value = isDimmed ? 1 : 0;
  }, [dimOpacity, isDimmed]);

  const iconColor = isBrandHeader ? (colors.onBrand ?? "#FFFFFF") : (activeIconColor ?? colors.textPrimary);
  const showOverlayBlur = !!isDimmed;

  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: isBrandHeaderShared.value === 1 ? brandColor.value : ic.value.surface
  }));
  const dimOverlayStyle = useAnimatedStyle(() => ({ opacity: dimOpacity.value }));

  return (
      <Animated.View style={[s.header, headerStyle]}>
        <Pressable
            onPress={showBack ? onBackPress : onMenuPress}
            style={s.menuButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showBack ? "Go back" : "Open navigation menu"}
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
            nativeID={viewportWidth >= 360 ? "mobile-responsive-notification-button" : undefined}
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
