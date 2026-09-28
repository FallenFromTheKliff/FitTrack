import { useMemo } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { Plus, type LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makeFitFABStyles } from "@/styles/components/FitStyles";

type FitFABProps = {
  backdropMode?: "dismiss" | "passthrough";
  screenIcon?: LucideIcon;
  onPress: (isNowOpen: boolean) => void;
  isOpen: boolean;
  scrollY: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

const SCROLL_THRESHOLD = 10;

export default function FitFAB({
  backdropMode = "dismiss",
  screenIcon: ScreenIcon,
  onPress,
  isOpen,
  scrollY,
  style
}: FitFABProps) {
  const { colors, settings } = useTheme();
  const shouldAnimate = settings.animationLevel === "full";
  const s = useMemo(() => makeFitFABStyles(colors), [colors]);

  const lastScrollY = useSharedValue(0);
  const isHidden = useSharedValue(0);
  const morphAnim = useSharedValue(0);

  useDerivedValue(() => {
    const diff = scrollY.value - lastScrollY.value;
    if (diff > SCROLL_THRESHOLD) {
      isHidden.value = 1;
      lastScrollY.value = scrollY.value;
    } else if (diff < -SCROLL_THRESHOLD) {
      isHidden.value = 0;
      lastScrollY.value = scrollY.value;
    }
  });

  const prevOpen = useSharedValue(false);
  useDerivedValue(() => {
    if (isOpen !== prevOpen.value) {
      prevOpen.value = isOpen;
      if (shouldAnimate) {
        morphAnim.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
      } else {
        morphAnim.value = isOpen ? 1 : 0;
      }
    }
  });

  const hideStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) {
      return {
        transform: [{ translateY: isHidden.value ? 100 : 0 }],
        opacity: isHidden.value ? 0 : 1
      };
    }
    return {
      transform: [{ translateY: withTiming(isHidden.value ? 100 : 0, { duration: 250 }) }],
      opacity: withTiming(isHidden.value ? 0 : 1, { duration: 250 })
    };
  });

  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphAnim.value, [0, 0.4], [1, 0]),
    transform: [
      { rotate: interpolate(morphAnim.value, [0, 1], [0, 135]) + "deg" },
      { scale: interpolate(morphAnim.value, [0, 0.5], [1, 0.4]) }
    ]
  }));

  const screenIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphAnim.value, [0.5, 1], [0, 1]),
    transform: [{ scale: interpolate(morphAnim.value, [0.5, 1], [0.4, 1]) }]
  }));

  const handlePress = () => { onPress(!isOpen); };

  return (
    <>
      {isOpen && backdropMode === "dismiss" && (
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 198 }}
          onPress={() => onPress(false)}
        />
      )}
      <Animated.View style={[s.container, hideStyle, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isOpen ? "Close quick actions menu" : "Open quick actions menu"}
          accessibilityState={{ expanded: isOpen }}
          style={[s.fab, { backgroundColor: colors.brand }]}
          onPress={handlePress}
        >
          <View style={s.iconWrap}>
            <Animated.View style={[s.iconLayer, plusStyle]}>
              <Plus size={30} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
            </Animated.View>
            {ScreenIcon && (
              <Animated.View style={[s.iconLayer, screenIconStyle]}>
                <ScreenIcon size={30} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2} />
              </Animated.View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}
