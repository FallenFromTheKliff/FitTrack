import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

export function useFABOptionAnim(index: number, isOpen: boolean, useAnimations: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      if (!useAnimations) {
        progress.value = 1;
        return;
      }
      progress.value = withDelay(index * 50, withTiming(1, { duration: 200 }));
    } else {
      if (!useAnimations) {
        progress.value = 0;
        return;
      }
      progress.value = withTiming(0, { duration: 150 });
    }
  }, [isOpen, useAnimations]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 40 }]
  }));

  return { style };
}