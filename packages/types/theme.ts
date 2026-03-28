import type { AnimationLevel, FontKey, ThemeKey } from "./base";

export type ThemeColors = {
  brand: string;
  onBrand: string;
  brandLight: string;
  base: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  fieldBg: string;
  fieldBorder: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
};

export interface ThemeSettings {
  themeKey: ThemeKey;
  fontKey: FontKey;
  animationLevel: AnimationLevel;
}

export interface IThemeContext {
  colors: ThemeColors;
  activeFont: FontKey;
  activeThemeKey: ThemeKey;
  prevThemeKey: ThemeKey;
  activeFontColor: string | null;
  activeIconColor: string | null;
  settings: ThemeSettings;
  loadUserSettings: (userId: string) => Promise<void>;
  clearUserSettings: () => void;
  setTheme: (key: ThemeKey) => void;
  setFont: (key: FontKey) => void;
  setAppearance: (themeKey: ThemeKey, fontKey: FontKey) => void;
  resetAppearance: () => void;
  setAnimationLevel: (level: AnimationLevel) => void;
  saveAllAppearance: (themeKey: ThemeKey, fontKey: FontKey, animationLevel: AnimationLevel) => void;
  previewTheme: (key: ThemeKey | null) => void;
  previewFont: (key: FontKey | null) => void;
}

export interface StorageAdapter {
  get: (key: string) => Promise<string | null>;
  set: (key: string, val: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}