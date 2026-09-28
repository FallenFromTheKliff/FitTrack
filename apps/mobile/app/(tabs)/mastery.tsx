import { useCallback, useMemo } from "react";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { Apple, Bot, Dumbbell, History, Trophy } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";
import { makeScreenStyles } from "@/styles/shared/ScreenStyles";
import FeatureHeader from "@/components/layout/FeatureHeader";
import MuscleMasteryScreenContent, {
  getMasteryRankColor,
  MuscleMasteryHeaderPanel,
} from "@/components/mastery/MuscleMasteryScreenContent";
import { MILESTONE_SCROLL_OWNER } from "@/components/mastery/milestonePresentation";

export default function MuscleMasteryScreen() {
  const { colors } = useTheme();
  const { registerFAB, unregisterFAB, setFabOpen } = useFABState();
  const isFocused = useIsFocused();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const controller = useMuscleMasteryScreen({ isFocused });
  const onOpenSeasonHistory = controller.onOpenSeasonHistory;
  const lifetimeAccentColor = getMasteryRankColor(controller.lifetimeProgression.level);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const closeFabOnInteraction = useCallback(() => {
    setFabOpen(false);
  }, [setFabOpen]);

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
    {
      label: "Season history",
      sub: "Review top performers",
      icon: History,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: () => {
        setFabOpen(false);
        onOpenSeasonHistory();
      },
    },
  ], [
    colors.brand,
    setFabOpen,
    controller.onOpenChatbot,
    controller.onOpenNutrition,
    onOpenSeasonHistory,
    controller.onOpenWorkout,
  ]);

  useFocusEffect(useCallback(() => {
    setFabOpen(false);
    registerFAB({
      screenIcon: Trophy,
      menuItems,
      scrollY,
      visible: !controller.isMemberLocked,
    });
    return () => unregisterFAB();
  }, [controller.isMemberLocked, menuItems, registerFAB, scrollY, setFabOpen, unregisterFAB]));

  return (
    <Animated.View testID="mastery-screen" style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={[base.scrollContent, { padding: 0 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        onTouchStart={closeFabOnInteraction}
        onScrollBeginDrag={closeFabOnInteraction}
        scrollEventThrottle={16}
        testID={`${MILESTONE_SCROLL_OWNER}-scroll`}
      >
        <FeatureHeader accentColor={lifetimeAccentColor} icon={Trophy}>
          <MuscleMasteryHeaderPanel controller={controller} />
        </FeatureHeader>
        <Animated.View style={{ padding: 20, paddingBottom: 120 }}>
          <MuscleMasteryScreenContent controller={controller} />
        </Animated.View>
      </Animated.ScrollView>
    </Animated.View>
  );
}
