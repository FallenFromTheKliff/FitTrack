import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Tabs, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { Bell, HelpCircle, LogOut } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { notificationUnreadCountQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BookingCheckoutRecoveryProvider } from "@/contexts/BookingCheckoutRecoveryContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { FABStateProvider, useFABState } from "@/contexts/FABStateContext";
import { type TabKey } from "@fittrack/app-config";

import { FitFAB, FitFABMenu } from "@/components/fit";
import Sidebar, { SIDEBAR_NAV_LABELS_BY_TAB } from "@/components/layout/Sidebar";
import {
  canOpenAutoHelpRequest,
  type SidebarLifecycleSnapshot,
  usesIosNativeModalCoordination,
} from "@/components/layout/sidebar-lifecycle";
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

type AutoHelpVisitStatus = "idle" | "checking" | "scheduled" | "handled";

const CLOSED_SIDEBAR_LIFECYCLE: SidebarLifecycleSnapshot = {
  phase: "closed",
  pendingAction: null,
};
const USE_IOS_MODAL_COORDINATION = usesIosNativeModalCoordination(Platform.OS);

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
    reservationRequest,
    setReservationOpen,
    fireBookingRefresh,
    isCameraActive
  } = useFABState();

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutInFlightRef = useRef(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [autoHelpTab, setAutoHelpTab] = useState<TabKey | null>(null);
  const [neverAutoHelpChecked, setNeverAutoHelpChecked] = useState(false);
  const [helpDismissScopeVisible, setHelpDismissScopeVisible] = useState(false);
  const [sidebarLifecycle, setSidebarLifecycle] = useState<SidebarLifecycleSnapshot>(
    CLOSED_SIDEBAR_LIFECYCLE,
  );
  const autoHelpRequestIdRef = useRef(0);
  const autoHelpFrameRef = useRef<number | null>(null);
  const helpFrameRef = useRef<number | null>(null);
  const autoHelpVisitRef = useRef<{
    key: string;
    status: AutoHelpVisitStatus;
  }>({ key: "", status: "idle" });
  const autoHelpContextRef = useRef<{
    activeTab: TabKey;
    isEligible: boolean;
    logoutHasPriority: boolean;
    sidebarLifecycle: SidebarLifecycleSnapshot;
    sidebarTransitionActive: boolean;
    userId: string | null;
  }>({
    activeTab: "home",
    isEligible: false,
    logoutHasPriority: false,
    sidebarLifecycle: CLOSED_SIDEBAR_LIFECYCLE,
    sidebarTransitionActive: false,
    userId: null,
  });

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
  const isIosSidebarTransitionActive =
    USE_IOS_MODAL_COORDINATION &&
    (isSidebarOpen || sidebarLifecycle.phase !== "closed");
  const logoutHasPriority =
    sidebarLifecycle.pendingAction === "logout" || logoutVisible || isLoggingOut;
  if (USE_IOS_MODAL_COORDINATION) {
    autoHelpContextRef.current = {
      activeTab,
      isEligible: isAutoHelpEligible,
      logoutHasPriority,
      sidebarLifecycle,
      sidebarTransitionActive: isIosSidebarTransitionActive,
      userId: user?.id ?? null,
    };
  }
  const isChatScreen = segments.includes("chatbot" as never);
  const showBackButton = isChatScreen;
  const showOverlay = isSidebarOpen || isFabOpen;
  const isFabPassthroughTab = activeTab === "nutrition" || activeTab === "mastery";
  const unreadCountQuery = useQuery({
    ...notificationUnreadCountQueryOptions(mobileApiClient, user?.id),
    enabled: Boolean(user?.id),
  });

  const cancelScheduledHelp = useCallback(() => {
    if (
      helpFrameRef.current !== null &&
      typeof cancelAnimationFrame !== "undefined"
    ) {
      cancelAnimationFrame(helpFrameRef.current);
    }
    helpFrameRef.current = null;
  }, []);

  const cancelScheduledAutoHelp = useCallback(() => {
    if (
      autoHelpFrameRef.current !== null &&
      typeof cancelAnimationFrame !== "undefined"
    ) {
      cancelAnimationFrame(autoHelpFrameRef.current);
    }
    autoHelpFrameRef.current = null;
  }, []);

  const openHelp = useCallback((nextAutoHelpTab: TabKey | null) => {
    if (!USE_IOS_MODAL_COORDINATION) {
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
      return;
    }

    autoHelpRequestIdRef.current += 1;
    cancelScheduledAutoHelp();
    cancelScheduledHelp();
    autoHelpVisitRef.current = {
      key: `${user?.id ?? ""}:${activeTab}`,
      status: "handled",
    };
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setAutoHelpTab(nextAutoHelpTab);
    setNeverAutoHelpChecked(false);
    if (typeof requestAnimationFrame !== "undefined") {
      helpFrameRef.current = requestAnimationFrame(() => {
        helpFrameRef.current = null;
        setHelpVisible(true);
      });
      return;
    }
    setHelpVisible(true);
  }, [activeTab, cancelScheduledAutoHelp, cancelScheduledHelp, user?.id]);

  useEffect(() => {
    if (!USE_IOS_MODAL_COORDINATION) return;
    return () => {
      autoHelpRequestIdRef.current += 1;
      cancelScheduledAutoHelp();
      cancelScheduledHelp();
    };
  }, [cancelScheduledAutoHelp, cancelScheduledHelp]);

  useEffect(() => {
    if (!USE_IOS_MODAL_COORDINATION) return;
    return () => {
      cancelScheduledHelp();
    };
  }, [activeTab, cancelScheduledHelp, isIosSidebarTransitionActive, logoutHasPriority, user?.id]);

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
    if (USE_IOS_MODAL_COORDINATION) return;
    if (!user?.id || !isAutoHelpEligible) return;
    let isMounted = true;
    isAutoHelpDismissed(user.id, activeTab)
      .then((dismissed) => {
        if (!isMounted || dismissed) return;
        if (typeof document !== "undefined") {
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        setAutoHelpTab(activeTab);
        setNeverAutoHelpChecked(false);
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => setHelpVisible(true));
          return;
        }
        setHelpVisible(true);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [activeTab, isAutoHelpEligible, user?.id]);

  useEffect(() => {
    if (!USE_IOS_MODAL_COORDINATION) return;
    const userId = user?.id;
    const visitKey = `${userId ?? ""}:${activeTab}`;
    if (autoHelpVisitRef.current.key !== visitKey) {
      autoHelpVisitRef.current = { key: visitKey, status: "idle" };
    }

    const requestId = autoHelpRequestIdRef.current + 1;
    autoHelpRequestIdRef.current = requestId;
    cancelScheduledAutoHelp();

    if (
      !userId ||
      !isAutoHelpEligible ||
      isIosSidebarTransitionActive ||
      logoutHasPriority ||
      autoHelpVisitRef.current.status === "handled"
    ) {
      return;
    }

    autoHelpVisitRef.current.status = "checking";
    let cancelled = false;
    const isCurrentRequest = () => {
      const current = autoHelpContextRef.current;
      return !cancelled && canOpenAutoHelpRequest({
        requestId,
        currentRequestId: autoHelpRequestIdRef.current,
        expectedUserId: userId,
        currentUserId: current.userId,
        expectedScreen: activeTab,
        currentScreen: current.activeTab,
        isEligible: current.isEligible,
        sidebarTransitionActive: current.sidebarTransitionActive,
        sidebarLifecycle: current.sidebarLifecycle,
        logoutHasPriority: current.logoutHasPriority,
      });
    };
    const resetPendingVisit = () => {
      if (
        autoHelpVisitRef.current.key === visitKey &&
        autoHelpVisitRef.current.status !== "handled"
      ) {
        autoHelpVisitRef.current.status = "idle";
      }
    };

    isAutoHelpDismissed(userId, activeTab)
      .then((dismissed) => {
        if (!isCurrentRequest()) {
          resetPendingVisit();
          return;
        }
        if (dismissed) {
          autoHelpVisitRef.current.status = "handled";
          return;
        }

        autoHelpVisitRef.current.status = "scheduled";
        const revealHelp = () => {
          autoHelpFrameRef.current = null;
          if (!isCurrentRequest()) {
            resetPendingVisit();
            return;
          }
          autoHelpVisitRef.current.status = "handled";
          setAutoHelpTab(activeTab);
          setNeverAutoHelpChecked(false);
          setHelpVisible(true);
        };
        if (typeof requestAnimationFrame !== "undefined") {
          autoHelpFrameRef.current = requestAnimationFrame(revealHelp);
          return;
        }
        revealHelp();
      })
      .catch(() => {
        if (isCurrentRequest()) {
          autoHelpVisitRef.current.status = "handled";
        }
      });

    return () => {
      cancelled = true;
      if (autoHelpRequestIdRef.current === requestId) {
        autoHelpRequestIdRef.current += 1;
      }
      cancelScheduledAutoHelp();
      resetPendingVisit();
    };
  }, [
    activeTab,
    cancelScheduledAutoHelp,
    isAutoHelpEligible,
    isIosSidebarTransitionActive,
    logoutHasPriority,
    user?.id,
  ]);

  useEffect(() => {
    if (!isBrodigyMembershipLocked) return;
    setHelpVisible(false);
    setAutoHelpTab(null);
    setNeverAutoHelpChecked(false);
    setHelpDismissScopeVisible(false);
  }, [isBrodigyMembershipLocked]);

  const handleSidebarLifecycleChange = useCallback((snapshot: SidebarLifecycleSnapshot) => {
    setSidebarLifecycle((current) =>
      current.phase === snapshot.phase &&
      current.pendingAction === snapshot.pendingAction
        ? current
        : snapshot,
    );
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  const handleSidebarLogoutPress = useCallback(() => {
    if (logoutInFlightRef.current) return;
    setSidebarOpen(false);
    setFabOpen(false);
    setLogoutError(null);
    setLogoutVisible(true);
  }, [setFabOpen, setSidebarOpen]);

  const handleMenuPress = () => {
    if (isCameraActive) return;
    if (isFabOpen && !isFabPassthroughTab) return;
    if (USE_IOS_MODAL_COORDINATION && sidebarLifecycle.phase === "dismissing") return;
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
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setLogoutVisible(false);
    } catch {
      setLogoutError("Couldn't sign you out. Please try again.");
    } finally {
      logoutInFlightRef.current = false;
      setIsLoggingOut(false);
    }
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
          if (isFabPassthroughTab) setFabOpen(false);
          openHelp(null);
        }}
        onNotificationsPress={() => {
          if (isFabPassthroughTab) setFabOpen(false);
          setNotificationsVisible(true);
        }}
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
          pointerEvents={isFabPassthroughTab && isFabOpen && !isSidebarOpen ? "none" : "auto"}
          style={[StyleSheet.absoluteFill, { zIndex: 15 }, overlayAnimStyle]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
        </Animated.View>
      )}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
        onLifecycleChange={handleSidebarLifecycleChange}
        onLogoutPress={handleSidebarLogoutPress}
      />
      {fabConfig?.visible !== false && fabConfig && !isSidebarOpen && (
        <FitFAB
          backdropMode={isFabPassthroughTab ? "passthrough" : "dismiss"}
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
          message={logoutError ?? "You'll need to sign back in to access FitTrack."}
          yesLabel="Sign Out"
          noLabel="Cancel"
          yesIcon={LogOut}
          isDestructive
          isLoading={isLoggingOut}
          loadingLabel="LEAVING"
          loadingTitle="See you next time!"
          onNo={() => {
            if (logoutInFlightRef.current) return;
            setLogoutError(null);
            setLogoutVisible(false);
          }}
          onYes={handleLogoutConfirm}
        />
      ) : null}
      {isReservationOpen ? (
        <ReservationModal
          isVisible={isReservationOpen}
          preselectedVenueId={reservationRequest.preselectedVenueId}
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
    <BookingCheckoutRecoveryProvider>
      <FABStateProvider>
        <TabsLayoutInner />
      </FABStateProvider>
    </BookingCheckoutRecoveryProvider>
  );
}
