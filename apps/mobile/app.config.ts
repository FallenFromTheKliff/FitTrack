import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "FitTrack",
  slug: "fittrack-mobile",
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
    bundleIdentifier: "com.fittrack.mobile",
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/expo/android-icon-foreground.png",
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
  scheme: "fittrack",
  experiments: { typedRoutes: true },
};

export default config;
