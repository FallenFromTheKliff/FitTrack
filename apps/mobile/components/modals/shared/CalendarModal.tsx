import { useEffect, useMemo, useState } from "react";
import { Modal, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { CALENDAR_VIEW_OPTIONS, MONTH_NAMES, MONTH_NAMES_SHORT, WEEK_DAYS } from "@fittrack/app-config";
import type { CalendarViewMode } from "@fittrack/types";
import { formatDateYMD, getDaysInMonth, getFirstDayOfWeek, parseDateYMD } from "@fittrack/utils";
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
  defaultYear?: number;
  defaultMonth?: number;
  onSelect: (date: string) => void;
  onClose: () => void;
};

export default function CalendarModal({ isVisible, selectedDate, allowEmpty, blockPast = false, minDate, defaultYear, defaultMonth, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeCalendarModalStyles(colors), [colors]);
  const today = useMemo(() => new Date(), []);
  const fallbackYear = defaultYear ?? today.getFullYear();
  const fallbackMonth = defaultMonth ?? (today.getMonth() + 1);
  const fallbackDate = useMemo(() => new Date(fallbackYear, fallbackMonth - 1, 1), [fallbackMonth, fallbackYear]);
  const todayStr = formatDateYMD(today);
  const minSelectable = minDate && minDate > todayStr ? minDate : blockPast ? todayStr : minDate ?? "";
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
  const yearRangeStart = year - 7;
  const yearCells = Array.from({ length: 16 }, (_, index) => yearRangeStart + index);
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > monthDays) return null;
    const nextDate = new Date(year, monthIndex, dayNumber);
    return { dayNumber, ymd: formatDateYMD(nextDate) };
  });

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
      onRequestClose={undefined}
      statusBarTranslucent
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.navRow}>
              <FitButton variant="link" icon={ChevronLeft} iconOnly iconSize={24} onPress={handlePrev} />
              <FitText style={s.monthLabel}>{navLabel}</FitText>
              <FitButton variant="link" icon={ChevronRight} iconOnly iconSize={24} onPress={handleNext} />
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
          <View style={s.body}>
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
                    const isBeforeMin = minSelectable ? cell.ymd < minSelectable : false;
                    const isPast = blockPast && cell.ymd < todayStr;
                    const isDisabled = isPast || isBeforeMin;
                    return (
                      <View key={cell.ymd} style={s.dayCell}>
                        <FitButton
                          label={String(cell.dayNumber)}
                          variant={isSelected ? "primary" : "ghost"}
                          onPress={() => !isDisabled && onSelect(cell.ymd)}
                          disabled={isDisabled}
                          style={[
                            s.dayButton,
                            !isSelected && isToday ? { borderColor: colors.brand } : undefined
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
                  return (
                    <FitButton
                      key={monthName}
                      label={monthName}
                      variant={isActive ? "primary" : "ghost"}
                      onPress={() => {
                        setCursor(new Date(year, index, 1));
                        setCurrentView("DAYS");
                      }}
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
                  return (
                    <FitButton
                      key={value}
                      label={String(value)}
                      variant={isActive ? "primary" : "ghost"}
                      onPress={() => {
                        setCursor(new Date(value, monthIndex, 1));
                        setCurrentView("MONTHS");
                      }}
                      style={s.yearCell}
                      textStyle={s.pickerText}
                    />
                  );
                })}
              </View>
            )}
          </View>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Cancel" variant="ghost" onPress={onClose} flex={1} style={s.footerButton} />
            {allowEmpty && <FitButton label="Clear" variant="ghost" onPress={() => onSelect("")} flex={1} style={s.footerButton} />}
            <FitButton label="Today" variant="ghost" onPress={() => onSelect(todayStr)} flex={1} style={s.footerButton} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
