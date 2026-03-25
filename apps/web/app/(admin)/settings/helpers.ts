import type { CSSProperties } from "react";
import type { FontKey, ThemeKey } from "@fittrack/types";

export const THEME_KEYS: ThemeKey[] = ["night", "sunlight", "dark", "light", "navy"];
export const FONT_KEYS: FontKey[] = ["standard", "retro", "painter"];

export const STATIC_FONT_PREVIEW_TEXT: Record<FontKey, string> = {
  standard: "Standard",
  retro: "Retro",
  painter: "Painter"
};

export const STATIC_FONT_PREVIEW_FAMILY: Record<FontKey, CSSProperties["fontFamily"]> = {
  standard: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  retro: "var(--font-retro), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  painter: "var(--font-painter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};
