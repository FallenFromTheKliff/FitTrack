"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import { CALENDAR_VIEW_OPTIONS, MONTH_NAMES, MONTH_NAMES_SHORT, WEEK_DAYS } from "@fittrack/app-config";
import type { CalendarViewMode } from "@fittrack/types";
import { formatDateYMD, parseDateYMD } from "@fittrack/utils";
import { BOOKING_CALENDAR_LEGEND } from "@/lib/bookingCalendar";
import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModal from "@/components/modals/FitModal";

type Props = {
  dateTones?: Record<
    string,
    | "available"
    | "complete"
    | "conflict"
    | "full"
    | "limited"
    | "missing"
    | "unavailable"
  >;
  showAvailabilityLegend?: boolean;
  highlightedDates?: string[];
  isOpen: boolean;
  maxDate?: string | null;
  minDate?: string | null;
  closeOnSelect?: boolean;
  keepViewOnMonthSelect?: boolean;
  keepViewOnYearSelect?: boolean;
  preserveViewOnSelectedDateChange?: boolean;
  yearRangeEnd?: number;
  yearRangeStart?: number;
  noScroll?: boolean;
  selectedDate?: string;
  selectableDates?: string[];
  selectableDatesScope?: "all" | "visible-month";
  onVisibleMonthChange?: (year: number, monthIndex: number) => void;
  onSelect: (dateYmd: string) => void;
  onClose: () => void;
};

export default function CalendarModal({
  dateTones = {},
  showAvailabilityLegend = false,
  highlightedDates = [],
  isOpen,
  maxDate,
  minDate,
  closeOnSelect = true,
  keepViewOnMonthSelect = false,
  keepViewOnYearSelect = false,
  preserveViewOnSelectedDateChange = false,
  yearRangeEnd,
  yearRangeStart,
  noScroll = true,
  selectedDate,
  selectableDates,
  selectableDatesScope = "all",
  onVisibleMonthChange,
  onSelect,
  onClose,
}: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const selected = useMemo(() => parseDateYMD(selectedDate), [selectedDate]);
  const [cursor, setCursor] = useState<Date>(selected);
  const [draftDate, setDraftDate] = useState(selectedDate ?? "");
  const [currentView, setCurrentView] = useState<CalendarViewMode>("DAYS");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    setCursor(parseDateYMD(selectedDate));
    setDraftDate(selectedDate ?? "");
    if (!wasOpenRef.current || !preserveViewOnSelectedDateChange) {
      setCurrentView("DAYS");
    }
    wasOpenRef.current = true;
  }, [isOpen, preserveViewOnSelectedDateChange, selectedDate]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  useEffect(() => {
    if (isOpen) onVisibleMonthChange?.(year, monthIndex);
  }, [isOpen, monthIndex, onVisibleMonthChange, year]);
  const monthDays = getDaysInMonth(cursor);
  const offset = getDay(startOfMonth(cursor));
  const todayYmd = formatDateYMD(new Date());
  const minDateYmd = minDate === null ? null : minDate ?? todayYmd;
  const maxDateYmd = maxDate ?? null;
  const selectedYmd = closeOnSelect ? selectedDate ?? "" : draftDate;
  const highlightedDateSet = useMemo(
    () => new Set(highlightedDates),
    [highlightedDates],
  );
  const selectableDateSet = useMemo(
    () => (selectableDates ? new Set(selectableDates) : null),
    [selectableDates],
  );
  const resolvedYearRangeStart = yearRangeStart ?? year - 7;
  const resolvedYearRangeEnd = yearRangeEnd ?? year + 8;
  const yearCells = Array.from(
    { length: Math.max(0, resolvedYearRangeEnd - resolvedYearRangeStart + 1) },
    (_, index) => resolvedYearRangeStart + index,
  );
  const headerTitle = format(cursor, "MMMM yyyy");
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > monthDays) return null;
    const nextDate = new Date(year, monthIndex, dayNumber);
    return { dayNumber, ymd: formatDateYMD(nextDate) };
  });
  const calendarFooterButtonStyle = {
    boxSizing: "border-box" as const,
    height: 38,
    minHeight: 38,
  };
  const updateDraftDate = (dateYmd: string) => {
    setDraftDate(dateYmd);
    if (dateYmd) setCursor(parseDateYMD(dateYmd));
  };
  const getDraftDay = () => (draftDate ? parseDateYMD(draftDate).getDate() : 1);
  const getDateForMonth = (nextYear: number, nextMonth: number) => {
    const monthStart = new Date(nextYear, nextMonth, 1);
    const day = Math.min(getDraftDay(), getDaysInMonth(monthStart));
    return new Date(nextYear, nextMonth, day);
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={headerTitle}
      iconNode={<CalendarDays size={16} color={onBrandTextColor} strokeWidth={2} />}
      titleStyle={{ fontSize: 16, fontWeight: 700 }}
      maxWidth={500}
      closeAriaLabel="Close calendar"
      noScroll={noScroll}
      contentStyle={s.calendarPadding}
      footer={
        <div style={{ ...s.calendarFooter, marginTop: 0, width: "100%", boxSizing: "border-box" }}>
          <FitButton
            variant="ghost"
            onClick={() => {
              if (closeOnSelect) {
                onSelect(todayYmd);
                onClose();
                return;
              }
              updateDraftDate(todayYmd);
            }}
            disabled={
              Boolean(
                (minDateYmd && todayYmd < minDateYmd) ||
                  (maxDateYmd && todayYmd > maxDateYmd),
              )
            }
            style={{ ...s.calendarTodayBtn, ...calendarFooterButtonStyle, flex: "0 0 auto" }}
          >
            Today
          </FitButton>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              flex: "0 1 220px",
              width: 220,
              maxWidth: "100%",
            }}
          >
            <FitButton
              variant="ghost"
              onClick={() => {
                if (closeOnSelect) {
                  onSelect("");
                  return;
                }
                updateDraftDate("");
              }}
              style={{ ...s.calendarClearBtn, ...calendarFooterButtonStyle, width: "100%", minWidth: 0 }}
            >
              Clear
            </FitButton>
            {!closeOnSelect ? (
              <FitButton
                variant="primary"
                label="Done"
                onClick={() => {
                  onSelect(draftDate);
                  onClose();
                }}
                style={{ ...calendarFooterButtonStyle, width: "100%", minWidth: 0 }}
              />
            ) : null}
          </div>
        </div>
      }
    >
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
      {showAvailabilityLegend ? (
        <div
          aria-label="Calendar availability legend"
          role="list"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 10,
          }}
        >
          {BOOKING_CALENDAR_LEGEND.map((item) => {
            const color =
              item.tone === "available"
                ? colors.success
                : item.tone === "full"
                  ? "#ef4444"
                  : colors.textMuted;
            return (
              <div
                key={item.tone}
                role="listitem"
                style={{ alignItems: "center", display: "inline-flex", gap: 5 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    backgroundColor: color,
                    borderRadius: "50%",
                    display: "inline-block",
                    height: 8,
                    width: 8,
                  }}
                />
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  {item.label}
                </FitText>
              </div>
            );
          })}
        </div>
      ) : null}
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
                const isMissingSelectableDate = Boolean(
                  selectableDateSet &&
                    (selectableDatesScope !== "visible-month" ||
                      cell.ymd.slice(0, 7) === format(cursor, "yyyy-MM")) &&
                    !selectableDateSet.has(cell.ymd),
                );
                const isDisabled = Boolean(
                  (minDateYmd && cell.ymd < minDateYmd) ||
                    (maxDateYmd && cell.ymd > maxDateYmd) ||
                    isMissingSelectableDate,
                );
                const isHighlighted = highlightedDateSet.has(cell.ymd);
                const dateTone = dateTones[cell.ymd];
                const toneColor =
                  dateTone === "available" || dateTone === "complete"
                    ? colors.success
                    : dateTone === "conflict" || dateTone === "full" || dateTone === "missing"
                      ? "#ef4444"
                    : dateTone === "limited"
                        ? "#f59e0b"
                        : dateTone === "unavailable"
                          ? colors.textMuted
                          : null;
                const canShowHighlight =
                  isHighlighted && !isSelected && !isDisabled && cell.ymd >= todayYmd;
                return (
                  <FitButton
                    key={cell.ymd}
                    variant={isSelected ? "primary" : "ghost"}
                    label={String(cell.dayNumber)}
                    onClick={() => {
                      if (isDisabled) return;
                      if (closeOnSelect) {
                        onSelect(cell.ymd);
                        onClose();
                        return;
                      }
                      updateDraftDate(cell.ymd);
                    }}
                    disabled={isDisabled}
                    style={{
                      ...s.calendarDayBtn(isSelected, isToday),
                      ...(canShowHighlight
                        ? {
                            borderColor: colors.success,
                            boxShadow: `inset 0 -3px 0 ${colors.success}`,
                            color: colors.success,
                          }
                        : {}),
                      ...(toneColor && !isSelected && !isDisabled
                        ? {
                            borderColor: toneColor,
                            boxShadow: `inset 0 -3px 0 ${toneColor}`,
                            color: toneColor,
                          }
                        : {}),
                      ...(isDisabled
                        ? {
                            backgroundColor: colors.surface,
                            color: colors.textMuted,
                            opacity: 0.42,
                          }
                        : {}),
                    }}
                    aria-label={
                      isDisabled
                        ? `${cell.ymd} is unavailable`
                        : `Select ${cell.ymd}${dateTone ? `, ${dateTone}` : ""}`
                    }
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
                    const nextDate = getDateForMonth(year, index);
                    setCursor(nextDate);
                    if (!closeOnSelect) setDraftDate(formatDateYMD(nextDate));
                    if (closeOnSelect && !keepViewOnMonthSelect) setCurrentView("DAYS");
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
              const yearStartYmd = `${value}-01-01`;
              const yearEndYmd = `${value}-12-31`;
              const isDisabled = Boolean(
                (minDateYmd && yearEndYmd < minDateYmd) ||
                  (maxDateYmd && yearStartYmd > maxDateYmd),
              );
              return (
                <FitButton
                  key={value}
                  variant={isActive ? "primary" : "ghost"}
                  label={String(value)}
                  onClick={() => {
                    if (isDisabled) return;
                    const nextDate = getDateForMonth(value, monthIndex);
                    setCursor(nextDate);
                    if (!closeOnSelect) setDraftDate(formatDateYMD(nextDate));
                    if (closeOnSelect && !keepViewOnYearSelect) setCurrentView("MONTHS");
                  }}
                  disabled={isDisabled}
                  style={s.calendarPickerBtn(isActive)}
                  aria-label={isDisabled ? `${value} is unavailable` : `Select year ${value}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </FitModal>
  );
}
