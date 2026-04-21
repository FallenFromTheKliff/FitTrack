import { useMemo } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";

import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";
import { makeScreenStyles } from "@/styles/shared/ScreenStyles";
import MuscleMasteryScreenContent from "@/components/mastery/MuscleMasteryScreenContent";

export default function MuscleMasteryScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const controller = useMuscleMasteryScreen({ isFocused });

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Animated.View testID="mastery-screen" style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={base.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MuscleMasteryScreenContent controller={controller} />
      </Animated.ScrollView>
    </Animated.View>
  );
}
