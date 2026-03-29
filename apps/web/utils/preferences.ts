import { createLegacyThemePreferenceKey, createThemePreferenceKey } from "@fittrack/app-core";
import type { ThemeSettings } from "@fittrack/types";

export function loadPreferences(userId: string): Partial<ThemeSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(createThemePreferenceKey(userId)) ?? localStorage.getItem(createLegacyThemePreferenceKey(userId));
    return raw ? (JSON.parse(raw) as Partial<ThemeSettings>) : {};
  } catch {
    return {};
  }
}

export function savePreferences(userId: string, settings: ThemeSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(createThemePreferenceKey(userId), JSON.stringify(settings));
    localStorage.removeItem(createLegacyThemePreferenceKey(userId));
  } catch {
    return;
  }
}
