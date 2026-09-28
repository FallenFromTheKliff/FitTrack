import { useState } from "react";
import { useSharedValue, withTiming, withSpring } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

type ToggleAnimOptions = {
  duration?: number;
  closeDuration?: number;
  useSpring?: boolean;
  friction?: number;
  tension?: number;
};

export function useToggleAnim({
  duration = 220,
  closeDuration,
  useSpring = false,
  friction = 20,
  tension = 200,
}: ToggleAnimOptions = {}) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const [isOpen, setIsOpen] = useState(false);
  const anim = useSharedValue(0);

  const toggle = (overrideOpen?: boolean) => {
    const opening = overrideOpen !== undefined ? overrideOpen : !isOpen;
    setIsOpen(opening);
    if (!shouldAnimate) {
      anim.value = opening ? 1 : 0;
      return opening;
    }
    if (useSpring) {
      anim.value = withSpring(opening ? 1 : 0, {
        damping: friction,
        stiffness: tension,
      });
    } else {
      anim.value = withTiming(opening ? 1 : 0, {
        duration: opening ? duration : (closeDuration ?? duration),
      });
    }
    return opening;
  };

  return { anim, isOpen, toggle };
}