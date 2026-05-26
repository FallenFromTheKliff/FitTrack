import { Pressable, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { ChevronRight, type LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { R } from "@fittrack/ui/tokens";

import { FitText, AnimatedFitText } from "./FitText";

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
    textStyle,
    animatedBg,
    animatedBorder,
    animatedText,
    accessibilityLabel
  }: FitButtonProps) {
  const { colors, activeIconColor } = useTheme();
  const { ic } = useThemeTransitionAnim();
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

  const textVariants: Record<FitButtonVariant, TextStyle> = {
    primary: {
      fontSize: 17,
      fontWeight: "600",
      color: isDisabled ? colors.textMuted : onBrand
    },
    ghost: { fontSize: 17, color: colors.textSecondary },
    danger: { fontSize: 17, color: colors.danger },
    link: {
      fontSize: 15,
      color: isDisabled ? colors.textDisabled : ic2,
      textDecorationLine: iconOnly ? "none" : "underline"
    },
    nav: { fontSize: 17, color: colors.textSecondary, flex: 1 },
    navActive: { fontSize: 17, color: onBrand, fontWeight: "600", flex: 1 },
    sidebarLogout: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.danger,
      flex: 1
    },
    field: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
      flex: 1,
      textAlign: "left"
    }
  };

  const btn: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.md,
    gap: iconOnly ? 0 : 8,
    opacity: isDisabled ? 0.6 : 1,
    paddingHorizontal: iconOnly ? 6 : undefined,
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
  const ghostTextAnimStyle = useAnimatedStyle(() => {
    if (variant === "ghost") return { color: ic.value.textSecondary };
    if (variant === "nav") return { color: ic.value.textSecondary };
    if (variant === "field") return { color: ic.value.textPrimary };
    return {};
  });

  const animContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedBg?.value ?? colors.brand,
    borderColor: animatedBorder?.value ?? colors.border
  }));
  const animTextStyle = useAnimatedStyle(() => ({
    color: animatedText?.value ?? (isDisabled ? colors.textMuted : onBrand)
  }));

  if (animatedBg && animatedBorder) {
    return (
        <Animated.View
            style={[
              { borderRadius: R.md, borderWidth: 1, overflow: "hidden", ...flexStyle },
              style as ViewStyle,
              animContainerStyle
            ]}
        >
          <Pressable
              accessibilityLabel={pressableAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 13,
                gap: 8
              }}
              onPress={onPress}
              disabled={isDisabled}
          >
            {Icon && <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} />}
            {!iconOnly && (
                <AnimatedFitText
                    style={[textVariants[variant], textStyle, animatedText ? animTextStyle : undefined]}
                >
                  {displayLabel}
                </AnimatedFitText>
            )}
          </Pressable>
        </Animated.View>
    );
  }
  if (variant === "ghost" || variant === "nav" || variant === "navActive" || variant === "field") {
    return (
        <Animated.View style={[btn, ghostAnimStyle, style as ViewStyle]}>
          <Pressable
              accessibilityLabel={pressableAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: variant === "field" ? "space-between" : "center",
                gap: iconOnly ? 0 : 8,
                flex: 1,
                paddingHorizontal: iconOnly ? 6 : undefined
              }}
              onPress={onPress}
              disabled={isDisabled}
          >
            {Icon && variant !== "field" && (
                <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} />
            )}
            {!iconOnly && (
                <AnimatedFitText
                    style={[textVariants[variant], textStyle, ghostTextAnimStyle]}
                >
                  {displayLabel}
                </AnimatedFitText>
            )}
            {(showTrailing || variant === "field") && (
                <ChevronRight
                    size={variant === "field" ? iconSize : 17}
                    color={iconColor[variant]}
                    strokeWidth={2}
                />
            )}
          </Pressable>
        </Animated.View>
    );
  }
  return (
      <Pressable
        accessibilityLabel={pressableAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={[btn, style]}
        onPress={onPress}
        disabled={isDisabled}
      >
        {Icon && <Icon size={iconSize} color={iconColor[variant]} strokeWidth={2} />}
        {!iconOnly && (
            <FitText style={[textVariants[variant], textStyle]}>{displayLabel}</FitText>
        )}
        {showTrailing && (
            <ChevronRight size={17} color={iconColor[variant]} strokeWidth={2} />
        )}
      </Pressable>
  );
}
