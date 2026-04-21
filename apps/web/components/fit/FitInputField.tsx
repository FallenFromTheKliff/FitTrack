"use client";
import { useState } from "react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions
} from "react-hook-form";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitInputFieldStyles } from "@/styles/fitStyles";

import { FitText, FitTextInput, FitTextArea } from "./FitText";
import FitButton from "./FitButton";

type Props<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  placeholder: string;
  errors: FieldErrors<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  icon?: LucideIcon;
  type?: "text" | "email" | "password" | "tel" | "number";
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  optional?: boolean;
  autoComplete?: string;
  onChangeValue?: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  compact?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  displayValue?: string;
  trailingIcon?: LucideIcon;
  className?: string;
  inputRowStyle?: CSSProperties;
};

export default function FitInputField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  errors,
  rules,
  icon: Icon,
  type = "text",
  multiline = false,
  rows = 4,
  maxLength,
  disabled = false,
  optional = false,
  autoComplete,
  onChangeValue,
  onFocusChange,
  compact = false,
  pressable = false,
  onPress,
  displayValue,
  trailingIcon: TrailingIcon,
  className,
  inputRowStyle
}: Props<TFieldValues>) {
  const { colors } = useTheme();
  const s = makeFitInputFieldStyles(colors, compact);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const error = errors[name];
  const hasError = !disabled && !!error;
  const isPassword = type === "password";
  const resolvedType = isPassword ? (visible ? "text" : "password") : type;
  const borderColor = hasError ? colors.danger : focused ? colors.brand : colors.fieldBorder;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value } }) => (
        <div className={cn(className)} style={s.wrapper}>
          <div style={s.labelRow}>
            <FitText
              as="label"
              htmlFor={name}
              style={{ fontSize: 12, color: disabled ? colors.textDisabled : colors.textSecondary }}
            >
              {label}
            </FitText>
            {optional && (
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>(optional)</FitText>
            )}
          </div>
          {pressable ? (
            <div
              style={{ ...s.inputRow(borderColor, disabled), cursor: disabled ? "not-allowed" : "pointer", ...inputRowStyle }}
              onClick={disabled ? undefined : onPress}
            >
              {Icon && (
                <Icon
                  size={15}
                  color={disabled ? colors.textDisabled : colors.textMuted}
                  strokeWidth={1.8}
                  style={{ marginRight: 8, flexShrink: 0 }}
                />
              )}
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: (displayValue || value) ? colors.textPrimary : colors.textMuted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {displayValue || value || placeholder}
              </span>
              {TrailingIcon && (
                <TrailingIcon
                  size={15}
                  color={disabled ? colors.textDisabled : colors.textMuted}
                  strokeWidth={1.8}
                />
              )}
            </div>
          ) : (
            <div style={{ ...s.inputRow(borderColor, disabled), ...inputRowStyle }}>
              {Icon && (
                <Icon
                  size={15}
                  color={disabled ? colors.textDisabled : colors.textMuted}
                  strokeWidth={1.8}
                  style={{ marginRight: 8, flexShrink: 0 }}
                />
              )}
              {multiline ? (
                <FitTextArea
                  id={name}
                  value={value ?? ""}
                  placeholder={placeholder}
                  rows={rows}
                  maxLength={maxLength}
                  disabled={disabled}
                  className="w-full placeholder:text-text-muted"
                  style={{ color: disabled ? colors.textDisabled : colors.textPrimary }}
                  onChange={(e) => { onChange(e.target.value); onChangeValue?.(e.target.value); }}
                  onFocus={() => { setFocused(true); onFocusChange?.(true); }}
                  onBlur={() => { setFocused(false); onBlur(); onFocusChange?.(false); }}
                />
              ) : (
                <FitTextInput
                  id={name}
                  type={resolvedType}
                  value={value ?? ""}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  disabled={disabled}
                  autoComplete={autoComplete}
                  className="w-full placeholder:text-text-muted"
                  style={{ color: disabled ? colors.textDisabled : colors.textPrimary }}
                  onChange={(e) => { onChange(e.target.value); onChangeValue?.(e.target.value); }}
                  onFocus={() => { setFocused(true); onFocusChange?.(true); }}
                  onBlur={() => { setFocused(false); onBlur(); onFocusChange?.(false); }}
                />
              )}
              {isPassword && !disabled && (
                <FitButton
                  variant="iconClear"
                  iconOnly
                  icon={visible ? EyeOff : Eye}
                  iconSize={15}
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible((v) => !v)}
                  style={s.eyeBtn}
                />
              )}
            </div>
          )}
          {compact ? (
            hasError ? <FitText style={{ fontSize: 12, color: colors.danger }}>{error?.message as string}</FitText> : null
          ) : (
            <div style={s.errorRow}>
              {hasError && (
                <FitText style={{ fontSize: 12, color: colors.danger }}>
                  {error?.message as string}
                </FitText>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
}
