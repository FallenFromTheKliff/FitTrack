import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

type PanelRevealOptions = {
  targetHeight: number;
  visible: boolean;
  duration?: number;
};

export function usePanelAnim({
  targetHeight,
  visible,
  duration = 200,
}: PanelRevealOptions) {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate) {
      height.value = visible ? targetHeight : 0;
      opacity.value = visible ? 1 : 0;
      return;
    }
    height.value = withTiming(visible ? targetHeight : 0, { duration });
    opacity.value = withTiming(visible ? 1 : 0, { duration });
  }, [visible, targetHeight, duration, shouldAnimate]);

  return { height, opacity };
}