"use client";
import { useState, useCallback } from "react";
import type { CSSProperties } from "react";

import { useTheme } from "@/contexts/ThemeContext";

type ToggleAnimOptions = {
  duration?: number;
  closeDuration?: number;
};

export function useToggleAnim({ duration = 220, closeDuration }: ToggleAnimOptions = {}) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback((overrideOpen?: boolean) => {
    const opening = overrideOpen !== undefined ? overrideOpen : !isOpen;
    setIsOpen(opening);
    return opening;
  }, [isOpen]);

  const transitionStyle: CSSProperties = shouldAnimate
    ? { transition: `all ${isOpen ? duration : (closeDuration ?? duration)}ms ease` }
    : {};

  return { isOpen, toggle, transitionStyle };
}