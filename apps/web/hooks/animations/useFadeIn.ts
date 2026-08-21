"use client";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

import { useTheme } from "@/contexts/ThemeContext";

type FadeInOptions = {
  fromY?: number;
  duration?: number;
};

export function useFadeIn({ fromY = 16, duration = 220 }: FadeInOptions = {}): CSSProperties {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) {
      setVisible(true);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [shouldAnimate]);

  if (!shouldAnimate) return {};

  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : `translateY(${fromY}px)`,
    transition: `opacity ${duration}ms ease, transform ${duration}ms ease`
  };
}