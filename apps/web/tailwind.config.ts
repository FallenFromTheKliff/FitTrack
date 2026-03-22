import type { Config } from "tailwindcss";

import { FitPreset } from "@fittrack/ui/tailwind-preset";

const config: Config = {
  presets: [FitPreset as Partial<Config>],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        retro: ["var(--font-retro)"],
        painter: ["var(--font-painter)"]
      },
      colors: {
        brand: "var(--fit-brand)",
        "on-brand": "var(--fit-on-brand)",
        "brand-light": "var(--fit-brand-light)",
        base: "var(--fit-base)",
        surface: "var(--fit-surface)",
        "surface-raised": "var(--fit-surface-raised)",
        border: "var(--fit-border)",
        "border-strong": "var(--fit-border-strong)",
        "text-primary": "var(--fit-text-primary)",
        "text-secondary": "var(--fit-text-secondary)",
        "text-muted": "var(--fit-text-muted)",
        "text-disabled": "var(--fit-text-disabled)",
        "field-bg": "var(--fit-field-bg)",
        "field-border": "var(--fit-field-border)",
        success: "var(--fit-success)",
        warning: "var(--fit-warning)",
        danger: "var(--fit-danger)"
      }
    }
  }
};

export default config;