import { useState } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useToggleAnim } from "./useToggleAnim";

export function useExpandCard() {
  const { settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const [bodyHeight, setBodyHeight] = useState(0);
  const {
    anim,
    isOpen: isExpanded,
    toggle,
  } = useToggleAnim({ duration: 200, closeDuration: 140 });
  const bodyHeightAnim = useSharedValue(0);
  const bodyOpacityAnim = useSharedValue(0);

  const handleToggleExpand = () => {
    const expanding = toggle();
    if (!shouldAnimate) {
      bodyHeightAnim.value = expanding ? 1 : 0;
      bodyOpacityAnim.value = expanding ? 1 : 0;
      return;
    }
    bodyHeightAnim.value = withTiming(expanding ? 1 : 0, { duration: 220 });
    bodyOpacityAnim.value = withTiming(expanding ? 1 : 0, {
      duration: expanding ? 220 : 140,
    });
  };

  return {
    isExpanded,
    bodyHeight,
    setBodyHeight,
    handleToggleExpand,
    anim,
    bodyHeightAnim,
    bodyOpacityAnim,
  };
}