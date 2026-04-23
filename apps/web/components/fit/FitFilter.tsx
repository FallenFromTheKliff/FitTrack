"use client";
import { CalendarCheck, CalendarDays, RotateCcw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitFilterStyles } from "@/styles/fitStyles";

import { FitText } from "./FitText";
import FitButton from "./FitButton";

export type FitFilterChipOption = {
  label: string;
  value: string;
};

type FitFilterProps = {
  isOpen: boolean;
  chipOptions?: FitFilterChipOption[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  showDateRange?: boolean;
  startDate?: string;
  endDate?: string;
  startDateLabel?: string;
  endDateLabel?: string;
  onStartDateClick?: () => void;
  onEndDateClick?: () => void;
  onStartDateReset?: () => void;
  onEndDateReset?: () => void;
  className?: string;
};

export default function FitFilter({
  isOpen,
  chipOptions,
  activeChip,
  onChipChange,
  showDateRange = false,
  startDate,
  endDate,
  startDateLabel = "All Dates",
  endDateLabel = "End Date",
  onStartDateClick,
  onEndDateClick,
  onStartDateReset,
  onEndDateReset,
  className
}: FitFilterProps) {
  const { colors, settings } = useTheme();
  const s = makeFitFilterStyles(colors);
  const canAnimate = settings.animationLevel === "full";

  if (!isOpen) return null;

  return (
    <div
      className={cn(canAnimate && "transition-opacity transition-transform duration-200 ease-in-out", className)}
      style={s.panel}
    >
      {chipOptions && chipOptions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <FitText style={s.sectionLabel}>Status</FitText>
          <div style={s.chipWrap}>
            {chipOptions.map((opt) => {
              const isActive = activeChip === opt.value;
              return (
                <FitButton
                  key={opt.value}
                  variant="chip"
                  active={isActive}
                  onClick={() => onChipChange?.(opt.value)}
                  label={opt.label}
                />
              );
            })}
          </div>
        </div>
      )}
      {showDateRange && (
        <div>
          <FitText style={s.sectionLabel}>Date Range</FitText>
          <div style={s.dateRangeRow}>
            <FitButton
              variant="chip"
              active={!!startDate}
              icon={CalendarDays}
              iconSize={14}
              onClick={onStartDateClick}
              label={startDateLabel}
            />
            <FitButton
              variant="chip"
              active={!!endDate}
              icon={CalendarCheck}
              iconSize={14}
              onClick={onEndDateClick}
              label={endDateLabel}
            />
          </div>
          <div style={s.resetRow}>
            {startDate ? (
              <FitButton
                variant="link"
                icon={RotateCcw}
                iconSize={13}
                onClick={onStartDateReset}
                label="Reset start date"
                style={s.resetLink}
              />
            ) : null}
            {endDate ? (
              <FitButton
                variant="link"
                icon={RotateCcw}
                iconSize={13}
                onClick={onEndDateReset}
                label="Reset end date"
                style={s.resetLink}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

type InlineFilterOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type FitInlineFilterChipsProps = {
  isOpen: boolean;
  options: InlineFilterOption[];
  activeValue: string;
  onChange: (value: string) => void;
  maxWidth?: number;
};

export function FitInlineFilterChips({
  isOpen,
  options,
  activeValue,
  onChange,
  maxWidth = 420
}: FitInlineFilterChipsProps) {
  const { colors, settings } = useTheme();
  const s = makeFitFilterStyles(colors);
  const canAnimate = settings.animationLevel === "full";

  return (
    <div
      style={s.inlineWrap(isOpen, maxWidth, canAnimate)}
    >
      {options.map((opt) => {
        const isActive = activeValue === opt.value;
        return (
          <FitButton
            key={opt.value}
            variant="chip"
            active={isActive}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            label={opt.label}
            style={s.inlineChip}
          />
        );
      })}
    </div>
  );
}
