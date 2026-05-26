import { useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Controller } from "react-hook-form";
import type { Control, FieldErrors, FieldValues, Path, RegisterOptions } from "react-hook-form";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makeFitInputFieldStyles } from "@/styles/components/FitStyles";

import { FitText, FitTextInput } from "./FitText";
import FitButton from "./FitButton";

type FitInputFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  placeholder: string;
  errors: FieldErrors<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  icon?: LucideIcon;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  optional?: boolean;
  onChangeValue?: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  compact?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  displayValue?: string;
  trailingIcon?: LucideIcon;
  sanitizeValue?: (value: string) => string;
  phonePrefixOptions?: ReadonlyArray<{ label: string; value: string }>;
  phonePrefixValue?: string;
  onPhonePrefixChange?: (value: string) => void;
  formatInputValue?: (value: string) => string;
};

const filterInput = (text: string, keyboardType: string) => {
  if (keyboardType === "phone-pad" || keyboardType === "numeric") {
    return text.replace(/[^0-9]/g, "");
  }
  return text;
};

export default function FitInputField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  errors,
  rules,
  icon: Icon,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  multiline = false,
  maxLength,
  editable = true,
  optional = false,
  onChangeValue,
  onFocusChange,
  compact = false,
  pressable = false,
  onPress,
  displayValue,
  trailingIcon: TrailingIcon,
  sanitizeValue,
  phonePrefixOptions,
  phonePrefixValue,
  onPhonePrefixChange,
  formatInputValue
}: FitInputFieldProps<TFieldValues>) {
  const { colors } = useTheme();
  const s = useMemo(() => makeFitInputFieldStyles(colors, compact), [colors, compact]);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const isFocusedRef = useRef(false);

  const error = errors[name];
  const hasError = editable && !!error;
  const isSecure = secureTextEntry && !visible;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value } }) => {
        const rawValue = value == null ? "" : String(value);
        const renderedValue = formatInputValue ? formatInputValue(rawValue) : rawValue;

        return (
          <View style={s.wrapper}>
          <View style={s.labelRow}>
            <FitText style={[s.label, !editable && s.labelDisabled]}>
              {label}
            </FitText>
            {optional && <FitText style={s.labelOptional}>(optional)</FitText>}
          </View>
          {pressable ? (
            <View
              style={[
                s.inputRow,
                hasError && s.inputRowError,
                !editable && s.inputRowDisabled
              ]}
            >
              {Icon && (
                <Icon
                  size={20}
                  color={editable ? colors.textMuted : colors.textDisabled}
                  strokeWidth={1.8}
                  style={s.fieldIcon}
                />
              )}
              <Pressable
                style={s.pressableField}
                onPress={editable ? onPress : undefined}
                disabled={!editable}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: !editable }}
              >
                <FitText
                  style={[
                    s.pressableFieldText,
                    value ? s.pressableFieldTextFilled : s.pressableFieldTextPlaceholder,
                    !editable && { color: colors.textDisabled }
                  ]}
                  numberOfLines={1}
                >
                  {displayValue || value || placeholder}
                </FitText>
              </Pressable>
              {TrailingIcon && (
                <TrailingIcon
                  size={18}
                  color={editable ? colors.textMuted : colors.textDisabled}
                  strokeWidth={1.8}
                />
              )}
            </View>
          ) : (
            <View
              style={[
                s.inputRow,
                focused && s.inputRowFocused,
                hasError && s.inputRowError,
                !editable && s.inputRowDisabled,
                multiline && { alignItems: "flex-start" }
              ]}
            >
              {phonePrefixOptions?.length && phonePrefixValue && onPhonePrefixChange ? (
                <View style={s.prefixToggle}>
                  {phonePrefixOptions.map((option) => {
                    const isActive = option.value === phonePrefixValue;
                    return (
                      <Pressable
                        key={option.value}
                        style={[s.prefixOption, isActive && s.prefixOptionActive]}
                        onPress={() => onPhonePrefixChange(option.value)}
                        disabled={!editable}
                      >
                        <FitText
                          style={[
                            s.prefixOptionText,
                            isActive && s.prefixOptionTextActive,
                            !editable && s.prefixOptionTextDisabled,
                          ]}
                        >
                          {option.label}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {Icon && (
                <Icon
                  size={20}
                  color={editable ? colors.textMuted : colors.textDisabled}
                  strokeWidth={1.8}
                  style={s.fieldIcon}
                />
              )}
              <FitTextInput
                nativeID={String(name)}
                accessibilityLabel={label}
                value={renderedValue}
                placeholder={placeholder}
                placeholderTextColor={
                  editable ? colors.textMuted : colors.textDisabled
                }
                onChangeText={(text) => {
                  const filtered = sanitizeValue ? sanitizeValue(text) : filterInput(text, keyboardType);
                  onChange(filtered);
                  onChangeValue?.(filtered);
                }}
                onFocus={() => {
                  isFocusedRef.current = true;
                  setFocused(true);
                  onFocusChange?.(true);
                }}
                onBlur={() => {
                  isFocusedRef.current = false;
                  setFocused(false);
                  onBlur();
                  onFocusChange?.(false);
                }}
                secureTextEntry={isSecure}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                multiline={multiline}
                maxLength={maxLength}
                editable={editable}
                style={[
                  !editable && { color: colors.textDisabled },
                  multiline && s.multilineInput
                ]}
              />
              {secureTextEntry && editable && (
                <FitButton
                  variant="link"
                  icon={visible ? EyeOff : Eye}
                  iconSize={24}
                  iconOnly
                  accessibilityLabel={visible ? "Hide password" : "Show password"}
                  onPress={() => setVisible((v) => !v)}
                  style={s.eyeBtn}
                />
              )}
            </View>
          )}
          {compact ? (
            hasError ? <FitText style={s.errorText}>{error?.message as string}</FitText> : null
          ) : (
            <View style={s.errorRow}>
              {hasError && (
                <FitText style={s.errorText}>{error?.message as string}</FitText>
              )}
            </View>
          )}
          </View>
        );
      }}
    />
  );
}
