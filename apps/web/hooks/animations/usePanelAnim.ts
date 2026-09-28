"use client";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

import { useTheme } from "@/contexts/ThemeContext";

type PanelAnimOptions = {
  targetHeight: number;
  visible: boolean;
  duration?: number;
};

export function usePanelAnim({ targetHeight, visible, duration = 200 }: PanelAnimOptions) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    else if (!shouldAnimate) setMounted(false);
    else {
      const id = setTimeout(() => setMounted(false), duration);
      return () => clearTimeout(id);
    }
  }, [visible, shouldAnimate, duration]);

  const panelStyle: CSSProperties = shouldAnimate
    ? {
        maxHeight: visible ? targetHeight : 0,
        opacity: visible ? 1 : 0,
        overflow: "hidden",
        transition: `max-height ${duration}ms ease, opacity ${duration}ms ease`
      }
    : {
        maxHeight: visible ? targetHeight : 0,
        opacity: visible ? 1 : 0,
        overflow: "hidden"
      };

  return { panelStyle, mounted: mounted || visible };
}