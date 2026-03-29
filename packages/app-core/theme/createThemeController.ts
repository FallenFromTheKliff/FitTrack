import type { FontKey, ThemeKey, ThemeSettings } from "@fittrack/types";
import {
  createThemeControllerState,
  getResolvedThemeState,
  type ThemeControllerState
} from "./theme-state";

type ThemeStorageAdapter = {
  load: (userId: string) => Promise<Partial<ThemeSettings>>;
  save: (userId: string, settings: ThemeSettings) => Promise<void>;
};

type ThemeControllerConfig = {
  defaultSettings: ThemeSettings;
  storage: ThemeStorageAdapter;
};

export function createThemeController({ defaultSettings, storage }: ThemeControllerConfig) {
  async function persistSettings(state: ThemeControllerState, nextSettings: ThemeSettings) {
    const { activeThemeKey } = getResolvedThemeState(state);
    const nextState: ThemeControllerState = {
      ...state,
      prevThemeKey: activeThemeKey,
      settings: nextSettings
    };
    if (state.currentUserId) {
      await storage.save(state.currentUserId, nextSettings);
    }
    return nextState;
  }

  return {
    createInitialState() {
      return createThemeControllerState(defaultSettings);
    },
    getResolvedState(state: ThemeControllerState) {
      return getResolvedThemeState(state);
    },
    async loadUserSettings(state: ThemeControllerState, userId: string) {
      const saved = await storage.load(userId);
      return {
        ...state,
        currentUserId: userId,
        settings: { ...defaultSettings, ...saved }
      };
    },
    clearUserSettings(state: ThemeControllerState) {
      return {
        ...createThemeControllerState(defaultSettings),
        prevThemeKey: state.prevThemeKey
      };
    },
    async setTheme(state: ThemeControllerState, key: ThemeKey) {
      return persistSettings(state, { ...state.settings, themeKey: key });
    },
    async setFont(state: ThemeControllerState, key: FontKey) {
      return persistSettings(state, { ...state.settings, fontKey: key });
    },
    async setAppearance(state: ThemeControllerState, themeKey: ThemeKey, fontKey: FontKey) {
      return persistSettings(state, { ...state.settings, themeKey, fontKey });
    },
    async resetAppearance(state: ThemeControllerState) {
      return persistSettings({
        ...state,
        previewFontKey: null,
        previewThemeKey: null
      }, defaultSettings);
    },
    async setAnimationLevel(state: ThemeControllerState, animationLevel: ThemeSettings["animationLevel"]) {
      return persistSettings(state, { ...state.settings, animationLevel });
    },
    async saveAllAppearance(
      state: ThemeControllerState,
      themeKey: ThemeKey,
      fontKey: FontKey,
      animationLevel: ThemeSettings["animationLevel"]
    ) {
      return persistSettings({
        ...state,
        previewFontKey: null,
        previewThemeKey: null
      }, { ...state.settings, themeKey, fontKey, animationLevel });
    },
    previewTheme(state: ThemeControllerState, key: ThemeKey | null) {
      const { activeThemeKey } = getResolvedThemeState(state);
      return {
        ...state,
        prevThemeKey: activeThemeKey,
        previewThemeKey: key
      };
    },
    previewFont(state: ThemeControllerState, key: FontKey | null) {
      return {
        ...state,
        previewFontKey: key
      };
    }
  };
}