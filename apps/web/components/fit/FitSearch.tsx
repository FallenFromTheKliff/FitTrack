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
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  isFabOpen?: boolean;
  className?: string;
};

export default function FitSearch({
  placeholder = "Search...",
  value,
  onChangeText,
  isFabOpen = false,
  className
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
      style={{ ...s.field, pointerEvents: isFabOpen ? "none" : "auto" }}
      className={className}
    >
      <Search size={20} color={colors.textMuted} strokeWidth={2} />
      <FitTextInput
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        style={s.input}
      />
      {inputValue.length > 0 && (
        <FitButton
          variant="iconClear"
          iconOnly
          icon={XCircle}
          iconSize={18}
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