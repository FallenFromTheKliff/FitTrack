import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { type Href, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Map, CalendarDays, ClipboardCheck, Apple, Trophy, Dumbbell, Bot, LogOut, Settings, Users, LineChart } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { type TabKey } from "@fittrack/app-config";

import { useAuth } from "@/contexts/AuthContext";
import { TIER_LABELS, TIER_LEVELS } from "@/data/member";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeSidebarStyles, SIDEBAR_WIDTH } from "@/styles/shared/LayoutStyles";

import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitAvatarImage from "@/components/fit/FitAvatarImage";
import FitTrackLogo from "@/components/brand/FitTrackLogo";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";
import {
  beginSidebarClose,
  beginSidebarLogout,
  beginSidebarNavigation,
  completeSidebarDismissal,
  createSidebarActionState,
  discardPendingSidebarAction,
  getSidebarLifecycleSnapshot,
  type SidebarLifecyclePhase,
  type SidebarLifecycleSnapshot,
  type SidebarPendingAction,
  usesIosNativeModalCoordination,
} from "./sidebar-lifecycle";

export const SIDEBAR_NAV_LABELS_BY_TAB: Record<TabKey, string> = {
  home: "Home",
  facilities: "Facilities",
  bookings: "Bookings",
  assessments: "Assessments",
  nutrition: "Nutrition",
  mastery: "Muscle Mastery",
  workout: "Workout",
  chathistory: "BrodigyAI",
  chatbot: "BrodigyAI",
  profile: "Profile",
  settings: "Settings"
};

type SidebarRoute = Href & string;
type NavItem = {
  coachView?: "clients" | "appointments" | "earnings";
  icon: LucideIcon;
  label: string;
  route: SidebarRoute;
};

type NavSection = {
  items: NavItem[];
  label: string;
};

const MEMBER_NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: SIDEBAR_NAV_LABELS_BY_TAB.home, icon: Home, route: "/(tabs)/home" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.bookings, icon: CalendarDays, route: "/(tabs)/bookings" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.assessments, icon: ClipboardCheck, route: "/(tabs)/assessments" },
    ],
  },
  {
    label: "Fitness",
    items: [
      { label: SIDEBAR_NAV_LABELS_BY_TAB.facilities, icon: Map, route: "/(tabs)/facilities" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.nutrition, icon: Apple, route: "/(tabs)/nutrition" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.mastery, icon: Trophy, route: "/(tabs)/mastery" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.workout, icon: Dumbbell, route: "/(tabs)/workout" },
    ],
  },
  {
    label: "System",
    items: [
      { label: SIDEBAR_NAV_LABELS_BY_TAB.chathistory, icon: Bot, route: "/(tabs)/chathistory" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.settings, icon: Settings, route: "/(tabs)/settings" },
    ],
  },
];

const COACH_NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", icon: Home, route: "/(tabs)/home" },
    ],
  },
  {
    label: "Coaching",
    items: [
      { label: "Clients", icon: Users, route: "/(tabs)/bookings?coachView=clients", coachView: "clients" },
      { label: "Sessions", icon: CalendarDays, route: "/(tabs)/bookings?coachView=appointments", coachView: "appointments" },
      { label: "Earnings", icon: LineChart, route: "/(tabs)/bookings?coachView=earnings", coachView: "earnings" },
    ],
  },
  {
    label: "System",
    items: [
      { label: SIDEBAR_NAV_LABELS_BY_TAB.chathistory, icon: Bot, route: "/(tabs)/chathistory" },
      { label: SIDEBAR_NAV_LABELS_BY_TAB.settings, icon: Settings, route: "/(tabs)/settings" },
    ],
  },
];

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getCoachViewFromRoute(route: string) {
  const match = route.match(/[?&]coachView=([^&]+)/);
  return match?.[1] as NavItem["coachView"] | undefined;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onLifecycleChange?: (snapshot: SidebarLifecycleSnapshot) => void;
  onLogoutPress: () => void;
};

const IS_IOS = usesIosNativeModalCoordination(Platform.OS);

export default function Sidebar({
  isOpen,
  onClose,
  onLifecycleChange,
  onLogoutPress,
}: Props) {
  const { user } = useAuth();
  const { colors, settings, activeIconColor } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const { ic } = useThemeTransitionAnim();
  const router = useRouter();
  const segments = useSegments();
  const searchParams = useGlobalSearchParams<{ coachView?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const s = useMemo(() => makeSidebarStyles(colors, activeIconColor), [colors, activeIconColor]);
  const sidebarWidth = Math.min(SIDEBAR_WIDTH, Math.max(0, viewportWidth - 24));
  const smallViewport = viewportWidth < 360;
  const sidebarTopPadding = smallViewport ? Math.max(16, insets.top + 12) : 40;
  const bottomPadding = smallViewport ? Math.max(insets.bottom + 8, 12) : Math.max(insets.bottom, 6);
  const isCoach = user?.role === "COACH";
  const activeCoachView = getSearchParamValue(searchParams.coachView) ?? "appointments";
  const actionRouteKey = `${segments.join("/")}:${activeCoachView}`;

  const slideAnim = useSharedValue(-sidebarWidth);
  const [isVisible, setIsVisible] = useState(isOpen);
  const isMountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const isVisibleRef = useRef(isOpen);
  const modalPresentedRef = useRef(false);
  const dismissAnimationRef = useRef(0);
  const actionStateRef = useRef(createSidebarActionState<SidebarRoute>());
  const actionContextRef = useRef({
    route: actionRouteKey,
    userId: user?.id,
  });
  const onLogoutPressRef = useRef(onLogoutPress);

  isOpenRef.current = isOpen;
  onLogoutPressRef.current = onLogoutPress;

  const isProfileActive = segments.includes("profile" as never);
  const isProfileActiveShared = useSharedValue(isProfileActive ? 1 : 0);

  useEffect(() => {
    isProfileActiveShared.value = isProfileActive ? 1 : 0;
  }, [isProfileActive, isProfileActiveShared]);

  const reportLifecycle = useCallback((phase: SidebarLifecyclePhase) => {
    if (!IS_IOS) return;
    onLifecycleChange?.(getSidebarLifecycleSnapshot(phase, actionStateRef.current));
  }, [onLifecycleChange]);

  const setModalVisibility = useCallback((visible: boolean) => {
    isVisibleRef.current = visible;
    setIsVisible(visible);
  }, []);

  const executeSidebarAction = useCallback((
    action: SidebarPendingAction<SidebarRoute>,
    afterNativeDismissal: boolean,
  ) => {
    if (action.kind === "logout") {
      onLogoutPressRef.current();
      return;
    }
    if (afterNativeDismissal) {
      router.navigate(action.route);
      return;
    }
    requestAnimationFrame(() => {
      startTransition(() => {
        router.navigate(action.route);
      });
    });
  }, [router]);

  const finishDismissAnimation = useCallback((animationId: number) => {
    if (
      !isMountedRef.current ||
      animationId !== dismissAnimationRef.current ||
      isOpenRef.current
    ) {
      return;
    }
    setModalVisibility(false);
    if (IS_IOS && !modalPresentedRef.current) {
      actionStateRef.current = createSidebarActionState<SidebarRoute>();
      reportLifecycle("closed");
    }
  }, [reportLifecycle, setModalVisibility]);

  useEffect(() => {
    if (isOpen) {
      if (IS_IOS && actionStateRef.current.dismissing) {
        onClose();
        return;
      }
      dismissAnimationRef.current += 1;
      actionStateRef.current = createSidebarActionState<SidebarRoute>();
      setModalVisibility(true);
      reportLifecycle(modalPresentedRef.current ? "open" : "presenting");
      if (shouldAnimate) {
        slideAnim.value = -sidebarWidth;
        slideAnim.value = withTiming(0, { duration: 220 });
      } else {
        slideAnim.value = 0;
      }
      return;
    }

    if (!isVisibleRef.current) {
      if (IS_IOS && actionStateRef.current.dismissing && !modalPresentedRef.current) {
        actionStateRef.current = createSidebarActionState<SidebarRoute>();
        reportLifecycle("closed");
      }
      return;
    }

    if (IS_IOS && !actionStateRef.current.dismissing) {
      actionStateRef.current = beginSidebarClose(actionStateRef.current, true).state;
    }
    reportLifecycle("dismissing");
    const animationId = dismissAnimationRef.current + 1;
    dismissAnimationRef.current = animationId;
    if (shouldAnimate) {
      slideAnim.value = withTiming(-sidebarWidth, { duration: 220 }, (finished) => {
        if (finished) runOnJS(finishDismissAnimation)(animationId);
      });
    } else {
      slideAnim.value = -sidebarWidth;
      finishDismissAnimation(animationId);
    }
  }, [
    finishDismissAnimation,
    isOpen,
    onClose,
    reportLifecycle,
    setModalVisibility,
    shouldAnimate,
    sidebarWidth,
    slideAnim,
  ]);

  useEffect(() => {
    const previous = actionContextRef.current;
    if (previous.route !== actionRouteKey || previous.userId !== user?.id) {
      actionStateRef.current = discardPendingSidebarAction(actionStateRef.current);
      if (IS_IOS && actionStateRef.current.dismissing) {
        reportLifecycle("dismissing");
      }
      actionContextRef.current = { route: actionRouteKey, userId: user?.id };
    }
  }, [actionRouteKey, reportLifecycle, user?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      dismissAnimationRef.current += 1;
      actionStateRef.current = createSidebarActionState<SidebarRoute>();
    };
  }, []);

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

  const isActive = useCallback(
    (route: string) => {
      const routePath = route.split("?")[0] ?? route;
      const routeLeaf = routePath.split("/").pop();
      if (!segments.includes(routeLeaf as never)) return false;

      const routeCoachView = getCoachViewFromRoute(route);
      if (routeCoachView) return activeCoachView === routeCoachView;

      return true;
    },
    [activeCoachView, segments]
  );

  const closeSidebarOnly = useCallback(() => {
    const decision = beginSidebarClose(actionStateRef.current, IS_IOS);
    if (!decision.accepted) return;
    actionStateRef.current = decision.state;
    reportLifecycle("dismissing");
    if (decision.shouldClose) onClose();
  }, [onClose, reportLifecycle]);

  const navigateFromSidebar = useCallback((route: SidebarRoute) => {
    if (isActive(route)) {
      closeSidebarOnly();
      return;
    }
    const decision = beginSidebarNavigation(actionStateRef.current, route, IS_IOS);
    if (!decision.accepted) return;
    actionStateRef.current = decision.state;
    reportLifecycle("dismissing");
    if (decision.shouldClose) onClose();
    if (decision.action) executeSidebarAction(decision.action, false);
  }, [executeSidebarAction, isActive, onClose, reportLifecycle, closeSidebarOnly]);

  const handleLogoutPress = useCallback(() => {
    const decision = beginSidebarLogout(actionStateRef.current, IS_IOS);
    if (!decision.accepted) return;
    actionStateRef.current = decision.state;
    reportLifecycle("dismissing");
    if (decision.shouldClose) onClose();
    if (decision.action) executeSidebarAction(decision.action, false);
  }, [executeSidebarAction, onClose, reportLifecycle]);

  const handleModalShow = useCallback(() => {
    modalPresentedRef.current = true;
    if (!IS_IOS) return;
    reportLifecycle(
      isOpenRef.current && !actionStateRef.current.dismissing
        ? "open"
        : "dismissing",
    );
  }, [reportLifecycle]);

  const handleModalDismiss = useCallback(() => {
    modalPresentedRef.current = false;
    isVisibleRef.current = false;
    if (!IS_IOS) return;
    const completion = completeSidebarDismissal(actionStateRef.current);
    actionStateRef.current = completion.state;
    if (completion.action) {
      executeSidebarAction(completion.action, true);
    }
    reportLifecycle("closed");
  }, [executeSidebarAction, reportLifecycle]);

  const handleProfilePress = useCallback(() => {
    navigateFromSidebar("/(tabs)/profile");
  }, [navigateFromSidebar]);

  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "FT";
  const avatarUri = buildRenderableAssetUrl({
    apiBaseUrl: MOBILE_API_BASE_URL,
    assetUrl: user?.avatarUri
  });
  const tierLabel = isCoach ? "Coach" : user?.tier ? TIER_LABELS[user.tier] : "Fit Starter";
  const tierLevel = user?.tier ? TIER_LEVELS[user.tier] : 1;
  const ic2 = activeIconColor ?? colors.brand;
  const navSections = isCoach ? COACH_NAV_SECTIONS : MEMBER_NAV_SECTIONS;

  return (
      <Modal
          visible={isVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onDismiss={handleModalDismiss}
          onRequestClose={closeSidebarOnly}
          onShow={handleModalShow}
      >
        <View style={s.modalOuter}>
          <View style={s.modalInner}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebarOnly} />
            <Animated.View style={[s.sidebar, { paddingTop: sidebarTopPadding, width: sidebarWidth }, slideStyle, sidebarBgStyle]}>
              <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                style={s.scroll}
              >
                <Animated.View style={[s.logoRow, logoBorderStyle]}>
                  <View style={s.logoIconWrap}>
                    <FitTrackLogo size={42} />
                  </View>
                  <View style={s.logoTextGroup}>
                    <FitText style={s.logoTitle}>FitTrack</FitText>
                    <FitText style={s.logoSubtitle}>SertFit Gym</FitText>
                  </View>
                </Animated.View>
                <Pressable
                  accessibilityLabel="Open profile"
                  accessibilityRole="button"
                  onPress={handleProfilePress}
                >
                  <Animated.View style={[s.profileCard, profileCardStyle]}>
                    <View style={s.profileAvatar}>
                      <FitAvatarImage
                        alt={`${user?.name ?? "Member"} avatar`}
                        borderRadius={12}
                        uri={avatarUri}
                        fallback={
                          <AnimatedFitText style={[s.profileAvatarText, profileNameStyle]}>
                            {initials}
                          </AnimatedFitText>
                        }
                      />
                    </View>
                    <View style={s.profileInfo}>
                      <AnimatedFitText style={[s.profileName, profileNameStyle]} numberOfLines={1}>
                        {user?.name ?? "Member"}
                      </AnimatedFitText>
                      <AnimatedFitText style={[s.profileTierRow, tierStyle]} numberOfLines={1}>
                        {isCoach ? "Coach Portal" : `${tierLabel} - Level ${tierLevel}`}
                      </AnimatedFitText>
                      <View style={s.profileManageHint}>
                        <Settings size={11} color={ic2} strokeWidth={2} />
                        <FitText style={s.profileManageHintText}>
                          Manage Profile Details
                        </FitText>
                      </View>
                    </View>
                  </Animated.View>
                </Pressable>
                <Animated.View style={[s.navSeparator, separatorStyle]} />
                <View style={s.navList}>
                  {navSections.map((section) => (
                    <View key={section.label} style={s.navSection}>
                      <FitText style={s.navSectionLabel}>{section.label}</FitText>
                      <View style={s.navSectionItems}>
                        {section.items.map(({ label, icon, route }) => {
                          const active = isActive(route);
                          return (
                            <FitButton
                              key={route}
                              label={label}
                              icon={icon}
                              iconSize={20}
                              variant={active ? "navActive" : "nav"}
                              showTrailing={active}
                              onPress={() => navigateFromSidebar(route)}
                              style={s.navItem}
                              textStyle={active ? s.navTextActive : s.navText}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Animated.View
                style={[
                  s.bottomSection,
                  bottomBorderStyle,
                  { marginTop: smallViewport ? 12 : "auto", paddingBottom: bottomPadding },
                ]}
              >
                <FitButton
                    label="SIGN OUT"
                    icon={LogOut}
                    iconSize={22}
                    variant="sidebarLogout"
                    onPress={handleLogoutPress}
                    style={[s.logoutItem, !smallViewport ? { transform: [{ translateY: -5 }] } : undefined]}
                    textStyle={s.logoutText}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </Modal>
  );
}
