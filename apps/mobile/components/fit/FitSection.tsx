import React, { type ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { makeFitSectionStyles } from "@/styles/components/FitStyles";

import { AnimatedFitText } from "@/components/fit/FitText";

type Props = {
  heading: string;
  children: ReactNode;
  bare?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
};

export default React.memo(function FitSection({ heading, children, bare = false, cardStyle }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const s = React.useMemo(() => makeFitSectionStyles(colors), [colors]);

  const headingAnimStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  return (
    <View style={s.section}>
      {heading.length > 0 && (
        <AnimatedFitText style={[s.heading, headingAnimStyle]}>
          {heading}
        </AnimatedFitText>
      )}
      {bare ? (
        <View>{children}</View>
      ) : (
        <Animated.View style={[s.card, cardAnimStyle, cardStyle as ViewStyle]}>
          {children}
        </Animated.View>
      )}
    </View>
  );
});