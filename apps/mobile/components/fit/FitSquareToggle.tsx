import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor: string;
  inactiveColor: string;
  useAnimations: boolean;
};

export function FitSquareToggle({ value, onValueChange, activeColor, inactiveColor, useAnimations }: Props) {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = useAnimations
      ? withTiming(value ? 1 : 0, { duration: 200 })
      : (value ? 1 : 0);
  }, [progress, useAnimations, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor])
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 22 }]
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)} style={sqStyles.track}>
      <Animated.View style={[sqStyles.trackFill, trackStyle]} />
      <Animated.View style={[sqStyles.thumb, { backgroundColor: colors.surface }, thumbStyle]} />
    </Pressable>
  );
}

const sqStyles = StyleSheet.create({
  track: {
    width: 52,
    height: 30,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "center",
    padding: 4
  },
  trackFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 6
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 4,
    elevation: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.18)"
  }
});
