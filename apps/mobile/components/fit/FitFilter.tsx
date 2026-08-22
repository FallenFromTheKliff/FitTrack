import { useMemo, useRef, useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CalendarCheck, RotateCcw } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { makeFitFilterStyles } from "@/styles/components/FitStyles";
import { StaticFitText } from "@/components/fit/FitText";

export type FitFilterChipOption = {
  label: string;
  value: string;
};

type Props = {
  isOpen: boolean;
  topChipOptions?: FitFilterChipOption[];
  activeTopChip?: string;
  onTopChipChange?: (value: string) => void;
  topChipAccessibilityRole?: "button" | "tab";
  topChipLabel?: string;
  chipOptions?: FitFilterChipOption[];
  chipLabel?: string;
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
  isOpen,
  topChipOptions,
  activeTopChip,
  onTopChipChange,
  topChipAccessibilityRole = "button",
  topChipLabel = "View",
  chipOptions,
  chipLabel = "Status",
  activeChip,
  onChipChange,
  showDateRange = false,
  startDate,
  endDate,
  startDateLabel = "All Dates",
  endDateLabel = "End Date",
  onStartDatePress,
  onEndDatePress,
  onStartDateReset,
  onEndDateReset,
  dropdownStyle,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeFitFilterStyles(colors), [colors]);
  const everOpenedRef = useRef(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  if (isOpen) everOpenedRef.current = true;

  const targetHeight = measuredHeight;

  const { height, opacity } = usePanelAnim({ targetHeight, visible: isOpen });

  const filterPanelStyle = useAnimatedStyle(() => ({
    // The first open has no measured height yet. Applying height: 0 here
    // prevents the child from laying out, so every filter rendered as an
    // empty, clickable strip. Let the panel size intrinsically once so its
    // onLayout can establish the animated target height.
    ...(measuredHeight > 0
      ? { height: height.value, overflow: "hidden" as const }
      : { overflow: "visible" as const }),
    opacity: opacity.value,
  }));

  if (!everOpenedRef.current) return null;

  return (
    <Animated.View
      style={[s.filterDropdown, dropdownStyle, filterPanelStyle]}
      accessibilityElementsHidden={!isOpen}
      importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
    >
      {isOpen ? (
        <View
          style={s.filterPanel}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setMeasuredHeight((currentHeight) =>
              currentHeight === nextHeight ? currentHeight : nextHeight,
            );
          }}
        >
          {!!topChipOptions?.length && (
            <View style={s.filterSection}>
              <StaticFitText style={s.filterLabel}>{topChipLabel}</StaticFitText>
              <View style={s.filterOptions}>
                {topChipOptions.map((opt) => {
                  const isActive = activeTopChip === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[
                        s.filterChip,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "18",
                        },
                      ]}
                      onPress={() => onTopChipChange?.(opt.value)}
                      accessibilityRole={topChipAccessibilityRole}
                      accessibilityLabel={`${topChipLabel}: ${opt.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <StaticFitText
                        style={[
                          s.filterChipText,
                          isActive && {
                            color: colors.brand,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {opt.label}
                      </StaticFitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {!!chipOptions?.length && (
            <View style={s.filterSection}>
              <StaticFitText style={s.filterLabel}>{chipLabel}</StaticFitText>
              <View style={s.filterOptions}>
                {chipOptions.map((opt) => {
                  const isActive = activeChip === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[
                        s.filterChip,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "18",
                        },
                      ]}
                      onPress={() => onChipChange?.(opt.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Status: ${opt.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <StaticFitText
                        style={[
                          s.filterChipText,
                          isActive && {
                            color: colors.brand,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {opt.label}
                      </StaticFitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {showDateRange && (
            <View style={s.filterSection}>
              <StaticFitText style={s.filterLabel}>Date Range</StaticFitText>
              <View style={s.dateRow}>
                <Pressable
                  style={[
                    s.datePicker,
                    startDate && { borderColor: colors.brand },
                  ]}
                  onPress={onStartDatePress}
                  accessibilityRole="button"
                  accessibilityLabel={`Start date: ${startDateLabel}`}
                >
                  <CalendarDays
                    size={14}
                    color={startDate ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                  <StaticFitText
                    style={[
                      s.datePickerText,
                      startDate && { color: colors.brand },
                    ]}
                  >
                    {startDateLabel}
                  </StaticFitText>
                </Pressable>
                <Pressable
                  style={[
                    s.datePicker,
                    endDate && { borderColor: colors.brand },
                  ]}
                  onPress={onEndDatePress}
                  accessibilityRole="button"
                  accessibilityLabel={`End date: ${endDateLabel}`}
                >
                  <CalendarCheck
                    size={14}
                    color={endDate ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                  <StaticFitText
                    style={[
                      s.datePickerText,
                      endDate && { color: colors.brand },
                    ]}
                  >
                    {endDateLabel}
                  </StaticFitText>
                </Pressable>
              </View>
              {startDate ? (
                <Pressable
                  style={s.dateResetBtn}
                  onPress={() => onStartDateReset?.()}
                  accessibilityRole="button"
                  accessibilityLabel="Reset start date filter"
                >
                  <RotateCcw
                    size={13}
                    color={colors.textMuted}
                    strokeWidth={2}
                  />
                  <StaticFitText style={s.dateResetText}>Reset</StaticFitText>
                </Pressable>
              ) : null}
              {endDate ? (
                <Pressable
                  style={s.dateResetBtn}
                  onPress={() => onEndDateReset?.()}
                  accessibilityRole="button"
                  accessibilityLabel="Reset end date filter"
                >
                  <RotateCcw
                    size={13}
                    color={colors.textMuted}
                    strokeWidth={2}
                  />
                  <StaticFitText style={s.dateResetText}>Reset</StaticFitText>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}
