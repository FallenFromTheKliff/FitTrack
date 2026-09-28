"use client";
import { useEffect } from "react";
import { animate, useMotionValue } from "framer-motion";

import { useTheme } from "@/contexts/ThemeContext";

export type SlideDirection = "left" | "right";

export function usePowerSlide(trigger: number, direction: SlideDirection) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const x = useMotionValue(0);
  const opacity = useMotionValue(1);

  useEffect(() => {
    if (!shouldAnimate) {
      x.set(0);
      opacity.set(1);
      return;
    }
    const inX = direction === "left" ? -22 : 22;
    x.set(inX);
    opacity.set(0);
    const fadeIn = animate(opacity, 1, { duration: 0.08, ease: "linear" });
    const slideIn = animate(x, 0, { duration: 0.16, ease: "easeOut", delay: 0.08 });

    return () => {
      fadeIn.stop();
      slideIn.stop();
    };
  }, [trigger, direction, shouldAnimate, opacity, x]);

  return { style: { x, opacity } };
}
