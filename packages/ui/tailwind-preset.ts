import { tokens } from "@fittrack/ui/tokens";
import type { Config } from "tailwindcss";

export const FitPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: tokens.colors.brand,
        "brand-light": tokens.colors.brandLight,
        base: tokens.colors.base,
        surface: tokens.colors.surface,
        "surface-raised": tokens.colors.surfaceRaised,
        border: tokens.colors.border,
        "border-strong": tokens.colors.borderStrong,
        "text-secondary": tokens.colors.textSecondary,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        danger: tokens.colors.danger,
      },
      borderRadius: {
        input: `${tokens.radii.input}px`,
        card: `${tokens.radii.card}px`,
        modal: `${tokens.radii.modal}px`,
      },
      boxShadow: {
        card: tokens.shadows.card,
      },
    },
  },
};
