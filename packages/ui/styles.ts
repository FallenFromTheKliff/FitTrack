import type { FontKey } from "../types";

export const FONT_FAMILIES: Record<FontKey, string> = {
  standard: "System",
  retro: "Blrrpix",
  painter: "CaveatBrush"
};

export const WEB_FONT_CLASSES: Record<FontKey, string> = {
  standard: "",
  retro: "font-retro",
  painter: "font-painter"
};

export const FONT_LABELS: Record<FontKey, string> = {
  standard: "Standard",
  retro: "Retro",
  painter: "Painter"
};

export const DEFAULT_FONT: FontKey = "standard";

export const fitStyles = {
  screen: "flex-1 bg-base",
  card: "bg-surface rounded-card border border-border p-4",
  cardRaised: "bg-surface rounded-card border border-border p-4 shadow-card",
  input:
    "bg-field-bg border border-field-border rounded-input px-4 py-3 text-sm",
  label: "text-xs text-text-secondary mb-1",
  btnPrimary: "bg-brand rounded-input py-3 items-center justify-center",
  btnPrimaryText: "text-white font-semibold text-sm",
  btnGhost:
    "border border-border rounded-input py-3 items-center justify-center",
  btnGhostText: "text-text-secondary text-sm",
  btnDisabled: "opacity-60",
  heading: "text-2xl font-bold",
  subheading: "text-lg font-semibold",
  body: "text-text-secondary text-sm",
  muted: "text-text-muted text-xs",
  error: "text-danger text-xs",
  row: "flex-row items-center",
  rowBetween: "flex-row items-center justify-between",
  divider: "h-px bg-border my-3",
  badge: "rounded-full px-2 py-0.5 text-xs font-medium",
  badgeSuccess: "bg-success/20 text-success",
  badgeWarning: "bg-warning/20 text-warning",
  badgeDanger: "bg-danger/20 text-danger",
  badgeBrand: "bg-brand/20 text-brand"
} as const;

export type FitStyleKey = keyof typeof fitStyles;