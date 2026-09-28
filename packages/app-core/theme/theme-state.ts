import type { FontKey, ThemeKey, ThemeSettings } from "@fittrack/types";

export type ThemeControllerState = {
  currentUserId: string | null;
  prevThemeKey: ThemeKey;
  previewFontKey: FontKey | null;
  previewThemeKey: ThemeKey | null;
  settings: ThemeSettings;
};

export function createThemePreferenceKey(userId: string) {
  return `fittrack_prefs_${userId}`;
}

export function createLegacyThemePreferenceKey(userId: string) {
  return `mock_prefs_${userId}`;
}

export function createMobileThemePreferenceKey(userId: string) {
  return `fittrack_mobile_theme_${userId}`;
}

export function createThemeControllerState(defaultSettings: ThemeSettings): ThemeControllerState {
  return {
    currentUserId: null,
    prevThemeKey: defaultSettings.themeKey,
    previewFontKey: null,
    previewThemeKey: null,
    settings: defaultSettings
  };
}

export function getResolvedThemeState(state: ThemeControllerState) {
  return {
    activeFont: state.previewFontKey ?? state.settings.fontKey,
    activeThemeKey: state.previewThemeKey ?? state.settings.themeKey
  };
}