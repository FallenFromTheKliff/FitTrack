import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Tabs, useRouter, useSegments } from "expo-router";
import { LogOut } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { FABStateProvider, useFABState } from "@/contexts/FABStateContext";
import { type TabKey } from "@/data/labels";

import FitFAB from "@/components/fit/FitFAB";
import FitFABMenu from "@/components/fit/FitFABMenu";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ReservationModal from "@/components/modals/booking/ReservationModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";

const TAB_ROUTES: TabKey[] = [
  "home", "facilities", "bookings", "nutrition", "workout",
  "chathistory", "chatbot", "profile", "settings"
];

const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  tabBarStyle: { display: "none" as const }
};

const s = StyleSheet.create({
  container: { flex: 1 },
  screenArea: { flex: 1 }
});

function TabsLayoutInner() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const router = useRouter();
  const segments = useSegments();
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

  const { opacity } = usePassageAnim();
  const entranceStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const containerBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.base }));
  const overlayOpacity = useSharedValue(0);
  const overlayAnimStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const activeTab: TabKey = TAB_ROUTES.find((r) => segments.includes(r as never)) ?? "home";
  const isChatScreen = segments.includes("chatbot" as never);
  const showBackButton = isChatScreen;
  const showOverlay = isSidebarOpen || isFabOpen;

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
    if (user?.role === "ADMIN") {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, router, user?.role]);

  const handleMenuPress = () => {
    if (isFabOpen || isCameraActive) return;
    setSidebarOpen(!isSidebarOpen);
  };

  const handleFabPress = (nowOpen: boolean) => {
    setFabOpen(nowOpen);
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
        activeTab={activeTab}
        showBack={showBackButton}
        onBackPress={handleBack}
        isDimmed={isSidebarOpen}
      />
      <Animated.View style={[s.screenArea, containerBgStyle]}>
        <Tabs screenOptions={TAB_SCREEN_OPTIONS}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="home" />
          <Tabs.Screen name="facilities" />
          <Tabs.Screen name="bookings" />
          <Tabs.Screen name="nutrition" />
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
            setReservationOpen(false);
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
