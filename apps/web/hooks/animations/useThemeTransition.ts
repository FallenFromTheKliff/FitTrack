"use client";
import { useTheme } from "@/contexts/ThemeContext";

export function useThemeTransition(): string {
  const { settings } = useTheme();
  if (settings.animationLevel !== "full") return "";
  return "transition-colors duration-[280ms] ease-linear";
}