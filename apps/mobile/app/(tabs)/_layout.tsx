import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Tabs, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { Bell, HelpCircle, LogOut } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { notificationUnreadCountQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { FABStateProvider, useFABState } from "@/contexts/FABStateContext";
import { type TabKey } from "@fittrack/app-config";

import { FitFAB, FitFABMenu } from "@/components/fit";
import Sidebar, { SIDEBAR_NAV_LABELS_BY_TAB } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import SettingsModal from "@/components/modals/settings/SettingsModal";
import NotificationInboxPanel from "@/components/settings/NotificationInboxPanel";
import AutoHelpDismissCheckbox from "@/components/help/AutoHelpDismissCheckbox";
import MobileHelpPanel from "@/components/help/MobileHelpPanel";
import { getMobileHelpContent } from "@/components/help/mobileHelpContent";
import { ConfirmModal, ReservationModal } from "@/components/modals";
import { mobileApiClient } from "@/lib/api-client";
import {
  AUTO_HELP_TABS,
  dismissAutoHelpForAll,
  dismissAutoHelpForTab,
  isAutoHelpDismissed,
} from "@/lib/help-preferences";

const TAB_ROUTES: TabKey[] = [
  "home", "facilities", "bookings", "assessments", "nutrition", "mastery", "workout",
  "chathistory", "chatbot", "profile", "settings"
];

const COACH_ALLOWED_TABS = new Set<TabKey>([
  "home",
  "bookings",
  "chathistory",
  "chatbot",
  "profile",
  "settings",
]);

const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  tabBarStyle: { display: "none" as const },
  detachInactiveScreens: true
};

const s = StyleSheet.create({
  container: { flex: 1 },
  screenArea: { flex: 1 }
});

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getCoachModuleLabel(activeTab: TabKey, coachView?: string) {
  if (activeTab === "home") return "Dashboard";
  if (activeTab === "bookings") {
    if (coachView === "clients") return "Clients";
    if (coachView === "earnings") return "Earnings";
    return "Sessions";
  }
  if (activeTab === "chathistory" || activeTab === "chatbot") return "BrodigyAI";
  return SIDEBAR_NAV_LABELS_BY_TAB[activeTab];
}

function TabsLayoutInner() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const router = useRouter();
  const segments = useSegments();
  const searchParams = useGlobalSearchParams<{ coachView?: string | string[] }>();
  const {
    isFabOpen,
    setFabOpen,
    fabConfig,
    isSidebarOpen,
    setSidebarOpen,
    isReservationOpen,
    setReservationOpen,
    fireBookingRefresh,
    isCameraActive
  } = useFABState();

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [autoHelpTab, setAutoHelpTab] = useState<TabKey | null>(null);
  const [neverAutoHelpChecked, setNeverAutoHelpChecked] = useState(false);
  const [helpDismissScopeVisible, setHelpDismissScopeVisible] = useState(false);

  const { opacity } = usePassageAnim();
  const entranceStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const containerBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.base }));
  const overlayOpacity = useSharedValue(0);
  const overlayAnimStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const activeTab: TabKey = TAB_ROUTES.find((r) => segments.includes(r as never)) ?? "home";
  const activeHelpContent = getMobileHelpContent(activeTab);
  const activeCoachView = getSearchParamValue(searchParams.coachView);
  const activeHelpTitle = `Help - ${
    user?.role === "COACH"
      ? getCoachModuleLabel(activeTab, activeCoachView)
      : SIDEBAR_NAV_LABELS_BY_TAB[activeTab]
  }`;
  const isBrodigyMembershipLocked =
    activeTab === "chatbot" &&
    user?.role === "USER" &&
    user.membershipAccess !== "member";
  const isAutoHelpEligible =
    AUTO_HELP_TABS.includes(activeTab) && !isBrodigyMembershipLocked;
  const isChatScreen = segments.includes("chatbot" as never);
  const showBackButton = isChatScreen;
  const showOverlay = isSidebarOpen || isFabOpen;
  const unreadCountQuery = useQuery({
    ...notificationUnreadCountQueryOptions(mobileApiClient, user?.id),
    enabled: Boolean(user?.id),
  });

  const openHelp = (nextAutoHelpTab: TabKey | null) => {
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setAutoHelpTab(nextAutoHelpTab);
    setNeverAutoHelpChecked(false);
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => setHelpVisible(true));
      return;
    }
    setHelpVisible(true);
  };

  useEffect(() => {
    const isActive = isSidebarOpen || isFabOpen;
    if (settings.animationLevel === "full") {
      overlayOpacity.value = withTiming(isActive ? 1 : 0, { duration: 220 });
    } else {
      overlayOpacity.value = isActive ? 1 : 0;
    }
  }, [isSidebarOpen, isFabOpen, overlayOpacity, settings.animationLevel]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/(auth)/login");
      return;
    }
    if (user?.role !== "USER" && user?.role !== "COACH") {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, router, user?.role]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || user?.role !== "COACH") return;
    if (COACH_ALLOWED_TABS.has(activeTab)) return;

    setFabOpen(false);
    setSidebarOpen(false);
    setReservationOpen(false);
    setHelpVisible(false);
    router.replace("/(tabs)/home");
  }, [
    activeTab,
    isAuthenticated,
    isLoading,
    router,
    setFabOpen,
    setReservationOpen,
    setSidebarOpen,
    user?.role,
  ]);

  useEffect(() => {
    if (!user?.id || !isAutoHelpEligible) return;
    let isMounted = true;
    isAutoHelpDismissed(user.id, activeTab)
      .then((dismissed) => {
        if (!isMounted || dismissed) return;
        openHelp(activeTab);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [activeTab, isAutoHelpEligible, user?.id]);

  useEffect(() => {
    if (!isBrodigyMembershipLocked) return;
    setHelpVisible(false);
    setAutoHelpTab(null);
    setNeverAutoHelpChecked(false);
    setHelpDismissScopeVisible(false);
  }, [isBrodigyMembershipLocked]);

  const handleMenuPress = () => {
    if (isFabOpen || isCameraActive) return;
    setSidebarOpen(!isSidebarOpen);
  };

  const handleFabPress = (nowOpen: boolean) => {
    setFabOpen(nowOpen);
  };

  const closeHelp = () => {
    setHelpVisible(false);
    setAutoHelpTab(null);
    setNeverAutoHelpChecked(false);
  };

  const handleHelpClose = () => {
    if (
      neverAutoHelpChecked &&
      autoHelpTab === activeTab &&
      isAutoHelpEligible &&
      user?.id
    ) {
      setHelpDismissScopeVisible(true);
      return;
    }

    closeHelp();
  };

  const handleDismissCurrentHelp = async () => {
    if (user?.id && autoHelpTab) {
      await dismissAutoHelpForTab(user.id, autoHelpTab);
    }
    setHelpDismissScopeVisible(false);
    closeHelp();
  };

  const handleDismissAllHelp = async () => {
    if (user?.id) {
      await dismissAutoHelpForAll(user.id);
    }
    setHelpDismissScopeVisible(false);
    closeHelp();
  };

  if (isLoading || !isAuthenticated) return null;

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await logout();
  };

  const handleBack = () => {
    router.replace("/(tabs)/chathistory");
  };

  return (
    <Animated.View style={[s.container, containerBgStyle, entranceStyle]}>
      <Header
        onMenuPress={handleMenuPress}
        onHelpPress={() => {
          if (isBrodigyMembershipLocked) return;
          openHelp(null);
        }}
        onNotificationsPress={() => setNotificationsVisible(true)}
        activeTab={activeTab}
        showBack={showBackButton}
        onBackPress={handleBack}
        isDimmed={isSidebarOpen}
        unreadCount={unreadCountQuery.data?.count ?? 0}
      />
      <Animated.View style={[s.screenArea, containerBgStyle]}>
        <Tabs screenOptions={TAB_SCREEN_OPTIONS}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="home" />
          <Tabs.Screen name="facilities" />
          <Tabs.Screen name="bookings" />
          <Tabs.Screen name="assessments" />
          <Tabs.Screen name="nutrition" />
          <Tabs.Screen name="mastery" />
          <Tabs.Screen name="workout" />
          <Tabs.Screen name="chathistory" />
          <Tabs.Screen name="chatbot" />
          <Tabs.Screen name="profile" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </Animated.View>
      {showOverlay && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { zIndex: 15 }, overlayAnimStyle]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
        </Animated.View>
      )}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogoutPress={() => {
          setSidebarOpen(false);
          setLogoutVisible(true);
        }}
      />
      {fabConfig?.visible !== false && fabConfig && !isSidebarOpen && (
        <FitFAB
          screenIcon={fabConfig.screenIcon}
          isOpen={isFabOpen}
          onPress={handleFabPress}
          scrollY={fabConfig.scrollY}
        />
      )}
      {fabConfig?.visible !== false && fabConfig && !isSidebarOpen && (
        <FitFABMenu
          items={fabConfig.menuItems}
          isOpen={isFabOpen}
        />
      )}
      {logoutVisible ? (
        <ConfirmModal
          isVisible={logoutVisible}
          title="Logging out?"
          message="You'll need to sign back in to access FitTrack."
          yesLabel="Sign Out"
          noLabel="Cancel"
          yesIcon={LogOut}
          isDestructive
          isLoading={isLoggingOut}
          loadingLabel="LEAVING"
          loadingTitle="See you next time!"
          onNo={() => setLogoutVisible(false)}
          onYes={handleLogoutConfirm}
        />
      ) : null}
      {isReservationOpen ? (
        <ReservationModal
          isVisible={isReservationOpen}
          onClose={() => setReservationOpen(false)}
          onSuccess={() => {
            fireBookingRefresh();
          }}
        />
      ) : null}
      <SettingsModal
        visible={notificationsVisible}
        title="Notifications"
        icon={Bell}
        onClose={() => setNotificationsVisible(false)}
      >
        <NotificationInboxPanel onClose={() => setNotificationsVisible(false)} />
      </SettingsModal>
      <SettingsModal
        visible={helpVisible && !isBrodigyMembershipLocked}
        title={activeHelpTitle}
        icon={HelpCircle}
        showFixedCloseButton
        showScrollHint
        fixedFooterAccessory={
          autoHelpTab === activeTab && isAutoHelpEligible ? (
            <AutoHelpDismissCheckbox
              checked={neverAutoHelpChecked}
              onToggle={() => setNeverAutoHelpChecked((checked) => !checked)}
            />
          ) : undefined
        }
        onClose={handleHelpClose}
      >
        <MobileHelpPanel content={activeHelpContent} />
      </SettingsModal>
      {helpDismissScopeVisible && !isBrodigyMembershipLocked ? (
        <ConfirmModal
          isVisible={helpDismissScopeVisible}
          title="Hide automatic Help?"
          message="Apply this choice to every automatic Help modal or only this screen? You can turn automatic Help back on in Settings."
          yesLabel="All Help"
          noLabel="Just This"
          yesIcon={HelpCircle}
          onNo={() => {
            void handleDismissCurrentHelp();
          }}
          onYes={() => {
            void handleDismissAllHelp();
          }}
        />
      ) : null}
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <FABStateProvider>
      <TabsLayoutInner />
    </FABStateProvider>
  );
}
