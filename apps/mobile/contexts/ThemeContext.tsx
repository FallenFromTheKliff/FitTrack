import { createContext, useContext, useState, useRef, useMemo, useCallback, type ReactNode } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { themes, THEME_IS_DARK, THEME_ACCENT_COLOR, DEFAULT_THEME, FONT_FAMILIES, DEFAULT_FONT } from "@fittrack/ui";
import type { AnimationLevel, IThemeContext, ThemeKey, FontKey, ThemeSettings } from "@fittrack/types";
import { createMobileThemePreferenceKey, createThemeController, type ThemeControllerState } from "@fittrack/app-core";

interface IMobileThemeContext extends IThemeContext {
  themeTransitionAnim: SharedValue<number>;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  themeKey: DEFAULT_THEME,
  fontKey: DEFAULT_FONT,
  animationLevel: "full"
};

const ThemeContext = createContext<IMobileThemeContext | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => createThemeController({
    defaultSettings: DEFAULT_SETTINGS,
    storage: {
      load: async (userId: string) => {
        try {
          const stored = await AsyncStorage.getItem(createMobileThemePreferenceKey(userId));
          return stored ? JSON.parse(stored) as Partial<ThemeSettings> : {};
        } catch {
          return {};
        }
      },
      save: async (userId: string, settings: ThemeSettings) => {
        try {
          await AsyncStorage.setItem(createMobileThemePreferenceKey(userId), JSON.stringify(settings));
        } catch {}
      }
    }
  }), []);
  const [state, setState] = useState(() => controller.createInitialState());
  const themeTransitionAnim = useSharedValue(1);
  const stateRef = useRef(state);
  const isFirstMount = useRef(true);
  const { activeFont, activeThemeKey } = controller.getResolvedState(state);
  const activeFontColor = THEME_ACCENT_COLOR[activeThemeKey];
  const activeIconColor = activeFontColor;

  const syncState = useCallback((nextState: ThemeControllerState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

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

  const runPersistedUpdate = useCallback((action: (currentState: ThemeControllerState) => Promise<ThemeControllerState>) => {
    void action(stateRef.current).then((nextState) => {
      syncState(nextState);
      triggerTransitionAnim(nextState.settings.animationLevel !== "none");
    });
  }, [syncState, triggerTransitionAnim]);

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

  const setAnimationLevel = useCallback((level: AnimationLevel) => {
    runPersistedUpdate((currentState) => controller.setAnimationLevel(currentState, level));
  }, [controller, runPersistedUpdate]);

  const saveAllAppearance = useCallback((themeKey: ThemeKey, fontKey: FontKey, animationLevel: AnimationLevel) => {
    runPersistedUpdate((currentState) => controller.saveAllAppearance(currentState, themeKey, fontKey, animationLevel));
  }, [controller, runPersistedUpdate]);

  const previewTheme = useCallback(
    (key: ThemeKey | null) => {
      const currentState = stateRef.current;
      syncState(controller.previewTheme(currentState, key));
      triggerTransitionAnim(currentState.settings.animationLevel !== "none");
    },
    [controller, syncState, triggerTransitionAnim]
  );

  const previewFont = useCallback((key: FontKey | null) => {
    syncState(controller.previewFont(stateRef.current, key));
  }, [controller, syncState]);

  return (
    <ThemeContext.Provider
      value={{
        colors: themes[activeThemeKey],
        activeFont,
        activeThemeKey,
        prevThemeKey: state.prevThemeKey,
        activeFontColor,
        activeIconColor,
        settings: state.settings,
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
