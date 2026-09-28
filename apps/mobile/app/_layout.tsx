import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useQueryClient } from "@tanstack/react-query";

import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hydrateMobileApiAuth } from "@/lib/api-client";
import { QueryProvider } from "@/lib/queryClient";
import { FitnessProvider, useFitness } from "@/contexts/FitnessContext";
import { MAX_WIDTH } from "@fittrack/ui/tokens";

import SplashScreen from "@/components/loading/SplashScreen";
import FirstLoginPrivacyGate from "@/components/modals/settings/FirstLoginPrivacyGate";

const s = StyleSheet.create({
  gestureRoot: { flex: 1 },
  inner: { width: "100%", maxWidth: MAX_WIDTH, flex: 1 }
});

function AppProvidersInner({ children }: { children: ReactNode }) {
  const { loadUserSettings, clearUserSettings } = useTheme();
  const { loadFitnessData, clearFitnessData } = useFitness();
  const queryClient = useQueryClient();
  const [apiReady, setApiReady] = useState(false);

  const handleUserLoaded = useCallback(async (userId: string) => {
    await Promise.all([
      loadUserSettings(userId),
      loadFitnessData(userId)
    ]);
  }, [loadFitnessData, loadUserSettings]);

  const handleUserCleared = useCallback(() => {
    clearUserSettings();
    clearFitnessData();
    queryClient.clear();
  }, [clearFitnessData, clearUserSettings, queryClient]);

  useEffect(() => {
    let isMounted = true;
    void hydrateMobileApiAuth().finally(() => {
      if (isMounted) {
        setApiReady(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!apiReady) {
    return <SplashScreen onDone={() => {}} fontsReady={false} />;
  }

  return (
    <AuthProvider
      onUserLoaded={handleUserLoaded}
      onUserCleared={handleUserCleared}
    >
      {children}
      <PrivacyGateHost />
    </AuthProvider>
  );
}

function PrivacyGateHost() {
  const { acceptPrivacyPolicy, isAuthenticated, user } = useAuth();
  const shouldShowPrivacyGate =
    isAuthenticated && user?.hasAcceptedPrivacy === false;

  return (
    <FirstLoginPrivacyGate
      isVisible={shouldShowPrivacyGate}
      onAccept={acceptPrivacyPolicy}
    />
  );
}
function AppProviders({ children }: { children: ReactNode }) {
  return (
    <FitnessProvider>
      <QueryProvider>
        <AppProvidersInner>{children}</AppProvidersInner>
      </QueryProvider>
    </FitnessProvider>
  );
}

function RootContent() {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Blrrpix: require("../assets/fonts/blrrpixs016.ttf"),
    CaveatBrush: require("../assets/fonts/caveatbrush.ttf")
  });
  const [splashDone, setSplashDone] = useState(false);

  const outer = {
    flex: 1,
    backgroundColor: colors.base,
    alignItems: "center" as const,
    justifyContent: "center" as const
  };

  return (
    <AppProviders>
      <View style={outer}>
        <View style={[s.inner, { backgroundColor: colors.base }]}>
          {!splashDone ? (
            <SplashScreen
              onDone={() => setSplashDone(true)}
              fontsReady={fontsLoaded ?? false}
            />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.base }
              }}
            />
          )}
        </View>
      </View>
    </AppProviders>
  );
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={s.gestureRoot}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
