import { useEffect, useCallback } from "react";
import { useSharedValue, withTiming, cancelAnimation } from "react-native-reanimated";
import { useFocusEffect } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";

type PassageAnimOptions = {
  fromY?: number;
  duration?: number;
  mode?: "mount" | "focus";
};

export function usePassageAnim({
  fromY = 16,
  duration = 220,
  mode = "mount",
}: PassageAnimOptions = {}) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel !== "none";
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
  const translateY = useSharedValue(shouldAnimate ? fromY : 0);

  const runAnim = useCallback(() => {
    cancelAnimation(opacity);
    cancelAnimation(translateY);
    if (!shouldAnimate) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = 0;
    translateY.value = fromY;
    opacity.value = withTiming(1, { duration });
    translateY.value = withTiming(0, { duration });
  }, [duration, fromY, opacity, shouldAnimate, translateY]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "focus") return;
      runAnim();
      return () => {
        cancelAnimation(opacity);
        cancelAnimation(translateY);
      };
    }, [mode, opacity, runAnim, translateY])
  );

  useEffect(() => {
    if (mode !== "mount") return;
    runAnim();
  }, [mode, runAnim]);

  return { opacity, translateY };
}