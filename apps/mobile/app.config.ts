import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "FitTrack",
  slug: "fittrack-mobile",
  owner: "ewankoadduno",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/expo/icon.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/expo/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#111111",
  },
  ios: {
    icon: "./assets/brand/fittrack-logo.png",
    bundleIdentifier: "com.fittrack.sertfit",
    appleTeamId: "K7V68DW6NQ",
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/expo/android-icon-foreground.png",
      monochromeImage: "./assets/expo/android-icon-monochrome.png",
      backgroundImage: "./assets/expo/android-icon-background.png",
      backgroundColor: "#111111",
    },
    package: "com.fittrack.mobile",
  },
  plugins: [
    "expo-dev-client",
    "expo-router",
    "expo-camera",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "FitTrack needs camera access for live exercise detection and rep tracking.",
        enableFrameProcessors: true,
      },
    ],
    ["expo-notifications", { icon: "./assets/expo/android-icon-monochrome.png", color: "#E87722" }],
  ],
  web: {
    favicon: "./assets/expo/favicon.png",
  },
  scheme: "fittrack",
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: "dd8c89ab-07c0-4c8d-9ca7-2edb1e69d240",
    },
  },
};

export default config;
