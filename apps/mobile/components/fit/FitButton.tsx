import {
  Pressable,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { ChevronRight, type LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { R } from "@fittrack/ui/tokens";

import { AnimatedFitText, StaticFitText } from "./FitText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type FitButtonVariant =
    | "primary"
    | "ghost"
    | "danger"
    | "link"
    | "nav"
    | "navActive"
    | "sidebarLogout"
    | "field";

type FitButtonProps = {
  label?: string;
  onPress: () => void;
  variant?: FitButtonVariant;
  icon?: LucideIcon;
  iconSize?: number;
  iconOnly?: boolean;
  showTrailing?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  hasError?: boolean;
  flex?: number;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  animatedBg?: SharedValue<string>;
  animatedBorder?: SharedValue<string>;
  animatedText?: SharedValue<string>;
  accessibilityLabel?: string;
};

export default function FitButton({
    label,
    onPress,
    variant = "primary",
    icon: Icon,
    iconSize = 20,
    iconOnly = false,
    showTrailing = false,
    disabled = false,
    loading = false,
    loadingLabel,
    flex,
    style,
    pressedStyle,
    textStyle,
    animatedBg,
    animatedBorder,
    animatedText,
    accessibilityLabel
  }: FitButtonProps) {
  const { colors, activeIconColor } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { width: viewportWidth } = useWindowDimensions();
  const smallViewport = viewportWidth < 360;
  const isDisabled = disabled || loading;
  const ic2 = activeIconColor ?? colors.brand;
  const onBrand = colors.onBrand ?? "#FFFFFF";
  const flexStyle: ViewStyle = flex !== undefined ? { flex } : {};
  const displayLabel = loading && loadingLabel ? loadingLabel : (label ?? "");
  const pressableAccessibilityLabel = accessibilityLabel ?? label;

  const containerVariants: Record<FitButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled ? colors.textDisabled : colors.brand,
      borderWidth: 0,
      paddingVertical: iconOnly ? 6 : 14
    },
    ghost: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: iconOnly ? 6 : 14
    },
    danger: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: iconOnly ? 6 : 14
    },
    link: {
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingVertical: iconOnly ? 4 : 6
    },
    nav: {
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: R.md
    },
    navActive: {
      backgroundColor: colors.brand,
      borderWidth: 0,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: R.md
    },
    sidebarLogout: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 15,
      paddingHorizontal: 14,
      borderRadius: R.lg
    },
    field: {
      backgroundColor: colors.fieldBg,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      paddingVertical: 14,
      paddingHorizontal: 14,
      justifyContent: "space-between"
    }
  };

  const iconColor: Record<FitButtonVariant, string> = {
    primary: isDisabled ? colors.textMuted : onBrand,
    ghost: colors.textSecondary,
    danger: colors.danger,
    link: isDisabled ? colors.textDisabled : ic2,
    nav: colors.textSecondary,
    navActive: onBrand,
    sidebarLogout: colors.danger,
    field: colors.brand
  };

  const compactCenteredText: TextStyle = smallViewport
    ? { minWidth: 0, flexShrink: 1, textAlign: "center" }
    : {};
  const compactLeftText: TextStyle = smallViewport
    ? { minWidth: 0, flexShrink: 1, textAlign: "left" }
    : {};

  const textVariants: Record<FitButtonVariant, TextStyle> = {
    primary: {
      fontSize: 17,
      fontWeight: "600",
      color: isDisabled ? colors.textMuted : onBrand,
      ...compactCenteredText,
    },
    ghost: { fontSize: 17, color: colors.textSecondary, ...compactCenteredText },
    danger: { fontSize: 17, color: colors.danger, ...compactCenteredText },
    link: {
      fontSize: 15,
      color: isDisabled ? colors.textDisabled : ic2,
      textDecorationLine: iconOnly ? "none" : "underline",
      ...compactCenteredText,
    },
    nav: { fontSize: 17, color: colors.textSecondary, flex: 1, ...compactLeftText },
    navActive: { fontSize: 17, color: onBrand, fontWeight: "600", flex: 1, ...compactLeftText },
    sidebarLogout: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.danger,
      flex: 1,
      ...compactLeftText,
    },
    field: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
      flex: 1,
      textAlign: "left",
      ...(smallViewport ? { minWidth: 0, flexShrink: 1 } : {}),
    }
  };

  const btn: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    borderRadius: R.md,
    gap: iconOnly ? 0 : 8,
    opacity: isDisabled ? 0.6 : 1,
    minHeight: smallViewport ? 44 : undefined,
    minWidth: smallViewport && iconOnly ? 44 : undefined,
    paddingHorizontal: iconOnly ? 6 : smallViewport ? 12 : undefined,
    ...containerVariants[variant],
    ...flexStyle
  };

  const ghostAnimStyle = useAnimatedStyle(() => {
    if (variant === "ghost")
      return { backgroundColor: ic.value.surfaceRaised, borderColor: ic.value.border };
    if (variant === "nav") return { backgroundColor: "transparent" };
    if (variant === "navActive") return { backgroundColor: ic.value.brand };
    if (variant === "field")
      return { backgroundColor: ic.value.fieldBg, borderColor: ic.value.fieldBorder };
    return {};
  });
  const animContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedBg?.value ?? colors.brand,
    borderColor: animatedBorder?.value ?? colors.border
  }));
  const animTextStyle = useAnimatedStyle(() => ({
    color:
      animatedText?.value ??
      (isDisabled ? colors.textMuted : textVariants[variant].color ?? onBrand)
  }));

  const hasAnimatedFrame = Boolean(animatedBg && animatedBorder);
  const animatedFrame: ViewStyle = {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    paddingVertical: 13,
    ...(smallViewport
      ? {
          minHeight: 44,
          minWidth: iconOnly ? 44 : undefined,
          paddingHorizontal: iconOnly ? 6 : 12,
        }
      : {}),
    ...flexStyle,
  };

  const withPressedStyle = (
    baseStyle: StyleProp<ViewStyle>,
  ): StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>) =>
    pressedStyle
      ? ({ pressed }) => [baseStyle, pressed ? pressedStyle : undefined]
      : baseStyle;

  if (hasAnimatedFrame) {
    return (
      <AnimatedPressable
        accessibilityLabel={pressableAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={withPressedStyle([animatedFrame, style as ViewStyle, animContainerStyle])}
        onPress={onPress}
        disabled={isDisabled}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {Icon ? <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} /> : null}
          {!iconOnly && (animatedText ? (
            <AnimatedFitText style={[textVariants[variant], textStyle, animTextStyle]}>
              {displayLabel}
            </AnimatedFitText>
          ) : (
            <StaticFitText style={[textVariants[variant], textStyle]}>
              {displayLabel}
            </StaticFitText>
          ))}
        </View>
      </AnimatedPressable>
    );
  }

  if (variant === "ghost" || variant === "nav" || variant === "navActive" || variant === "field") {
    return (
      <AnimatedPressable
        accessibilityLabel={pressableAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={withPressedStyle([btn, ghostAnimStyle, style])}
        onPress={onPress}
        disabled={isDisabled}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: variant === "field" ? "space-between" : "center", gap: iconOnly ? 0 : 8, flex: 1, paddingHorizontal: iconOnly ? 6 : undefined }}>
          {Icon && variant !== "field" ? <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} /> : null}
          {!iconOnly ? <StaticFitText style={[textVariants[variant], textStyle]}>{displayLabel}</StaticFitText> : null}
          {(showTrailing || variant === "field") ? <ChevronRight size={variant === "field" ? iconSize : 17} color={iconColor[variant]} strokeWidth={2} /> : null}
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      accessibilityLabel={pressableAccessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={withPressedStyle([btn, style])}
      onPress={onPress}
      disabled={isDisabled}
    >
      {Icon ? <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} /> : null}
      {!iconOnly ? <StaticFitText style={[textVariants[variant], textStyle]}>{displayLabel}</StaticFitText> : null}
      {showTrailing ? <ChevronRight size={17} color={iconColor[variant]} strokeWidth={2} /> : null}
    </AnimatedPressable>
  );
}
