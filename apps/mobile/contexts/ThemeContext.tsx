import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { themes, THEME_IS_DARK, THEME_ACCENT_COLOR, DEFAULT_THEME, FONT_FAMILIES, DEFAULT_FONT } from "@fittrack/ui";
import type { AnimationLevel, IThemeContext, ThemeKey, FontKey, ThemeSettings } from "@fittrack/types";

interface IMobileThemeContext extends IThemeContext {
  themeTransitionAnim: SharedValue<number>;
}

const STORAGE_KEY = (userId: string) => `fittrack_mobile_theme_${userId}`;
const DEFAULT_SETTINGS: ThemeSettings = {
  themeKey: DEFAULT_THEME,
  fontKey: DEFAULT_FONT,
  animationLevel: "full"
};

const ThemeContext = createContext<IMobileThemeContext | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [previewThemeKey, setPreviewThemeKey] = useState<ThemeKey | null>(null);
  const [previewFontKey, setPreviewFontKey] = useState<FontKey | null>(null);

  const currentUserId = useRef<string | null>(null);
  const themeTransitionAnim = useSharedValue(1);
  const isFirstMount = useRef(true);
  const prevThemeKeyRef = useRef<ThemeKey>(DEFAULT_SETTINGS.themeKey);

  const activeThemeKey: ThemeKey = previewThemeKey ?? settings.themeKey;
  const activeFont: FontKey = previewFontKey ?? settings.fontKey;
  const activeFontColor = THEME_ACCENT_COLOR[activeThemeKey];
  const activeIconColor = activeFontColor;

  const triggerTransitionAnim = useCallback(
    (useAnim: boolean) => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      if (!useAnim) {
        themeTransitionAnim.value = 1;
        return;
      }
      themeTransitionAnim.value = 0.4;
      themeTransitionAnim.value = withTiming(1, { duration: 280 });
    },
    [themeTransitionAnim]
  );

  const saveSettings = useCallback(
    async (updated: ThemeSettings) => {
      prevThemeKeyRef.current = activeThemeKey;
      setSettings(updated);
      triggerTransitionAnim(updated.animationLevel !== "none");
      if (!currentUserId.current) return;
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY(currentUserId.current),
          JSON.stringify(updated),
        );
      } catch {}
    },
    [activeThemeKey, triggerTransitionAnim]
  );

  const loadUserSettings = useCallback(async (userId: string) => {
    currentUserId.current = userId;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY(userId));
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      else setSettings(DEFAULT_SETTINGS);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
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
    (themeKey: ThemeKey, fontKey: FontKey) =>
      saveSettings({ ...settings, themeKey, fontKey }),
    [settings, saveSettings]
  );
  const resetAppearance = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setPreviewThemeKey(null);
    setPreviewFontKey(null);
  }, [saveSettings]);
  const setAnimationLevel = useCallback(
    (level: AnimationLevel) => saveSettings({ ...settings, animationLevel: level }),
    [settings, saveSettings]
  );
  const saveAllAppearance = useCallback(
    (themeKey: ThemeKey, fontKey: FontKey, animationLevel: AnimationLevel) =>
      saveSettings({ ...settings, themeKey, fontKey, animationLevel }),
    [settings, saveSettings]
  );

  const previewTheme = useCallback(
    (key: ThemeKey | null) => {
      prevThemeKeyRef.current = activeThemeKey;
      triggerTransitionAnim(settings.animationLevel !== "none");
      setPreviewThemeKey(key);
    },
    [activeThemeKey, settings.animationLevel, triggerTransitionAnim]
  );

  const previewFont = useCallback((key: FontKey | null) => setPreviewFontKey(key), []);

  return (
    <ThemeContext.Provider
      value={{
        colors: themes[activeThemeKey],
        activeFont,
        activeThemeKey,
        prevThemeKey: prevThemeKeyRef.current,
        activeFontColor,
        activeIconColor,
        settings,
        themeTransitionAnim,
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

export function useFontFamily(): string {
  const { activeFont } = useTheme();
  return FONT_FAMILIES[activeFont];
}
export function useIsDark(): boolean {
  const { activeThemeKey } = useTheme();
  return THEME_IS_DARK[activeThemeKey];
}
export function useTheme(): IMobileThemeContext {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
