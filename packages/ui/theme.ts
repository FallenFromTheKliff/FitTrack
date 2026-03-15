import type { ThemeColors } from "./tokens";
import type { ThemeKey } from "../types";

export const themes: Record<ThemeKey, ThemeColors> = {
  night: {
    brand: "#E87722",
    brandLight: "#FDE9D4",
    base: "#111111",
    surface: "#1E1E1E",
    surfaceRaised: "#252525",
    border: "#3A3A3A",
    borderStrong: "#555555",
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0A0",
    textMuted: "#666666",
    textDisabled: "#444444",
    fieldBg: "#1A1A1A",
    fieldBorder: "#3A3A3A",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    overlay: "rgba(0,0,0,0.85)"
  },
  sunlight: {
    brand: "#E87722",
    brandLight: "#FDE9D4",
    base: "#FFF8F0",
    surface: "#FFFFFF",
    surfaceRaised: "#FFF3E8",
    border: "#F0D0B8",
    borderStrong: "#E0A878",
    textPrimary: "#1A0A00",
    textSecondary: "#6B3A1A",
    textMuted: "#A06040",
    textDisabled: "#C8A080",
    fieldBg: "#FFFFFF",
    fieldBorder: "#F0C8A0",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    overlay: "rgba(0,0,0,0.5)"
  },
  dark: {
    brand: "#A0A0A0",
    brandLight: "#2A2A2A",
    base: "#0A0A0A",
    surface: "#141414",
    surfaceRaised: "#1C1C1C",
    border: "#242424",
    borderStrong: "#383838",
    textPrimary: "#E0E0E0",
    textSecondary: "#A0A0A0",
    textMuted: "#686868",
    textDisabled: "#404040",
    fieldBg: "#202020",
    fieldBorder: "#505050",
    success: "#5AAA6A",
    warning: "#C0983A",
    danger: "#C06060",
    overlay: "rgba(10,10,10,0.92)"
  },
  light: {
    brand: "#888888",
    brandLight: "#F0F0F0",
    base: "#F0F4F8",
    surface: "#FFFFFF",
    surfaceRaised: "#F4F8FC",
    border: "#C0D0E0",
    borderStrong: "#7A9AB8",
    textPrimary: "#1E2832",
    textSecondary: "#4A6A8A",
    textMuted: "#7A9AB8",
    textDisabled: "#B0C4D4",
    fieldBg: "#E8EEF4",
    fieldBorder: "#9AB0C8",
    success: "#2A7A4A",
    warning: "#8A6020",
    danger: "#9E3A3A",
    overlay: "rgba(200,215,230,0.88)"
  },
  navy: {
    brand: "#8EA7C1",
    brandLight: "#1A2530",
    base: "#161C24",
    surface: "#1E2832",
    surfaceRaised: "#252D36",
    border: "#313B46",
    borderStrong: "#6D8196",
    textPrimary: "#BFCDDC",
    textSecondary: "#8EA7C1",
    textMuted: "#6D8196",
    textDisabled: "#4E5D6D",
    fieldBg: "#384757",
    fieldBorder: "#6D8196",
    success: "#6DC48A",
    warning: "#C4A27A",
    danger: "#C47A7A",
    overlay: "rgba(22,28,36,0.92)"
  },
};

export const DEFAULT_THEME: ThemeKey = "night";
export const THEME_LABELS: Record<ThemeKey, string> = {
  night: "SertFit Gym",
  sunlight: "Morning Rise",
  dark: "Night Hours",
  light: "Wavy Lights",
  navy: "Moody Blues"
};
export const THEME_IS_DARK: Record<ThemeKey, boolean> = {
  night: true,
  sunlight: false,
  dark: true,
  light: false,
  navy: true
};
export const THEME_ACCENT_COLOR: Record<ThemeKey, string> = {
  night: "#E87722",
  sunlight: "#E87722",
  dark: "#A0A0A0",
  light: "#888888",
  navy: "#8EA7C1"
};
