import { useEffect } from "react";
import { cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

type OverlayAnimMode = "scale" | "slideUp";

export function useOverlayAnim(
  isVisible: boolean,
  mode: OverlayAnimMode = "scale",
) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const translateY = useSharedValue(24);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(translateY);

    if (isVisible) {
      if (!shouldAnimate) {
        opacity.value = 1;
        scale.value = 1;
        translateY.value = 0;
        return;
      }
      if (mode === "scale") {
        opacity.value = 0;
        scale.value = 0.95;
        opacity.value = withTiming(1, { duration: 180 });
        scale.value = withTiming(1, { duration: 180 });
      } else {
        opacity.value = 0;
        translateY.value = 24;
        opacity.value = withTiming(1, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
      }
    } else {
      if (!shouldAnimate) {
        opacity.value = 0;
        scale.value = 0.95;
        translateY.value = 24;
        return;
      }
      if (mode === "scale") {
        opacity.value = withTiming(0, { duration: 140 });
        scale.value = withTiming(0.95, { duration: 140 });
      } else {
        opacity.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(24, { duration: 160 });
      }
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(translateY);
    };
  }, [isVisible, mode, opacity, scale, shouldAnimate, translateY]);

  return { opacity, scale, translateY };
}
