import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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

type FitFilterPanelProps = {
  children: ReactNode;
  onLayout: (event: LayoutChangeEvent) => void;
  panelStyle: StyleProp<ViewStyle>;
};

/**
 * Native dropdowns must participate in their parent's layout. A bounded
 * ScrollView keeps long option lists usable without allowing the parent card
 * or screen scroll surface to clip the menu. The web path intentionally keeps
 * the original View so its absolute overlay behavior is unchanged.
 */
function FitFilterPanel({ children, onLayout, panelStyle }: FitFilterPanelProps) {
  if (Platform.OS === "web") {
    return (
      <View style={panelStyle} onLayout={onLayout}>
        {children}
      </View>
    );
  }

  return (
    <View style={panelStyle} onLayout={onLayout}>
      <ScrollView
        style={{ alignSelf: "stretch", flexGrow: 0, flexShrink: 1, maxHeight: 300 }}
        contentContainerStyle={{ gap: 10 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </View>
  );
}

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
  compact?: boolean;
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
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeFitFilterStyles(colors), [colors]);
  const everOpenedRef = useRef(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  if (isOpen) everOpenedRef.current = true;

  const targetHeight = measuredHeight;

  const { height, opacity } = usePanelAnim({
    duration: 200,
    targetHeight,
    visible: isOpen,
  });

  const compactChipStyle = compact
    ? { minHeight: 34, minWidth: 72, paddingHorizontal: 8, paddingVertical: 6 }
    : undefined;
  const compactChipTextStyle = compact ? { fontSize: 12 } : undefined;

  // Native containers clip/evaluate absolutely positioned descendants
  // differently from web. Keeping the menu in layout makes the complete chip
  // list part of the screen/modal scroll surface and preserves hit testing.
  const nativeFlowStyle = Platform.OS === "web"
    ? undefined
    : {
        alignSelf: "stretch" as const,
        width: "100%" as const,
        left: 0,
        right: 0,
        top: 0,
        position: "relative" as const,
        zIndex: 0,
        elevation: 0,
      };

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

  // Native flow panels do not need a hidden animated shell between opens.
  // Unmounting while closed also avoids leaving a zero-height flex item (and
  // its gap) in rows such as the season-history controls.
  if (Platform.OS === "web" ? !everOpenedRef.current : !isOpen) return null;

  const handlePanelLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setMeasuredHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  return (
    <Animated.View
      style={[
        s.filterDropdown,
        dropdownStyle,
        nativeFlowStyle,
        Platform.OS === "web" ? filterPanelStyle : undefined,
      ]}
      accessibilityElementsHidden={!isOpen}
      importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
      pointerEvents={isOpen ? "auto" : "none"}
    >
      <FitFilterPanel panelStyle={s.filterPanel} onLayout={handlePanelLayout}>
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
                        compactChipStyle,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "18",
                        },
                      ]}
                      hitSlop={compact ? 6 : undefined}
                      onPress={() => onTopChipChange?.(opt.value)}
                      accessibilityRole={topChipAccessibilityRole}
                      accessibilityLabel={`${topChipLabel}: ${opt.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <StaticFitText
                        style={[
                          s.filterChipText,
                          compactChipTextStyle,
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
                        compactChipStyle,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "18",
                        },
                      ]}
                      hitSlop={compact ? 6 : undefined}
                      onPress={() => onChipChange?.(opt.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Status: ${opt.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <StaticFitText
                        style={[
                          s.filterChipText,
                          compactChipTextStyle,
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
      </FitFilterPanel>
    </Animated.View>
  );
}
