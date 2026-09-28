"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import CalendarModal from "@/components/modals/CalendarModal";
import FitModal from "@/components/modals/FitModal";
import { modalStyles } from "@/styles/modalStyles";
import {
  ANALYTICS_PERIOD_MAX_YEAR,
  ANALYTICS_PERIOD_MIN_YEAR,
  ANALYTICS_PERIOD_MONTH_NAMES,
  getAnalyticsPeriodWeekOptions,
  getAnalyticsPeriodYearPage,
  getPeriodInitialValue,
  hasSelectablePeriodInYear,
  isPeriodAnchorSelectable,
  normalizePeriodValue,
  parsePeriodYmd,
  type AnalyticsPeriodOption,
} from "./AnalyticsPeriodCalendarModal.logic";

export type AnalyticsPeriodPickerMode = "day" | "week" | "month" | "year";

export type AnalyticsPeriodCalendarModalProps = {
  isOpen: boolean;
  mode: AnalyticsPeriodPickerMode;
  selectedValue?: string | null;
  minValue?: string | null;
  maxValue?: string | null;
  onSelect: (valueYmd: string) => void;
  onClose: () => void;
  title?: string;
};

function modeLabel(mode: AnalyticsPeriodPickerMode) {
  if (mode === "week") return "week";
  if (mode === "month") return "month";
  if (mode === "year") return "year";
  return "day";
}

function defaultTitle(mode: AnalyticsPeriodPickerMode, year: number) {
  if (mode === "week") return `Choose a week in ${year}`;
  if (mode === "month") return `Choose a month in ${year}`;
  return "Choose a year";
}

function monthAnchor(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

function yearAnchor(year: number) {
  return `${String(year).padStart(4, "0")}-01-01`;
}

function chooseYearAnchor(mode: AnalyticsPeriodPickerMode, year: number, currentValue: string) {
  if (mode === "week") {
    return getAnalyticsPeriodWeekOptions(year)[0]?.start ?? yearAnchor(year);
  }
  if (mode === "month") {
    const current = parsePeriodYmd(currentValue);
    return monthAnchor(year, current?.month ?? 1);
  }
  return yearAnchor(year);
}

type NavigationButtonProps = {
  ariaLabel: string;
  disabled: boolean;
  icon: typeof ChevronLeft;
  onClick: () => void;
};

function NavigationButton({ ariaLabel, disabled, icon: Icon, onClick }: NavigationButtonProps) {
  return (
    <FitButton
      aria-label={ariaLabel}
      disabled={disabled}
      icon={Icon}
      iconOnly
      iconSize={18}
      onClick={onClick}
      variant="ghost"
      style={{
        border: "1px solid currentColor",
        borderRadius: 10,
        height: 38,
        minHeight: 38,
        width: 38,
      }}
    />
  );
}

function AnalyticsPeriodCalendarModalSurface({
  isOpen,
  mode,
  selectedValue,
  minValue,
  maxValue,
  onSelect,
  onClose,
  title,
}: AnalyticsPeriodCalendarModalProps) {
  const { colors, onBrandTextColor } = useTheme();
  const s = modalStyles(colors);
  const initialValue = getPeriodInitialValue(mode, selectedValue, minValue, maxValue);
  const [cursorValue, setCursorValue] = useState(initialValue);

  useEffect(() => {
    if (!isOpen) return;
    setCursorValue(getPeriodInitialValue(mode, selectedValue, minValue, maxValue));
  }, [isOpen, maxValue, minValue, mode, selectedValue]);

  const cursor = parsePeriodYmd(cursorValue) ?? parsePeriodYmd(initialValue);
  const cursorYear = cursor?.year ?? new Date().getUTCFullYear();
  const selectedAnchor = normalizePeriodValue(selectedValue, mode);
  const canSelect = (value: string) => isPeriodAnchorSelectable(value, mode, minValue, maxValue);
  const yearPage = mode === "year" ? getAnalyticsPeriodYearPage(cursorYear) : null;
  const hasSelectableYear = (year: number) => hasSelectablePeriodInYear(mode, year, minValue, maxValue);
  const hasSelectableYearPage = (start: number) => {
    const end = Math.min(ANALYTICS_PERIOD_MAX_YEAR, start + 11);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index).some(hasSelectableYear);
  };

  const monthOptions = useMemo<AnalyticsPeriodOption[]>(
    () => ANALYTICS_PERIOD_MONTH_NAMES.map((label, index) => ({
      end: monthAnchor(cursorYear, index + 1),
      label,
      start: monthAnchor(cursorYear, index + 1),
    })),
    [cursorYear],
  );
  const weekOptions = useMemo(
    () => (mode === "week" ? getAnalyticsPeriodWeekOptions(cursorYear) : []),
    [cursorYear, mode],
  );

  const moveYear = (delta: -1 | 1) => {
    const nextYear = cursorYear + delta;
    if (nextYear < ANALYTICS_PERIOD_MIN_YEAR || nextYear > ANALYTICS_PERIOD_MAX_YEAR || !hasSelectableYear(nextYear)) return;
    setCursorValue(chooseYearAnchor(mode, nextYear, cursorValue));
  };

  const moveYearPage = (delta: -1 | 1) => {
    if (!yearPage) return;
    const nextStart = yearPage.start + delta * 12;
    if (nextStart < ANALYTICS_PERIOD_MIN_YEAR || nextStart > ANALYTICS_PERIOD_MAX_YEAR) return;
    const nextEnd = Math.min(ANALYTICS_PERIOD_MAX_YEAR, nextStart + 11);
    const hasSelectable = Array.from({ length: nextEnd - nextStart + 1 }, (_, index) => nextStart + index).some(hasSelectableYear);
    if (!hasSelectable) return;
    setCursorValue(yearAnchor(nextStart));
  };

  const handleSelect = (value: string) => {
    const canonical = normalizePeriodValue(value, mode);
    if (!canonical || !canSelect(canonical)) return;
    onSelect(canonical);
    onClose();
  };

  const pageTitle = title ?? defaultTitle(mode, cursorYear);
  const supportText = mode === "week"
    ? "Select a Monday-to-Sunday range."
    : mode === "month"
      ? "Select one month from the current year."
      : "Select one year from the current page.";
  const gridStyle: CSSProperties = {
    display: "grid",
    gap: 8,
    gridTemplateColumns: mode === "week" ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
  };
  const selectedStyle = (selected: boolean): CSSProperties => ({
    backgroundColor: selected ? `${colors.brand}22` : colors.surfaceRaised,
    border: `1px solid ${selected ? colors.brand : colors.border}`,
    borderRadius: 10,
    color: selected ? colors.brand : colors.textPrimary,
    fontSize: 12,
    fontWeight: selected ? 800 : 600,
    minHeight: mode === "week" ? 48 : 44,
    width: "100%",
  });

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={pageTitle}
      iconNode={<CalendarDays size={16} color={onBrandTextColor} strokeWidth={2} />}
      titleStyle={{ fontSize: 16, fontWeight: 700 }}
      maxWidth={mode === "week" ? 640 : 500}
      closeAriaLabel={`Close ${modeLabel(mode)} picker`}
      noScroll={false}
      contentStyle={s.calendarPadding}
    >
      <div data-analytics-period-picker="true" data-period-mode={mode} style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          {mode === "year" ? (
            <NavigationButton
              ariaLabel="Previous year page"
              disabled={!yearPage || yearPage.start <= ANALYTICS_PERIOD_MIN_YEAR || !hasSelectableYearPage(Math.max(ANALYTICS_PERIOD_MIN_YEAR, (yearPage?.start ?? 1) - 12))}
              icon={ChevronLeft}
              onClick={() => moveYearPage(-1)}
            />
          ) : (
            <NavigationButton
              ariaLabel="Previous year"
              disabled={cursorYear <= ANALYTICS_PERIOD_MIN_YEAR || !hasSelectableYear(cursorYear - 1)}
              icon={ChevronLeft}
              onClick={() => moveYear(-1)}
            />
          )}
          <div style={{ minWidth: 0, textAlign: "center" }}>
            <FitText as="h2" style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 800 }}>
              {mode === "week" ? `Weeks in ${cursorYear}` : mode === "month" ? `Months in ${cursorYear}` : `${yearPage?.start}–${yearPage?.end}`}
            </FitText>
            <FitText as="p" style={{ color: colors.textMuted, fontSize: 11, margin: "4px 0 0" }}>
              {supportText}
            </FitText>
          </div>
          {mode === "year" ? (
            <NavigationButton
              ariaLabel="Next year page"
              disabled={!yearPage || yearPage.end >= ANALYTICS_PERIOD_MAX_YEAR || !hasSelectableYearPage((yearPage?.start ?? 1) + 12)}
              icon={ChevronRight}
              onClick={() => moveYearPage(1)}
            />
          ) : (
            <NavigationButton
              ariaLabel="Next year"
              disabled={cursorYear >= ANALYTICS_PERIOD_MAX_YEAR || !hasSelectableYear(cursorYear + 1)}
              icon={ChevronRight}
              onClick={() => moveYear(1)}
            />
          )}
        </div>

        {mode === "week" ? (
          <>
            <div style={{ ...gridStyle, maxHeight: "48vh", overflowY: "auto" }}>
              {weekOptions.map((option) => {
                const selected = option.start === selectedAnchor;
                const selectable = canSelect(option.start);
                return (
                  <FitButton
                    key={option.start}
                    aria-label={selectable ? `Select week ${option.label}` : `${option.label} is unavailable`}
                    aria-pressed={selected}
                    disabled={!selectable}
                    label={option.label}
                    onClick={() => handleSelect(option.start)}
                    style={{ ...selectedStyle(selected), ...(selectable ? {} : { opacity: 0.42 }) }}
                    variant={selected ? "primary" : "ghost"}
                  />
                );
              })}
            </div>
          </>
        ) : null}

        {mode === "month" ? (
          <div style={gridStyle}>
            {monthOptions.map((option) => {
              const selected = option.start === selectedAnchor;
              const selectable = canSelect(option.start);
              return (
                <FitButton
                  key={option.start}
                  aria-label={selectable ? `Select ${option.label} ${cursorYear}` : `${option.label} ${cursorYear} is unavailable`}
                  aria-pressed={selected}
                  disabled={!selectable}
                  label={option.label}
                  onClick={() => handleSelect(option.start)}
                  style={{ ...selectedStyle(selected), ...(selectable ? {} : { opacity: 0.42 }) }}
                  variant={selected ? "primary" : "ghost"}
                />
              );
            })}
          </div>
        ) : null}

        {mode === "year" && yearPage ? (
          <div style={{ ...gridStyle, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {yearPage.values.map((year) => {
              const value = yearAnchor(year);
              const selected = value === selectedAnchor;
              const selectable = canSelect(value);
              return (
                <FitButton
                  key={year}
                  aria-label={selectable ? `Select year ${year}` : `${year} is unavailable`}
                  aria-pressed={selected}
                  disabled={!selectable}
                  label={String(year)}
                  onClick={() => handleSelect(value)}
                  style={{ ...selectedStyle(selected), ...(selectable ? {} : { opacity: 0.42 }) }}
                  variant={selected ? "primary" : "ghost"}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </FitModal>
  );
}

export function AnalyticsPeriodCalendarModal(props: AnalyticsPeriodCalendarModalProps) {
  if (props.mode === "day") {
    return (
      <CalendarModal
        isOpen={props.isOpen}
        selectedDate={normalizePeriodValue(props.selectedValue, "day") ?? undefined}
        minDate={normalizePeriodValue(props.minValue, "day")}
        maxDate={normalizePeriodValue(props.maxValue, "day")}
        onSelect={(value) => {
          const canonical = normalizePeriodValue(value, "day");
          if (canonical) props.onSelect(canonical);
        }}
        onClose={props.onClose}
      />
    );
  }
  return <AnalyticsPeriodCalendarModalSurface {...props} />;
}

export default AnalyticsPeriodCalendarModal;
