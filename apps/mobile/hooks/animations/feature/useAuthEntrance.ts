import { useEffect } from "react";
import { useSharedValue, withTiming, withRepeat, withSequence } from "react-native-reanimated";

import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";

export function useAuthEntrance() {
  const { opacity: fadeIn } = usePassageAnim();
  const takeFlight = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      takeFlight.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000 }),
          withTiming(0, { duration: 2000 }),
        ),
        -1,
        false
      );
    }, 150);
    return () => clearTimeout(timeout);
  }, []);

  return { fadeIn, takeFlight };
}