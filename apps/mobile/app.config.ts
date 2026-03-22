import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "FitTrack",
  slug: "fittrack-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#111111",
  },
  ios: { supportsTablet: false },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#111111",
    },
  },
  plugins: [
    "expo-router",
    "expo-camera",
    ["expo-notifications", { icon: "./assets/icon.png", color: "#E87722" }],
  ],
  scheme: "fittrack",
  experiments: { typedRoutes: true },
};

export default config;