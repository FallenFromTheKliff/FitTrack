import type { ThemeSettings } from "@fittrack/types";

const LEGACY_KEY = (userId: string) => `mock_prefs_${userId}`;
const KEY = (userId: string) => `fittrack_prefs_${userId}`;

export function loadPreferences(userId: string): Partial<ThemeSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY(userId)) ?? localStorage.getItem(LEGACY_KEY(userId));
    return raw ? (JSON.parse(raw) as Partial<ThemeSettings>) : {};
  } catch {
    return {};
  }
}

export function savePreferences(userId: string, settings: ThemeSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(settings));
    localStorage.removeItem(LEGACY_KEY(userId));
  } catch {
    return;
  }
}
