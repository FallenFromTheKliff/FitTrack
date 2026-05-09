"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useFontClass, useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";

import { FitText } from "./FitText";

export type FitDropdownOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type FitDropdownProps = {
  options: FitDropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  ariaLabel?: string;
  leading?: ReactNode;
};

export default function FitDropdown({
  options,
  value,
  onChange,
  placeholder = "Select",
  compact = false,
  fullWidth = false,
  disabled = false,
  className,
  style,
  contentStyle,
  ariaLabel,
  leading,
}: FitDropdownProps) {
  const { colors } = useTheme();
  const fontClass = useFontClass();
  const selected = options.find((option) => option.value === value);
  const triggerHeight = compact ? 32 : 42;
  const isSelected = Boolean(selected);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel ?? placeholder}
          className={cn(fontClass, className)}
          disabled={disabled}
          style={{
            width: fullWidth ? "100%" : "auto",
            minWidth: fullWidth ? 0 : compact ? 148 : 180,
            height: triggerHeight,
            padding: compact ? "0 10px" : "0 12px",
            borderRadius: 10,
            border: `1px solid ${isSelected ? `${colors.brand}88` : colors.border}`,
            backgroundColor: isSelected
              ? `${colors.brand}12`
              : colors.surfaceRaised,
            color: isSelected ? colors.brand : colors.textPrimary,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            boxShadow: isSelected ? `0 0 0 2px ${colors.brand}18` : "none",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
            transition:
              "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
            ...style,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            {leading}
            <FitText
              as="span"
              style={{
                color: "inherit",
                fontSize: compact ? 13 : 14,
                fontWeight: 750,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selected?.label ?? placeholder}
            </FitText>
          </span>
          <ChevronDown size={15} color="currentColor" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          className={fontClass}
          style={{
            minWidth: "var(--radix-dropdown-menu-trigger-width)",
            maxHeight: "min(340px, var(--radix-dropdown-menu-content-available-height))",
            overflowY: "auto",
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            boxShadow: "0 20px 55px rgba(0, 0, 0, 0.34)",
            padding: 6,
            zIndex: 90,
            ...contentStyle,
          }}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <DropdownMenu.Item
                key={option.value}
                disabled={option.disabled}
                onSelect={() => onChange(option.value)}
                style={{
                  minHeight: compact ? 32 : 36,
                  borderRadius: 8,
                  padding: "0 10px",
                  color: active ? colors.brand : colors.textPrimary,
                  backgroundColor: active ? `${colors.brand}16` : "transparent",
                  border: `1px solid ${active ? `${colors.brand}55` : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: compact ? 12 : 13,
                  fontWeight: active ? 800 : 650,
                  outline: "none",
                  cursor: option.disabled ? "not-allowed" : "pointer",
                  opacity: option.disabled ? 0.48 : 1,
                  boxShadow: active ? `0 0 0 1px ${colors.brand}14` : "none",
                }}
              >
                <span>{option.label}</span>
                {active ? <Check size={14} color={colors.brand} /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
