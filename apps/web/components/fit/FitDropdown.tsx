"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { useFontClass, useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";

import { FitText } from "./FitText";

const FIT_DROPDOWN_CONTENT_Z_INDEX = 1600;

export type FitDropdownOption = {
  label: string;
  value: string;
  disabled?: boolean;
  isPlaceholder?: boolean;
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
  id?: string;
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
  id,
  leading,
}: FitDropdownProps) {
  const { colors, settings } = useTheme();
  const fontClass = useFontClass();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const longestLabelLength = Math.max(displayLabel.length, ...options.map((option) => option.label.length));
  const labelWidthCh = Math.min(Math.max(longestLabelLength, compact ? 12 : 16), compact ? 26 : 34);
  const triggerHeight = compact ? 32 : 42;
  const isSelected = Boolean(selected && !selected.isPlaceholder);
  const canAnimate = settings.animationLevel !== "none";
  const baseAriaLabel = (ariaLabel ?? placeholder).trim();
  const triggerAriaLabel =
    baseAriaLabel && displayLabel && !baseAriaLabel.toLowerCase().includes(displayLabel.toLowerCase())
      ? `${baseAriaLabel}: ${displayLabel}`
      : baseAriaLabel || displayLabel;

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) setOpen(nextOpen);
      }}
    >
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          aria-label={triggerAriaLabel}
          aria-expanded={open}
          className={cn("fit-dropdown-trigger", fontClass, className)}
          data-filled={isSelected ? "true" : "false"}
          data-option-count={options.length}
          data-value={displayLabel}
          data-animate={canAnimate ? "true" : "false"}
          disabled={disabled}
          style={{
            width: fullWidth ? "100%" : `calc(${labelWidthCh}ch + ${compact ? 48 : 58}px)`,
            minWidth: fullWidth ? 0 : compact ? 148 : 180,
            maxWidth: "100%",
            minHeight: triggerHeight,
            padding: compact ? "0 10px" : "0 12px",
            ...style,
            background: colors.surfaceRaised,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            boxShadow: "none",
            color: colors.textPrimary,
            height: "auto",
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <span
            className="fit-dropdown-value"
            style={{
              flex: 1,
            }}
          >
            {leading}
            <FitText
              as="span"
              className="fit-dropdown-label"
              excludeGlobalScale
              style={{
                color: "inherit",
                fontSize: compact ? 13 : 14,
                fontWeight: 750,
                lineHeight: 1.2,
              }}
            >
              {displayLabel}
            </FitText>
          </span>
          <span className="fit-dropdown-chevron" aria-hidden="true">
            <ChevronDown size={15} color="currentColor" />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          onKeyDownCapture={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          className={cn("fit-dropdown-content", fontClass)}
          data-animate={canAnimate ? "true" : "false"}
          style={{
            minWidth: "var(--radix-dropdown-menu-trigger-width)",
            maxHeight: "min(340px, var(--radix-dropdown-menu-content-available-height))",
            ...contentStyle,
            background: colors.surface,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            boxShadow: "none",
            zIndex: FIT_DROPDOWN_CONTENT_Z_INDEX,
          }}
        >
          {options.map((option) => {
            const active = option.value === value;
            const activeOption = active && !option.isPlaceholder;
            return (
              <DropdownMenu.Item
                key={option.value}
                disabled={option.disabled}
                onSelect={() => onChange(option.value)}
                className="fit-dropdown-item"
                style={{
                  minHeight: compact ? 32 : 36,
                  color: colors.textPrimary,
                  fontSize: compact ? 12 : 13,
                  fontWeight: activeOption ? 800 : 650,
                  opacity: option.disabled ? 0.48 : 1,
                }}
                data-active={activeOption ? "true" : "false"}
              >
                <FitText
                  as="span"
                  className="fit-dropdown-item-label"
                  excludeGlobalScale
                  style={{ color: "inherit", fontSize: "inherit", fontWeight: "inherit" }}
                >
                  {option.label}
                </FitText>
                <span className="fit-dropdown-check" aria-hidden="true">
                  {activeOption ? <Check size={14} color={colors.brand} /> : null}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
