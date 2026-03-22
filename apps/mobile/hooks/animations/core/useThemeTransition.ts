import { useAnimatedStyle, useDerivedValue, interpolateColor } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { themes } from "@fittrack/ui";
import type { ThemeColors } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";

export type InterpolatedColors = SharedValue<ThemeColors>;

export function useThemeTransitionAnim(): {
  ic: InterpolatedColors;
  anim: SharedValue<number>;
} {
  const { prevThemeKey, activeThemeKey, themeTransitionAnim } = useTheme();
  const prev = themes[prevThemeKey];
  const next = themes[activeThemeKey];

  const ic = useDerivedValue<ThemeColors>(
    () => ({
      brand: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.brand, next.brand]),
      onBrand: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.onBrand, next.onBrand]),
      brandLight: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.brandLight, next.brandLight]),
      base: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.base, next.base]),
      surface: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.surface, next.surface]),
      surfaceRaised: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.surfaceRaised, next.surfaceRaised]),
      border: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.border, next.border]),
      borderStrong: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.borderStrong, next.borderStrong]),
      textPrimary: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.textPrimary, next.textPrimary]),
      textSecondary: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.textSecondary, next.textSecondary]),
      textMuted: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.textMuted, next.textMuted]),
      textDisabled: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.textDisabled, next.textDisabled]),
      fieldBg: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.fieldBg, next.fieldBg]),
      fieldBorder: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.fieldBorder, next.fieldBorder]),
      success: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.success, next.success]),
      warning: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.warning, next.warning]),
      danger: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.danger, next.danger]),
      overlay: interpolateColor(themeTransitionAnim.value, [0, 1], [prev.overlay, next.overlay])
    }),
    [prevThemeKey, activeThemeKey]
  );

  return { ic, anim: themeTransitionAnim };
}

export function useThemeTransition() {
  const { ic, anim } = useThemeTransitionAnim();

  const baseStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.base }));
  const surfaceStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.surface }));
  const raisedStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.surfaceRaised }));
  const borderStyle = useAnimatedStyle(() => ({ borderColor: ic.value.border }));
  const textPrimaryStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const textMutedStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));
  const fieldBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.fieldBg }));

  return {
    anim,
    ic,
    baseStyle,
    surfaceStyle,
    raisedStyle,
    borderStyle,
    textPrimaryStyle,
    textMutedStyle,
    fieldBgStyle
  };
}
