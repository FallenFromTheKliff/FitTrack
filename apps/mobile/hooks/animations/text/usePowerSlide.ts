import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

type SlideDirection = "left" | "right";

export function usePowerSlide(trigger: number, direction: SlideDirection) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!shouldAnimate) return;
    const outX = direction === "left" ? -24 : 24;
    const inX = direction === "left" ? 24 : -24;
    translateX.value = 0;
    opacity.value = 1;
    translateX.value = withTiming(
      outX,
      { duration: 100, easing: Easing.out(Easing.quad) },
      () => {
        translateX.value = inX;
        opacity.value = 0;
        translateX.value = withTiming(0, {
          duration: 140,
          easing: Easing.out(Easing.quad)
        });
        opacity.value = withTiming(1, { duration: 140 });
      }
    );
  }, [direction, shouldAnimate, trigger]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }]
  }));

  return { style };
}