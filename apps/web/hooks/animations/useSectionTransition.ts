"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useTheme } from "@/contexts/ThemeContext";

type SectionTransitionOptions = {
  duration?: number;
  fromY?: number;
};

export function useSectionTransition<T>(
  value: T,
  { duration = 150, fromY = 8 }: SectionTransitionOptions = {},
) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel !== "none";
  const resolvedDuration =
    settings.animationLevel === "minimal" ? Math.min(duration, 120) : duration;
  const [renderedValue, setRenderedValue] = useState(value);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (Object.is(renderedValue, value)) return undefined;

    if (!shouldAnimate) {
      setRenderedValue(value);
      setIsVisible(true);
      return undefined;
    }

    setIsVisible(false);
    const swapTimer = window.setTimeout(() => {
      setRenderedValue(value);
      window.requestAnimationFrame(() => setIsVisible(true));
    }, Math.max(40, Math.floor(resolvedDuration * 0.45)));

    return () => window.clearTimeout(swapTimer);
  }, [renderedValue, resolvedDuration, shouldAnimate, value]);

  const style = useMemo<CSSProperties>(() => {
    if (!shouldAnimate) return {};

    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : `translateY(${fromY}px)`,
      transition: `opacity ${resolvedDuration}ms ease, transform ${resolvedDuration}ms ease`,
      willChange: "opacity, transform",
    };
  }, [fromY, isVisible, resolvedDuration, shouldAnimate]);

  return { renderedValue, style, isVisible } as const;
}
