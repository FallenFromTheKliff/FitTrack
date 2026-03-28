export const R = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
} as const;

export const BORDER_RADIUS = {
  input: 8,
  card: 12,
  modal: 16,
} as const;

export const MAX_WIDTH = 450;

export const tokens = {
  colors: {
    brand: "#06b6d4",
    onBrand: "#FFFFFF",
    brandLight: "#5eead4",
    base: "#0f172a",
    surface: "#0b1220",
    surfaceRaised: "#0f172a",
    border: "#1f2937",
    borderStrong: "#111827",
    textPrimary: "#FFFFFF",
    textSecondary: "#94a3b8",
    textMuted: "#666666",
    textDisabled: "#444444",
    fieldBg: "#1A1A1A",
    fieldBorder: "#3A3A3A",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    overlay: "rgba(0,0,0,0.85)"
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
  radii: { input: 8, card: 12, modal: 16 },
  shadows: { card: "0 4px 16px rgba(0,0,0,0.4)" }
} as const;

export default tokens;

export type { ThemeColors } from "../types";