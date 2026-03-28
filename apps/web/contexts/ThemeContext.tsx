"use client";
import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";

import { themes, THEME_IS_DARK, THEME_ACCENT_COLOR, DEFAULT_THEME, WEB_FONT_CLASSES, DEFAULT_FONT } from "@fittrack/ui";
import type { IThemeContext, ThemeKey, FontKey, ThemeSettings } from "@fittrack/types";
import { loadPreferences, savePreferences } from "@/utils/preferences";
import { getReadableTextColor } from "@/utils/contrast";

export interface IWebThemeContext extends IThemeContext {
    isTransitioning: boolean;
    onBrandTextColor: string;
    getReadableTextColor: (background: string) => string;
}

const DEFAULT_SETTINGS: ThemeSettings = {
    themeKey: DEFAULT_THEME,
    fontKey: DEFAULT_FONT,
    animationLevel: "full"
};

const ThemeContext = createContext<IWebThemeContext | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
    const [previewThemeKey, setPreviewThemeKey] = useState<ThemeKey | null>(null);
    const [previewFontKey, setPreviewFontKey] = useState<FontKey | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const currentUserId = useRef<string | null>(null);
    const isFirstMount = useRef(true);
    const prevThemeKeyRef = useRef<ThemeKey>(DEFAULT_SETTINGS.themeKey);
    const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeThemeKey: ThemeKey = previewThemeKey ?? settings.themeKey;
    const activeFont: FontKey = previewFontKey ?? settings.fontKey;
    const activeAccentColor = THEME_ACCENT_COLOR[activeThemeKey];
    const activeColors = themes[activeThemeKey];
    const onBrandTextColor = activeColors.onBrand ?? getReadableTextColor(activeColors.brand, activeColors.textPrimary, themes.sunlight.surface);

    const resolveReadableTextColor = useCallback((background: string) => {
        return getReadableTextColor(background, activeColors.textPrimary, themes.sunlight.surface);
    }, [activeColors.textPrimary]);

    const triggerTransition = useCallback((useAnim: boolean) => {
        if (isFirstMount.current) { isFirstMount.current = false; return; }
        if (!useAnim) return;
        if (transitionTimer.current) clearTimeout(transitionTimer.current);
        setIsTransitioning(true);
        transitionTimer.current = setTimeout(() => setIsTransitioning(false), 300);
    }, []);

    useEffect(() => {
        const theme = themes[activeThemeKey] as Record<string, string>;
        Object.entries(theme).forEach(([k, v]) => {
            const cssKey = `--fit-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
            try { document.documentElement.style.setProperty(cssKey, v); } catch {
                // Ignore CSS variable write issues in non-browser environments.
            }
        });
        try { document.documentElement.classList.toggle("dark", !!THEME_IS_DARK[activeThemeKey]); } catch {
            // Ignore document class toggling issues in non-browser environments.
        }
    }, [activeThemeKey]);

    const saveSettings = useCallback((updated: ThemeSettings) => {
        prevThemeKeyRef.current = activeThemeKey;
        setSettings(updated);
        triggerTransition(updated.animationLevel !== "none");
        if (currentUserId.current) savePreferences(currentUserId.current, updated);
    }, [activeThemeKey, triggerTransition]);

    const loadUserSettings = useCallback(async (userId: string) => {
        currentUserId.current = userId;
        const saved = loadPreferences(userId);
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
    }, []);

    const clearUserSettings = useCallback(() => {
        currentUserId.current = null;
        setSettings(DEFAULT_SETTINGS);
        setPreviewThemeKey(null);
        setPreviewFontKey(null);
    }, []);

    const setTheme = useCallback(
        (key: ThemeKey) => saveSettings({ ...settings, themeKey: key }),
        [settings, saveSettings]
    );
    const setFont = useCallback(
        (key: FontKey) => saveSettings({ ...settings, fontKey: key }),
        [settings, saveSettings]
    );
    const setAppearance = useCallback(
        (themeKey: ThemeKey, fontKey: FontKey) => saveSettings({ ...settings, themeKey, fontKey }),
        [settings, saveSettings]
    );
    const resetAppearance = useCallback(() => {
        saveSettings(DEFAULT_SETTINGS);
        setPreviewThemeKey(null);
        setPreviewFontKey(null);
    }, [saveSettings]);
    const setAnimationLevel = useCallback(
        (level: "full" | "minimal" | "none") => saveSettings({ ...settings, animationLevel: level }),
        [settings, saveSettings]
    );
    const saveAllAppearance = useCallback(
        (themeKey: ThemeKey, fontKey: FontKey, animationLevel: "full" | "minimal" | "none") => {
            setPreviewThemeKey(null);
            setPreviewFontKey(null);
            saveSettings({ ...settings, themeKey, fontKey, animationLevel });
        },
        [settings, saveSettings]
    );
    const previewTheme = useCallback(
        (key: ThemeKey | null) => {
            prevThemeKeyRef.current = activeThemeKey;
            triggerTransition(settings.animationLevel !== "none");
            setPreviewThemeKey(key);
        },
        [activeThemeKey, settings.animationLevel, triggerTransition]
    );
    const previewFont = useCallback((key: FontKey | null) => setPreviewFontKey(key), []);

    return (
        <ThemeContext.Provider
            value={{
                colors: activeColors,
                activeFont,
                activeThemeKey,
                prevThemeKey: prevThemeKeyRef.current,
                activeFontColor: activeAccentColor,
                activeIconColor: activeAccentColor,
                onBrandTextColor,
                getReadableTextColor: resolveReadableTextColor,
                settings,
                isTransitioning,
                loadUserSettings,
                clearUserSettings,
                setTheme,
                setFont,
                setAppearance,
                resetAppearance,
                setAnimationLevel,
                saveAllAppearance,
                previewTheme,
                previewFont
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useFontClass(): string {
    const { activeFont } = useTheme();
    return WEB_FONT_CLASSES[activeFont] || "";
}
export function useIsDark(): boolean {
    const { activeThemeKey } = useTheme();
    return THEME_IS_DARK[activeThemeKey];
}
export function useTheme(): IWebThemeContext {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
    return ctx;
}