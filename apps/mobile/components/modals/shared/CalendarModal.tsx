import { useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { getDaysInMonth, getFirstDayOfWeek } from "@fittrack/utils";
import { MONTH_NAMES, WEEK_DAYS } from "@/data/calendar";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { usePowerSlide } from "@/hooks/animations/text/usePowerSlide";
import { makeCalendarModalStyles } from "@/styles/modals/CalendarStyles";
import { toDateStr } from "@/utils/date";

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

function darkenHex(hex: string, factor = 0.16) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const nextR = Math.max(0, Math.floor(r * (1 - factor)));
  const nextG = Math.max(0, Math.floor(g * (1 - factor)));
  const nextB = Math.max(0, Math.floor(b * (1 - factor)));
  return `#${((1 << 24) + (nextR << 16) + (nextG << 8) + nextB).toString(16).slice(1)}`;
}

export default function CalendarModal({ isVisible, selectedDate, allowEmpty, blockPast = false, minDate, defaultYear, defaultMonth, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeCalendarModalStyles(colors), [colors]);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const minSelectable = minDate && minDate > todayStr ? minDate : blockPast ? todayStr : minDate ?? "";
  const selectedBg = darkenHex(colors.brand, 0.18);

  const [viewYear, setViewYear] = useState(() => {
    const parts = selectedDate?.split("-");
    return parts?.length === 3 ? parseInt(parts[0]) : defaultYear ?? today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const parts = selectedDate?.split("-");
    return parts?.length === 3 ? parseInt(parts[1]) : defaultMonth ?? (today.getMonth() + 1);
  });
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));
  const { style: monthSlideStyle } = usePowerSlide(slideKey, slideDir);

  const prevMonth = () => {
    setSlideDir("left");
    setSlideKey((k) => k + 1);
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSlideDir("right");
    setSlideKey((k) => k + 1);
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstWeekday = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ];

  return (
      <Modal
          visible={isVisible}
          transparent
          animationType="none"
          onRequestClose={onClose}
          statusBarTranslucent
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
            <Animated.View style={[s.header, headerBorderStyle]}>
              <View style={s.navRow}>
                <FitButton variant="link" icon={ChevronLeft} iconOnly iconSize={24} onPress={prevMonth} />
                <Animated.View style={monthSlideStyle}>
                  <FitText style={s.monthLabel}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</FitText>
                </Animated.View>
                <FitButton variant="link" icon={ChevronRight} iconOnly iconSize={24} onPress={nextMonth} />
              </View>
            </Animated.View>
            <View style={s.weekRow}>
              {WEEK_DAYS.map((d) => (
                  <FitText key={d} style={s.weekDay}>{d}</FitText>
              ))}
            </View>
            <View style={s.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={s.dayCell} />;
                const dateStr = toDateStr(viewYear, viewMonth, day);
                const isSelected = (!allowEmpty || selectedDate !== "") ? dateStr === selectedDate : false;
                const isToday = dateStr === todayStr;
                const isBeforeMin = minSelectable ? dateStr < minSelectable : false;
                const isPast = blockPast && dateStr < todayStr;
                const isDisabled = isPast || isBeforeMin;
                return (
                    <Pressable
                        key={dateStr}
                        style={[
                          s.dayCell,
                          isSelected && s.dayCellSelected,
                          isSelected && { backgroundColor: selectedBg },
                          !isSelected && isToday && s.dayCellToday
                        ]}
                        onPress={() => !isDisabled && onSelect(dateStr)}
                        disabled={isDisabled}
                    >
                      <FitText
                          style={[
                            s.dayText,
                            {
                              color: isSelected
                                  ? colors.base
                                  : isDisabled
                                      ? colors.textDisabled
                                      : colors.textPrimary
                            },
                            isSelected && { fontWeight: "700" }
                          ]}
                      >
                        {day}
                      </FitText>
                    </Pressable>
                );
              })}
            </View>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton label="Cancel" variant="ghost" onPress={onClose} flex={1} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}