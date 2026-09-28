"use client";

import { useMemo } from "react";

export function useAuthEntrance(shouldAnimate: boolean) {
  const floating = useMemo(() => {
    if (!shouldAnimate) {
      return {
        animate: { y: 0 },
        transition: { duration: 0 }
      };
    }

    return {
      animate: { y: [0, -8, 0] },
      transition: {
        duration: 4,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const,
        delay: 0.15
      }
    };
  }, [shouldAnimate]);

  return { floating };
}