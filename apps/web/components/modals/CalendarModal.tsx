"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import { WEEK_DAYS } from "@/data/ui/calendar";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";

type Props = {
  isOpen: boolean;
  selectedDate?: string;
  onSelect: (dateYmd: string) => void;
  onClose: () => void;
  title?: string;
};

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseYmd = (value?: string): Date => {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const monthLabel = (date: Date): string =>
  date.toLocaleString("en-US", { month: "long", year: "numeric" });

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

const firstDayOffset = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex, 1).getDay();

export default function CalendarModal({
  isOpen,
  selectedDate,
  onSelect,
  onClose,
  title = "Select Date"
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const selected = useMemo(() => parseYmd(selectedDate), [selectedDate]);
  const [cursor, setCursor] = useState<Date>(selected);

  useEffect(() => {
    if (isOpen) setCursor(parseYmd(selectedDate));
  }, [isOpen, selectedDate]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthDays = daysInMonth(year, monthIndex);
  const offset = firstDayOffset(year, monthIndex);
  const todayYmd = toYmd(new Date());
  const selectedYmd = selectedDate ?? "";

  const cells = Array.from({ length: 42 }).map((_, idx) => {
    const dayNum = idx - offset + 1;
    if (dayNum < 1 || dayNum > monthDays) return null;
    const cellDate = new Date(year, monthIndex, dayNum);
    return { dayNum, ymd: toYmd(cellDate) };
  });

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      iconNode={<CalendarDays size={15} color={onBrandTextColor} strokeWidth={2} />}
      titleStyle={{ fontSize: 14 }}
      maxWidth={500}
      closeAriaLabel="Close calendar"
      noScroll
    >
      <div style={s.calendarPadding}>
        <div style={s.calendarNavRow}>
          <FitButton
            variant="ghost"
            iconOnly
            icon={ChevronLeft}
            iconSize={15}
            onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
            style={s.calendarNavBtn}
            aria-label="Previous month"
          />
          <FitText style={s.calendarMonthLabel}>{monthLabel(cursor)}</FitText>
          <FitButton
            variant="ghost"
            iconOnly
            icon={ChevronRight}
            iconSize={15}
            onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
            style={s.calendarNavBtn}
            aria-label="Next month"
          />
        </div>
        <div style={{ ...s.calendarGrid, marginBottom: 8 }}>
          {WEEK_DAYS.map((label) => (
            <FitText key={label} style={s.calendarWeekDay}>{label}</FitText>
          ))}
        </div>
        <div style={s.calendarGrid}>
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} style={s.calendarEmptyCell} />;
            const isSelected = cell.ymd === selectedYmd;
            const isToday = cell.ymd === todayYmd;
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => { onSelect(cell.ymd); onClose(); }}
                style={s.calendarDayBtn(isSelected, isToday)}
              >
                {cell.dayNum}
              </button>
            );
          })}
        </div>
        <div style={s.calendarFooter}>
          <FitButton variant="ghost" onClick={() => onSelect("")} style={s.calendarClearBtn}>
            Clear
          </FitButton>
          <FitButton
            variant="ghost"
            onClick={() => { onSelect(todayYmd); onClose(); }}
            style={s.calendarTodayBtn}
          >
            Today
          </FitButton>
        </div>
      </div>
    </FitModal>
  );
}
