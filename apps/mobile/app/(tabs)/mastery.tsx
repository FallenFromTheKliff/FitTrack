import { useCallback, useMemo } from "react";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { Apple, Bot, Dumbbell, Trophy } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";
import { makeScreenStyles } from "@/styles/shared/ScreenStyles";
import FeatureHeader from "@/components/layout/FeatureHeader";
import MuscleMasteryScreenContent, {
  MuscleMasteryHeaderPanel,
} from "@/components/mastery/MuscleMasteryScreenContent";

export default function MuscleMasteryScreen() {
  const { colors } = useTheme();
  const { registerFAB, unregisterFAB } = useFABState();
  const isFocused = useIsFocused();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const controller = useMuscleMasteryScreen({ isFocused });
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  const menuItems = useMemo<FABMenuItem[]>(() => [
    {
      label: "Workout",
      sub: "Track EXP",
      icon: Dumbbell,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: controller.onOpenWorkout,
    },
    {
      label: "Nutrition",
      sub: "Fuel progress",
      icon: Apple,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: controller.onOpenNutrition,
    },
    {
      label: "BrodigyAI",
      sub: "Ask about training",
      icon: Bot,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: controller.onOpenChatbot,
    },
  ], [colors.brand, controller.onOpenChatbot, controller.onOpenNutrition, controller.onOpenWorkout]);

  useFocusEffect(useCallback(() => {
    registerFAB({
      screenIcon: Trophy,
      menuItems,
      scrollY,
      visible: !controller.isMemberLocked,
    });
    return () => unregisterFAB();
  }, [controller.isMemberLocked, menuItems, registerFAB, scrollY, unregisterFAB]));

  return (
    <Animated.View testID="mastery-screen" style={[base.screen, !isFocused && { display: "none" }]}>
      <FeatureHeader
        icon={Trophy}
      >
        <MuscleMasteryHeaderPanel controller={controller} />
      </FeatureHeader>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={base.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <MuscleMasteryScreenContent controller={controller} />
      </Animated.ScrollView>
    </Animated.View>
  );
}
