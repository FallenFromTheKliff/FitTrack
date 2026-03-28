"use client";
import { useEffect, useMemo, useState } from "react";
import { format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { CalendarViewMode } from "@fittrack/types";
import { formatDateYMD, parseDateYMD } from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import { CALENDAR_VIEW_OPTIONS, MONTH_NAMES, MONTH_NAMES_SHORT, WEEK_DAYS } from "@/data/ui/calendar";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";

type Props = {
  isOpen: boolean;
  selectedDate?: string;
  onSelect: (dateYmd: string) => void;
  onClose: () => void;
};

export default function CalendarModal({ isOpen, selectedDate, onSelect, onClose }: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const selected = useMemo(() => parseDateYMD(selectedDate), [selectedDate]);
  const [cursor, setCursor] = useState<Date>(selected);
  const [currentView, setCurrentView] = useState<CalendarViewMode>("DAYS");

  useEffect(() => {
    if (isOpen) {
      setCursor(parseDateYMD(selectedDate));
      setCurrentView("DAYS");
    }
  }, [isOpen, selectedDate]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthDays = getDaysInMonth(cursor);
  const offset = getDay(startOfMonth(cursor));
  const todayYmd = formatDateYMD(new Date());
  const selectedYmd = selectedDate ?? "";
  const yearRangeStart = year - 7;
  const yearCells = Array.from({ length: 16 }, (_, index) => yearRangeStart + index);
  const headerTitle = format(cursor, "MMMM yyyy");
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > monthDays) return null;
    const nextDate = new Date(year, monthIndex, dayNumber);
    return { dayNumber, ymd: formatDateYMD(nextDate) };
  });

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={headerTitle}
      iconNode={<CalendarDays size={16} color={onBrandTextColor} strokeWidth={2} />}
      titleStyle={{ fontSize: 16, fontWeight: 700 }}
      maxWidth={500}
      closeAriaLabel="Close calendar"
      noScroll
    >
      <div style={s.calendarPadding}>
        <div style={s.calendarViewRow}>
          {CALENDAR_VIEW_OPTIONS.map((option) => {
            const isActive = option.value === currentView;
            return (
              <FitButton
                key={option.value}
                variant={isActive ? "primary" : "ghost"}
                label={option.label}
                onClick={() => setCurrentView(option.value)}
                style={s.calendarViewBtn(isActive)}
                aria-pressed={isActive}
              />
            );
          })}
        </div>
        <div style={s.calendarBody}>
          {currentView === "DAYS" && (
            <>
              <div style={{ ...s.calendarGrid, marginBottom: 8 }}>
                {WEEK_DAYS.map((label) => (
                  <FitText key={label} style={s.calendarWeekDay}>{label}</FitText>
                ))}
              </div>
              <div style={s.calendarGrid}>
                {dayCells.map((cell, index) => {
                  if (!cell) return <div key={`empty-${index}`} style={s.calendarEmptyCell} />;
                  const isSelected = cell.ymd === selectedYmd;
                  const isToday = cell.ymd === todayYmd;
                  return (
                    <FitButton
                      key={cell.ymd}
                      variant={isSelected ? "primary" : "ghost"}
                      label={String(cell.dayNumber)}
                      onClick={() => {
                        onSelect(cell.ymd);
                        onClose();
                      }}
                      style={s.calendarDayBtn(isSelected, isToday)}
                      aria-label={`Select ${cell.ymd}`}
                    />
                  );
                })}
              </div>
            </>
          )}
          {currentView === "MONTHS" && (
            <div style={s.calendarMonthGrid}>
              {MONTH_NAMES_SHORT.map((monthName, index) => {
                const isActive = index === monthIndex;
                return (
                  <FitButton
                    key={monthName}
                    variant={isActive ? "primary" : "ghost"}
                    label={monthName}
                    onClick={() => {
                      setCursor(new Date(year, index, 1));
                      setCurrentView("DAYS");
                    }}
                    style={s.calendarPickerBtn(isActive)}
                    aria-label={`Select ${MONTH_NAMES[index]}`}
                  />
                );
              })}
            </div>
          )}
          {currentView === "YEARS" && (
            <div style={s.calendarYearGrid}>
              {yearCells.map((value) => {
                const isActive = value === year;
                return (
                  <FitButton
                    key={value}
                    variant={isActive ? "primary" : "ghost"}
                    label={String(value)}
                    onClick={() => {
                      setCursor(new Date(value, monthIndex, 1));
                      setCurrentView("MONTHS");
                    }}
                    style={s.calendarPickerBtn(isActive)}
                    aria-label={`Select year ${value}`}
                  />
                );
              })}
            </div>
          )}
        </div>
        <div style={s.calendarFooter}>
          <FitButton variant="ghost" onClick={() => onSelect("")} style={s.calendarClearBtn}>
            Clear
          </FitButton>
          <FitButton
            variant="ghost"
            onClick={() => {
              onSelect(todayYmd);
              onClose();
            }}
            style={s.calendarTodayBtn}
          >
            Today
          </FitButton>
        </div>
      </div>
    </FitModal>
  );
}
