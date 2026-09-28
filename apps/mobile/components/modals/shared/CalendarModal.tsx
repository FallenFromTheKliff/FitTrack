import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { CALENDAR_VIEW_OPTIONS, MONTH_NAMES, MONTH_NAMES_SHORT, WEEK_DAYS } from "@fittrack/app-config";
import type { CalendarViewMode } from "@fittrack/types";
import { formatDateYMD, getDaysInMonth, getFirstDayOfWeek, parseDateYMD } from "@fittrack/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeCalendarModalStyles } from "@/styles/modals/CalendarStyles";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  isVisible: boolean;
  selectedDate: string;
  allowEmpty?: boolean;
  blockPast?: boolean;
  minDate?: string;
  maxDate?: string;
  defaultYear?: number;
  defaultMonth?: number;
  blockedDates?: string[];
  highlightedDates?: string[];
  onVisibleMonthChange?: (view: { month: number; year: number }) => void;
  onSelect: (date: string) => void;
  onClose: () => void;
};

export default function CalendarModal({ isVisible, selectedDate, allowEmpty, blockPast = false, minDate, maxDate, defaultYear, defaultMonth, blockedDates = [], highlightedDates = [], onVisibleMonthChange, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const s = useMemo(() => makeCalendarModalStyles(colors), [colors]);
  const safeTop = Math.max(16, insets.top + 8);
  const safeBottom = Math.max(16, insets.bottom + 8);
  const usableHeight = Math.max(1, viewportHeight - safeTop - safeBottom);
  const constrained = viewportWidth < 360 || usableHeight < 600;
  const horizontalPadding = constrained
    ? Math.max(16, insets.left + 12, insets.right + 12)
    : 24;
  const cardHeight = constrained
    ? Math.max(1, Math.min(560, usableHeight))
    : undefined;
  const today = useMemo(() => new Date(), []);
  const fallbackYear = defaultYear ?? today.getFullYear();
  const fallbackMonth = defaultMonth ?? (today.getMonth() + 1);
  const fallbackDate = useMemo(() => new Date(fallbackYear, fallbackMonth - 1, 1), [fallbackMonth, fallbackYear]);
  const todayStr = formatDateYMD(today);
  const minSelectable = minDate && minDate > todayStr ? minDate : blockPast ? todayStr : minDate ?? "";
  const maxSelectable = maxDate ?? "";
  const selected = useMemo(() => parseDateYMD(selectedDate, fallbackDate), [fallbackDate, selectedDate]);
  const [cursor, setCursor] = useState<Date>(selected);
  const [currentView, setCurrentView] = useState<CalendarViewMode>("DAYS");

  useEffect(() => {
    if (isVisible) {
      setCursor(parseDateYMD(selectedDate, fallbackDate));
      setCurrentView("DAYS");
    }
  }, [fallbackDate, isVisible, selectedDate]);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const viewMonth = monthIndex + 1;
  const monthDays = getDaysInMonth(year, viewMonth);
  const offset = getFirstDayOfWeek(year, viewMonth);
  const selectedYmd = selectedDate ?? "";
  const highlightedDateSet = useMemo(
    () => new Set(highlightedDates),
    [highlightedDates],
  );
  const blockedDateSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const yearRangeStart = year - 7;
  const yearCells = Array.from({ length: 16 }, (_, index) => yearRangeStart + index);
  const isDateRangeOutsideSelection = (start: Date, end: Date) => {
    const startYmd = formatDateYMD(start);
    const endYmd = formatDateYMD(end);
    return Boolean(
      (minSelectable && endYmd < minSelectable) ||
      (maxSelectable && startYmd > maxSelectable),
    );
  };
  const isMonthDisabled = (value: number) =>
    isDateRangeOutsideSelection(
      new Date(year, value, 1),
      new Date(year, value + 1, 0),
    );
  const isYearDisabled = (value: number) =>
    isDateRangeOutsideSelection(
      new Date(value, 0, 1),
      new Date(value, 12, 0),
    );
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > monthDays) return null;
    const nextDate = new Date(year, monthIndex, dayNumber);
    return { dayNumber, ymd: formatDateYMD(nextDate) };
  });

  useEffect(() => {
    if (isVisible && currentView === "DAYS") {
      onVisibleMonthChange?.({ month: viewMonth, year });
    }
  }, [currentView, isVisible, onVisibleMonthChange, viewMonth, year]);

  const navLabel =
    currentView === "DAYS"
      ? `${MONTH_NAMES[monthIndex]} ${year}`
      : currentView === "MONTHS"
        ? String(year)
        : `${yearRangeStart} - ${yearRangeStart + 15}`;

  const handlePrev = () => {
    if (currentView === "DAYS") {
      setCursor(new Date(year, monthIndex - 1, 1));
      return;
    }
    if (currentView === "MONTHS") {
      setCursor(new Date(year - 1, monthIndex, 1));
      return;
    }
    setCursor(new Date(year - 16, monthIndex, 1));
  };

  const handleNext = () => {
    if (currentView === "DAYS") {
      setCursor(new Date(year, monthIndex + 1, 1));
      return;
    }
    if (currentView === "MONTHS") {
      setCursor(new Date(year + 1, monthIndex, 1));
      return;
    }
    setCursor(new Date(year + 16, monthIndex, 1));
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          s.backdrop,
          constrained
            ? {
                paddingHorizontal: horizontalPadding,
                paddingTop: safeTop,
                paddingBottom: safeBottom,
              }
            : undefined,
          backdropStyle,
        ]}
      >
        <Animated.View
          testID="calendar-modal-card"
          style={[
            s.card,
            constrained
              ? {
                  flexShrink: 1,
                  height: cardHeight,
                  maxHeight: cardHeight,
                  minHeight: 0,
                }
              : undefined,
            cardStyle,
          ]}
        >
          <Animated.View style={[s.header, headerBorderStyle]}>
              <View style={[s.navRow, constrained ? s.compactNavRow : undefined]}>
              <FitButton
                variant="link"
                icon={ChevronLeft}
                iconOnly
                iconSize={24}
                accessibilityLabel="Previous calendar page"
                onPress={handlePrev}
              />
              <FitText style={[s.monthLabel, constrained ? s.compactMonthLabel : undefined]}>{navLabel}</FitText>
              <FitButton
                variant="link"
                icon={ChevronRight}
                iconOnly
                iconSize={24}
                accessibilityLabel="Next calendar page"
                onPress={handleNext}
              />
            </View>
          </Animated.View>
          <View style={s.viewRow}>
            {CALENDAR_VIEW_OPTIONS.map((option) => {
              const isActive = option.value === currentView;
              return (
                <FitButton
                  key={option.value}
                  label={option.label}
                  variant={isActive ? "primary" : "ghost"}
                  onPress={() => setCurrentView(option.value)}
                  flex={1}
                  style={s.viewButton}
                  textStyle={s.viewButtonText}
                />
              );
            })}
          </View>
          <ScrollView
            style={[s.body, constrained ? s.constrainedBody : undefined]}
            contentContainerStyle={[s.bodyContent, constrained ? s.constrainedBodyContent : undefined]}
            showsVerticalScrollIndicator={false}
          >
            {currentView === "DAYS" && (
              <>
                <View style={s.weekRow}>
                  {WEEK_DAYS.map((label) => (
                    <FitText key={label} style={s.weekDay}>{label}</FitText>
                  ))}
                </View>
                <View style={s.grid}>
                  {dayCells.map((cell, index) => {
                    if (!cell) {
                      return (
                        <View key={`empty-${index}`} style={s.dayCell}>
                          <View style={s.emptyDayCell} />
                        </View>
                      );
                    }
                    const isSelected = cell.ymd === selectedYmd;
                    const isToday = cell.ymd === todayStr;
                    const isHighlighted = highlightedDateSet.has(cell.ymd);
                    const isBlocked = blockedDateSet.has(cell.ymd);
                    const isBeforeMin = minSelectable ? cell.ymd < minSelectable : false;
                    const isAfterMax = maxSelectable ? cell.ymd > maxSelectable : false;
                    const isPastDate = cell.ymd < todayStr;
                    const isPast = blockPast && isPastDate;
                    const isDisabled = isPast || isBeforeMin || isAfterMax;
                    const canShowHighlight = !isSelected && !isDisabled && !isPastDate;
                    return (
                      <View key={cell.ymd} style={s.dayCell}>
                        <FitButton
                          label={String(cell.dayNumber)}
                          variant={isSelected ? "primary" : "ghost"}
                          onPress={() => !isDisabled && onSelect(cell.ymd)}
                          disabled={isDisabled}
                          style={[
                            s.dayButton,
                            !isSelected && isToday ? { borderColor: colors.brand } : undefined,
                            canShowHighlight && isHighlighted
                              ? { borderColor: colors.success, borderWidth: 1 }
                              : undefined,
                            canShowHighlight && isBlocked
                              ? { borderColor: colors.danger, borderWidth: 1 }
                              : undefined
                          ]}
                          textStyle={[
                            s.dayText,
                            {
                              color: isSelected
                                ? colors.onBrand
                                : isDisabled
                                  ? colors.textDisabled
                                  : colors.textPrimary
                            }
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </>
            )}
            {currentView === "MONTHS" && (
              <View style={s.monthGrid}>
                {MONTH_NAMES_SHORT.map((monthName, index) => {
                  const isActive = index === monthIndex;
                  const isDisabled = isMonthDisabled(index);
                  return (
                    <FitButton
                      key={monthName}
                      label={monthName}
                      variant={isActive ? "primary" : "ghost"}
                      onPress={() => {
                        if (!isDisabled) {
                          setCursor(new Date(year, index, 1));
                          setCurrentView("DAYS");
                        }
                      }}
                      disabled={isDisabled}
                      style={s.monthCell}
                      textStyle={s.pickerText}
                    />
                  );
                })}
              </View>
            )}
            {currentView === "YEARS" && (
              <View style={s.yearGrid}>
                {yearCells.map((value) => {
                  const isActive = value === year;
                  const isDisabled = isYearDisabled(value);
                  return (
                    <FitButton
                      key={value}
                      label={String(value)}
                      variant={isActive ? "primary" : "ghost"}
                      onPress={() => {
                        if (!isDisabled) {
                          setCursor(new Date(value, monthIndex, 1));
                          setCurrentView("MONTHS");
                        }
                      }}
                      disabled={isDisabled}
                      style={s.yearCell}
                      textStyle={s.pickerText}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
          <Animated.View style={[s.footer, constrained ? s.constrainedFooter : undefined, footerBorderStyle]}>
            <FitButton label="Cancel" variant="ghost" onPress={onClose} flex={1} style={[s.footerButton, constrained ? s.constrainedFooterButton : undefined]} />
            {allowEmpty && <FitButton label="Clear" variant="ghost" onPress={() => onSelect("")} flex={1} style={[s.footerButton, constrained ? s.constrainedFooterButton : undefined]} />}
            <FitButton label="Today" variant="ghost" onPress={() => !maxSelectable || todayStr <= maxSelectable ? onSelect(todayStr) : undefined} disabled={!!maxSelectable && todayStr > maxSelectable} flex={1} style={[s.footerButton, constrained ? s.constrainedFooterButton : undefined]} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
