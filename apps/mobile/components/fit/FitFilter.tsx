import { useMemo, useRef } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CalendarCheck, RotateCcw } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { makeFitFilterStyles } from "@/styles/components/FitStyles";
import { FitText } from "@/components/fit/FitText";

export type FitFilterChipOption = {
  label: string;
  value: string;
};

type Props = {
  isOpen: boolean;
  topChipOptions?: FitFilterChipOption[];
  activeTopChip?: string;
  onTopChipChange?: (value: string) => void;
  topChipLabel?: string;
  chipOptions?: FitFilterChipOption[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  showDateRange?: boolean;
  startDate?: string;
  endDate?: string;
  startDateLabel?: string;
  endDateLabel?: string;
  onStartDatePress?: () => void;
  onEndDatePress?: () => void;
  onStartDateReset?: () => void;
  onEndDateReset?: () => void;
  dropdownStyle?: StyleProp<ViewStyle>;
};

export default function FitFilter({
  isOpen, topChipOptions, activeTopChip,
  onTopChipChange, topChipLabel = "View", chipOptions,
  activeChip, onChipChange, showDateRange = false,
  startDate, endDate, startDateLabel = "All Dates",
  endDateLabel = "End Date", onStartDatePress, onEndDatePress,
  onStartDateReset, onEndDateReset, dropdownStyle
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeFitFilterStyles(colors), [colors]);
  const everOpenedRef = useRef(false);
  if (isOpen) everOpenedRef.current = true;

  const dateResetRows = (startDate ? 1 : 0) + (endDate ? 1 : 0);
  const topRowHeight = topChipOptions?.length ? 62 : 0;
  const chipRowHeight = chipOptions?.length ? 62 : 0;
  const dateRowHeight = showDateRange ? 100 + dateResetRows * 26 : 0;
  const targetHeight = topRowHeight + chipRowHeight + dateRowHeight +
      (topRowHeight || chipRowHeight || dateRowHeight ? 28 : 0);

  const { height, opacity } = usePanelAnim({ targetHeight, visible: isOpen });

  const filterPanelStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: "hidden"
  }));

  if (!everOpenedRef.current) return null;

  return (
      <Animated.View
        style={[s.filterDropdown, dropdownStyle, filterPanelStyle]}
        accessibilityElementsHidden={!isOpen}
        importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
      >
        {isOpen ? (
        <View style={s.filterPanel}>
          {!!topChipOptions?.length && (
              <View style={s.filterSection}>
                <FitText style={s.filterLabel}>{topChipLabel}</FitText>
                <View style={s.filterOptions}>
                  {topChipOptions.map((opt) => {
                    const isActive = activeTopChip === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            style={[s.filterChip, isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "18" }]}
                            onPress={() => onTopChipChange?.(opt.value)}
                            accessibilityRole="button"
                            accessibilityLabel={`${topChipLabel}: ${opt.label}`}
                            accessibilityState={{ selected: isActive }}
                        >
                          <FitText style={[s.filterChipText, isActive && { color: colors.brand, fontWeight: "600" }]}>
                            {opt.label}
                          </FitText>
                        </Pressable>
                    );
                  })}
                </View>
              </View>
          )}
          {!!chipOptions?.length && (
              <View style={s.filterSection}>
                <FitText style={s.filterLabel}>Status</FitText>
                <View style={s.filterOptions}>
                  {chipOptions.map((opt) => {
                    const isActive = activeChip === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            style={[s.filterChip, isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "18" }]}
                            onPress={() => onChipChange?.(opt.value)}
                            accessibilityRole="button"
                            accessibilityLabel={`Status: ${opt.label}`}
                            accessibilityState={{ selected: isActive }}
                        >
                          <FitText style={[s.filterChipText, isActive && { color: colors.brand, fontWeight: "600" }]}>
                            {opt.label}
                          </FitText>
                        </Pressable>
                    );
                  })}
                </View>
              </View>
          )}
          {showDateRange && (
              <View style={s.filterSection}>
                <FitText style={s.filterLabel}>Date Range</FitText>
                <View style={s.dateRow}>
                  <Pressable
                      style={[s.datePicker, startDate && { borderColor: colors.brand }]}
                      onPress={onStartDatePress}
                      accessibilityRole="button"
                      accessibilityLabel={`Start date: ${startDateLabel}`}
                  >
                    <CalendarDays size={14} color={startDate ? colors.brand : colors.textMuted} strokeWidth={2} />
                    <FitText style={[s.datePickerText, startDate && { color: colors.brand }]}>{startDateLabel}</FitText>
                  </Pressable>
                  <Pressable
                      style={[s.datePicker, endDate && { borderColor: colors.brand }]}
                      onPress={onEndDatePress}
                      accessibilityRole="button"
                      accessibilityLabel={`End date: ${endDateLabel}`}
                  >
                    <CalendarCheck size={14} color={endDate ? colors.brand : colors.textMuted} strokeWidth={2} />
                    <FitText style={[s.datePickerText, endDate && { color: colors.brand }]}>{endDateLabel}</FitText>
                  </Pressable>
                </View>
                {startDate ? (
                    <Pressable
                      style={s.dateResetBtn}
                      onPress={() => onStartDateReset?.()}
                      accessibilityRole="button"
                      accessibilityLabel="Reset start date filter"
                    >
                      <RotateCcw size={13} color={colors.textMuted} strokeWidth={2} />
                      <FitText style={s.dateResetText}>Reset</FitText>
                    </Pressable>
                ) : null}
                {endDate ? (
                    <Pressable
                      style={s.dateResetBtn}
                      onPress={() => onEndDateReset?.()}
                      accessibilityRole="button"
                      accessibilityLabel="Reset end date filter"
                    >
                      <RotateCcw size={13} color={colors.textMuted} strokeWidth={2} />
                      <FitText style={s.dateResetText}>Reset</FitText>
                    </Pressable>
                ) : null}
              </View>
          )}
        </View>
        ) : null}
      </Animated.View>
  );
}
