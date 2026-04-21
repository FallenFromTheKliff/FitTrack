"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Search, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDebounce } from "@fittrack/hooks";
import { makeFitSearchStyles } from "@/styles/fitStyles";
import { FitTextInput } from "./FitText";
import FitButton from "./FitButton";

type Props = {
  id?: string;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  isFabOpen?: boolean;
  className?: string;
  compact?: boolean;
};

export default function FitSearch({
  id,
  name,
  ariaLabel,
  placeholder = "Search...",
  value,
  onChangeText,
  isFabOpen = false,
  className,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const s = makeFitSearchStyles(colors);
  const [inputValue, setInputValue] = useState(value);
  const debouncedInput = useDebounce(inputValue, 300);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (debouncedInput !== value) onChangeText(debouncedInput);
  }, [debouncedInput, onChangeText, value]);

  return (
    <div
      style={{
        ...s.field,
        ...(compact
          ? {
              paddingLeft: 12,
              paddingRight: 10,
              paddingTop: 9,
              paddingBottom: 9,
              gap: 8,
            }
          : null),
        pointerEvents: isFabOpen ? "none" : "auto",
      }}
      className={className}
    >
      <Search size={compact ? 18 : 20} color={colors.textMuted} strokeWidth={2} />
      <FitTextInput
        id={id}
        name={name}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        style={{ ...s.input, ...(compact ? { fontSize: 14 } : null) }}
      />
      {inputValue.length > 0 && (
        <FitButton
          variant="iconClear"
          iconOnly
          icon={XCircle}
          iconSize={compact ? 16 : 18}
          onClick={() => setInputValue("")}
        />
      )}
    </div>
  );
}

type FitSearchActionBarProps = {
  search: ReactNode;
  actions: ReactNode;
  filters?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function FitSearchActionBar({ search, actions, filters, className, style }: FitSearchActionBarProps) {
  const { colors } = useTheme();
  const s = makeFitSearchStyles(colors);
  const hasFilters = !!filters;
  return (
    <div className={className} style={s.actionBar(style)}>
      <div style={s.actionRow(hasFilters)}>
        <div style={s.searchWrap}>{search}</div>
        <div style={s.actionsWrap}>{actions}</div>
      </div>
      {filters}
    </div>
  );
}
