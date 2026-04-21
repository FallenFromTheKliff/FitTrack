import { useEffect } from "react";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";

type Props = {
  onCommit: () => Promise<void>;
  onDone: () => void;
};

export default function BufferScreen({ onCommit, onDone }: Props) {
  const { settings } = useTheme();
  const { ic, anim } = useThemeTransitionAnim();

  const containerStyle = useAnimatedStyle(() => ({
    flex: 1,
    backgroundColor: ic.value.base
  }));

  useEffect(() => {
    if (settings.animationLevel === "full") {
      anim.value = 0;
      anim.value = withTiming(1, { duration: 400 });
    } else {
      anim.value = 1;
    }
    let cancelled = false;
    const runTransition = async () => {
      const minimumDelay = settings.animationLevel === "full" ? 500 : 0;
      await Promise.all([
        onCommit(),
        new Promise((resolve) => setTimeout(resolve, minimumDelay))
      ]);
      if (!cancelled) {
        onDone();
      }
    };
    void runTransition();
    return () => {
      cancelled = true;
    };
  }, [anim, onCommit, onDone, settings.animationLevel]);
  return <Animated.View style={containerStyle} />;
}
