import { Text, TextInput } from "react-native";
import type { TextProps, TextInputProps } from "react-native";
import React from "react";
import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";

import { useTheme, useFontFamily } from "@/contexts/ThemeContext";
import { FONT_FAMILIES } from "@fittrack/ui";

export const FitText = React.memo(function FitText({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  const fontFamily = useFontFamily();
  return (
    <Text
      {...props}
      style={[{ fontFamily, color: colors.textPrimary }, style]}
    />
  );
});

export function FitTextInput({ style, ...props }: TextInputProps) {
  const { colors } = useTheme();
  const fontFamily = useFontFamily();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        {
          color:
            props.editable === false ? colors.textDisabled : colors.textPrimary,
          flex: 1,
          fontSize: 15,
          paddingVertical: 14,
          paddingHorizontal: 4
        },
        style,
        { fontFamily }
      ]}
    />
  );
}

const ReanimatedText = Animated.createAnimatedComponent(FitText);
export function AnimatedFitText({
  style,
  ...props
}: ComponentProps<typeof ReanimatedText>) {
  const { colors } = useTheme();
  const fontFamily = useFontFamily();
  return (
    <ReanimatedText
      {...props}
      style={[{ fontFamily, color: colors.textPrimary }, style]}
    />
  );
}

export function StaticFitText({
  fontKey = "standard",
  style,
  ...props
}: TextProps & { fontKey?: "standard" | "retro" | "painter" }) {
  return (
    <Text {...props} style={[{ fontFamily: FONT_FAMILIES[fontKey] }, style]} />
  );
}