import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useRouter, useSegments } from "expo-router";
import { Home, Map, CalendarDays, Apple, Dumbbell, Bot, LogOut, Settings } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { TIER_LABELS, TIER_LEVELS } from "@/data/member";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeSidebarStyles, SIDEBAR_WIDTH } from "@/styles/shared/LayoutStyles";

import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type NavItem = { label: string; icon: LucideIcon; route: string };
const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: Home, route: "/(tabs)/home" },
  { label: "Bookings", icon: CalendarDays, route: "/(tabs)/bookings" },
  { label: "Facilities", icon: Map, route: "/(tabs)/facilities" },
  { label: "Nutrition", icon: Apple, route: "/(tabs)/nutrition" },
  { label: "Workout", icon: Dumbbell, route: "/(tabs)/workout" },
  { label: "BrodigyAI", icon: Bot, route: "/(tabs)/chathistory" },
  { label: "Settings", icon: Settings, route: "/(tabs)/settings" }
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onLogoutPress: () => void;
};

export default function Sidebar({ isOpen, onClose, onLogoutPress }: Props) {
  const { user } = useAuth();
  const { colors, settings, activeIconColor } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const { ic } = useThemeTransitionAnim();
  const router = useRouter();
  const segments = useSegments();
  const s = useMemo(() => makeSidebarStyles(colors, activeIconColor), [colors, activeIconColor]);

  const slideAnim = useSharedValue(-SIDEBAR_WIDTH);
  const [isVisible, setIsVisible] = useState(isOpen);

  const isProfileActive = segments.includes("profile" as never);
  const isProfileActiveShared = useSharedValue(isProfileActive ? 1 : 0);

  useEffect(() => {
    isProfileActiveShared.value = isProfileActive ? 1 : 0;
  }, [isProfileActive, isProfileActiveShared]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (shouldAnimate) {
        slideAnim.value = -SIDEBAR_WIDTH;
        slideAnim.value = withTiming(0, { duration: 220 });
      } else {
        slideAnim.value = 0;
      }
      return;
    }
    if (shouldAnimate) {
      slideAnim.value = withTiming(-SIDEBAR_WIDTH, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setIsVisible)(false);
      });
    } else {
      slideAnim.value = -SIDEBAR_WIDTH;
      setIsVisible(false);
    }
  }, [isOpen, shouldAnimate]);

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideAnim.value }] }));
  const sidebarBgStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.base,
    borderRightColor: ic.value.border
  }));
  const logoBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const separatorStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));
  const profileCardStyle = useAnimatedStyle(() => ({
    backgroundColor: isProfileActiveShared.value === 1 ? ic.value.fieldBg : ic.value.surface,
    borderColor: isProfileActiveShared.value === 1 ? ic.value.brand : ic.value.border
  }));
  const profileNameStyle = useAnimatedStyle(() => ({ color: ic.value.brand }));
  const tierStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));
  const bottomBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const isActive = (route: string) => segments.includes(route.split("/").pop() as never);
  const handleNav = (route: string) => {
    onClose();
    router.replace(route as any);
  };
  const handleProfilePress = () => {
    onClose();
    router.replace("/(tabs)/profile" as any);
  };

  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "FT";
  const avatarUri = user?.avatarUri;
  const tierLabel = user?.tier ? TIER_LABELS[user.tier] : "Fit Starter";
  const tierLevel = user?.tier ? TIER_LEVELS[user.tier] : 1;
  const ic2 = activeIconColor ?? colors.brand;

  return (
      <Modal
          visible={isVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={onClose}
      >
        <View style={s.modalOuter}>
          <View style={s.modalInner}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Animated.View style={[s.sidebar, slideStyle, sidebarBgStyle]}>
              <Animated.View style={[s.logoRow, logoBorderStyle]}>
                <View style={s.logoIconWrap}>
                  <Dumbbell size={24} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
                </View>
                <View style={s.logoTextGroup}>
                  <FitText style={s.logoTitle}>FitTrack</FitText>
                  <FitText style={s.logoSubtitle}>SertFit Gym</FitText>
                </View>
              </Animated.View>
              <Pressable onPress={handleProfilePress}>
                <Animated.View style={[s.profileCard, profileCardStyle]}>
                  <View style={s.profileAvatar}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%", borderRadius: 12 }} />
                    ) : (
                        <AnimatedFitText style={[s.profileAvatarText, profileNameStyle]}>
                          {initials}
                        </AnimatedFitText>
                    )}
                  </View>
                  <View style={s.profileInfo}>
                    <AnimatedFitText style={[s.profileName, profileNameStyle]} numberOfLines={1}>
                      {user?.name ?? "Member"}
                    </AnimatedFitText>
                    <AnimatedFitText style={[s.profileTierRow, tierStyle]} numberOfLines={1}>
                      {tierLabel}{" \u2022 "}Level {tierLevel}
                    </AnimatedFitText>
                    <View style={s.profileManageHint}>
                      <Settings size={11} color={ic2} strokeWidth={2} />
                      <FitText style={s.profileManageHintText}>Manage Profile Details</FitText>
                    </View>
                  </View>
                </Animated.View>
              </Pressable>
              <Animated.View style={[s.navSeparator, separatorStyle]} />
              {NAV_ITEMS.map(({ label, icon, route }) => {
                const active = isActive(route);
                return (
                    <FitButton
                        key={route}
                        label={label}
                        icon={icon}
                        iconSize={24}
                        variant={active ? "navActive" : "nav"}
                        showTrailing={active}
                        onPress={() => handleNav(route)}
                        style={s.navItem}
                    />
                );
              })}
              <Animated.View style={[s.bottomSection, bottomBorderStyle]}>
                <FitButton
                    label="Sign Out"
                    icon={LogOut}
                    iconSize={24}
                    variant="sidebarLogout"
                    onPress={onLogoutPress}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </Modal>
  );
}