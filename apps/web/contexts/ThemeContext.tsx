"use client";
import { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect, type ReactNode } from "react";

import { themes, THEME_IS_DARK, THEME_ACCENT_COLOR, DEFAULT_THEME, WEB_FONT_CLASSES, DEFAULT_FONT } from "@fittrack/ui";
import type { IThemeContext, ThemeKey, FontKey, ThemeSettings } from "@fittrack/types";
import { createThemeController, type ThemeControllerState } from "@fittrack/app-core";
import { getReadableTextColor } from "@fittrack/utils";
import { loadPreferences, savePreferences } from "@/utils/preferences";

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
  const controller = useMemo(() => createThemeController({
    defaultSettings: DEFAULT_SETTINGS,
    storage: {
      load: async (userId: string) => loadPreferences(userId),
      save: async (userId: string, settings: ThemeSettings) => { savePreferences(userId, settings); }
    }
  }), []);
  const [state, setState] = useState(() => controller.createInitialState());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stateRef = useRef(state);
  const isFirstMount = useRef(true);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activeFont, activeThemeKey } = controller.getResolvedState(state);
  const activeAccentColor = THEME_ACCENT_COLOR[activeThemeKey];
  const activeColors = themes[activeThemeKey];
  const onBrandTextColor = activeColors.onBrand ?? getReadableTextColor(activeColors.brand, activeColors.textPrimary, themes.sunlight.surface);

  const syncState = useCallback((nextState: ThemeControllerState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const resolveReadableTextColor = useCallback((background: string) => {
    return getReadableTextColor(background, activeColors.textPrimary, themes.sunlight.surface);
  }, [activeColors.textPrimary]);

  const triggerTransition = useCallback((useAnim: boolean) => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!useAnim) return;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  const runPersistedUpdate = useCallback((action: (currentState: ThemeControllerState) => Promise<ThemeControllerState>) => {
    void action(stateRef.current).then((nextState) => {
      syncState(nextState);
      triggerTransition(nextState.settings.animationLevel !== "none");
    });
  }, [syncState, triggerTransition]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const theme = themes[activeThemeKey] as Record<string, string>;
    Object.entries(theme).forEach(([k, v]) => {
      const cssKey = `--fit-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      try { document.documentElement.style.setProperty(cssKey, v); } catch {}
    });
    try { document.documentElement.classList.toggle("dark", !!THEME_IS_DARK[activeThemeKey]); } catch {}
  }, [activeThemeKey]);

  const loadUserSettings = useCallback(async (userId: string) => {
    syncState(await controller.loadUserSettings(stateRef.current, userId));
  }, [controller, syncState]);

  const clearUserSettings = useCallback(() => {
    syncState(controller.clearUserSettings(stateRef.current));
  }, [controller, syncState]);

  const setTheme = useCallback((key: ThemeKey) => {
    runPersistedUpdate((currentState) => controller.setTheme(currentState, key));
  }, [controller, runPersistedUpdate]);

  const setFont = useCallback((key: FontKey) => {
    runPersistedUpdate((currentState) => controller.setFont(currentState, key));
  }, [controller, runPersistedUpdate]);

  const setAppearance = useCallback((themeKey: ThemeKey, fontKey: FontKey) => {
    runPersistedUpdate((currentState) => controller.setAppearance(currentState, themeKey, fontKey));
  }, [controller, runPersistedUpdate]);

  const resetAppearance = useCallback(() => {
    runPersistedUpdate((currentState) => controller.resetAppearance(currentState));
  }, [controller, runPersistedUpdate]);

  const setAnimationLevel = useCallback((level: "full" | "minimal" | "none") => {
    runPersistedUpdate((currentState) => controller.setAnimationLevel(currentState, level));
  }, [controller, runPersistedUpdate]);

  const saveAllAppearance = useCallback((themeKey: ThemeKey, fontKey: FontKey, animationLevel: "full" | "minimal" | "none") => {
    runPersistedUpdate((currentState) => controller.saveAllAppearance(currentState, themeKey, fontKey, animationLevel));
  }, [controller, runPersistedUpdate]);

  const previewTheme = useCallback((key: ThemeKey | null) => {
    const currentState = stateRef.current;
    syncState(controller.previewTheme(currentState, key));
    triggerTransition(currentState.settings.animationLevel !== "none");
  }, [controller, syncState, triggerTransition]);

  const previewFont = useCallback((key: FontKey | null) => {
    syncState(controller.previewFont(stateRef.current, key));
  }, [controller, syncState]);

  return (
    <ThemeContext.Provider
      value={{
        colors: activeColors,
        activeFont,
        activeThemeKey,
        prevThemeKey: state.prevThemeKey,
        activeFontColor: activeAccentColor,
        activeIconColor: activeAccentColor,
        onBrandTextColor,
        getReadableTextColor: resolveReadableTextColor,
        settings: state.settings,
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
