import type { ThemeSettings } from "@fittrack/types";

const KEY = (userId: string) => `mock_prefs_${userId}`;

export function loadPreferences(userId: string): Partial<ThemeSettings> {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem(KEY(userId));
        return raw ? (JSON.parse(raw) as Partial<ThemeSettings>) : {};
    } catch { return {}; }
}

export function savePreferences(userId: string, settings: ThemeSettings): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(KEY(userId), JSON.stringify(settings));
    } catch {}
}