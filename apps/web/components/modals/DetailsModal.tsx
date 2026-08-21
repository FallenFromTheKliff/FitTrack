"use client";
import { useMemo, useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit/FitCard";
import { FitText, FitTextInput, FitTextArea } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";
import CoachSpecialtyPicker from "@/components/coaching/CoachSpecialtyPicker";

export type FieldConfig = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "time"
    | "password"
    | "date"
    | "number"
    | "tel"
    | "select"
    | "multi-select"
    | "radio"
    | "textarea";
  required?: boolean;
  readOnly?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
  pattern?: string;
  hint?: string;
  maxLength?: number;
  max?: number | string;
  min?: number | string;
  step?: number | string;
};

type Props = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  fields: FieldConfig[];
  initialValues?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => void;
  onChange?: (data: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  submitDisabled?: boolean;
  dangerLabel?: string;
  dangerIcon?: LucideIcon;
  dangerDisabled?: boolean;
  onDanger?: () => void;
  children?: React.ReactNode;
  readOnly?: boolean;
  readOnlyBanner?: string;
  disableUnchanged?: boolean;
  showRequiredIndicators?: boolean;
  validateOnChange?: boolean;
  validate?: (data: Record<string, string>) => Record<string, string>;
};

export default function DetailsModal({
  isOpen,
  title,
  subtitle,
  fields,
  initialValues,
  onSubmit,
  onChange,
  onCancel,
  submitLabel = "SAVE",
  isLoading = false,
  submitDisabled = false,
  dangerLabel,
  dangerIcon,
  dangerDisabled = false,
  onDanger,
  children,
  readOnly = false,
  readOnlyBanner,
  disableUnchanged = false,
  showRequiredIndicators = true,
  validateOnChange = false,
  validate
}: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      const snapshot = initialValues ?? {};
      setFormData(snapshot);
      setInitialSnapshot(snapshot);
      setErrors({});
    }
  }, [isOpen, initialValues]);

  const getValidationErrors = (data: Record<string, string>) => {
    const requiredErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (!field.readOnly && field.required && !data[field.name]?.trim()) {
        requiredErrors[field.name] = `${field.label} is required`;
      }
    });

    return { ...requiredErrors, ...(validate?.(data) ?? {}) };
  };

  const handleChange = (name: string, value: string) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    onChange?.(next);
    if (validateOnChange) {
      const validationErrors = getValidationErrors(next);
      setErrors((prev) => {
        const nextErrors = { ...prev };
        if (validationErrors[name]) {
          nextErrors[name] = validationErrors[name];
        } else {
          delete nextErrors[name];
        }
        return nextErrors;
      });
      return;
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = () => {
    const nextErrors = getValidationErrors(formData);
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }
    onSubmit(formData);
  };

  const hasChanges = useMemo(() => (
    fields.some((field) => !field.readOnly && (formData[field.name] ?? "") !== (initialSnapshot[field.name] ?? ""))
  ), [fields, formData, initialSnapshot]);

  const disableSubmit = !readOnly && disableUnchanged && !hasChanges;

  const getMultiSelectValues = (name: string) =>
    (formData[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const toggleMultiSelectValue = (field: FieldConfig, value: string) => {
    const selectedValues = getMultiSelectValues(field.name);
    const nextValues = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];
    handleChange(field.name, nextValues.join(", "));
  };

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      subtitle={subtitle}
      icon={FileText}
      hideFooterDivider
      footer={readOnly ? undefined : (
        <>
          {dangerLabel && onDanger ? (
            <FitButton
              variant="danger"
              label={dangerLabel}
              icon={dangerIcon}
              onClick={onDanger}
              disabled={dangerDisabled}
              style={{ flex: 1 }}
            />
          ) : null}
          <FitButton
            variant="primary"
            label={submitLabel}
            loading={isLoading}
            onClick={handleSubmit}
            disabled={disableSubmit || submitDisabled}
            style={{ flex: 1 }}
          />
        </>
      )}
    >
      {readOnly && readOnlyBanner && (
        <div style={s.readOnlyBanner}>
          <FitText style={s.readOnlyBannerText}>{readOnlyBanner}</FitText>
        </div>
      )}
      {fields.map((field) => {
        const fieldReadOnly = readOnly || field.readOnly === true;
        const fieldId = `details-${field.name}`;
        return (
        <div key={field.name} style={s.field}>
          <FitText as="label" htmlFor={fieldId} style={s.fieldLabel}>
            {field.label}
            {showRequiredIndicators && field.required && !fieldReadOnly && (
              <FitText as="span" style={s.requiredAsterisk}>*</FitText>
            )}
          </FitText>
          {field.name === "specialties" ? (
            <CoachSpecialtyPicker
              id={fieldId}
              ariaLabel={field.label}
              disabled={fieldReadOnly}
              onChange={(values) => handleChange(field.name, values.join(", "))}
              value={getMultiSelectValues(field.name)}
            />
          ) : field.type === "select" ? (
            <FitSelect
              id={fieldId}
              fullWidth
              name={field.name}
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={`Select ${field.label}`}
              options={field.options ?? []}
              style={s.fieldSelect}
              disabled={fieldReadOnly}
            />
          ) : field.type === "multi-select" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                ...(field.options ?? []),
                ...getMultiSelectValues(field.name)
                  .filter(
                    (value) =>
                      !(field.options ?? []).some((option) => option.value === value),
                  )
                  .map((value) => ({ label: value, value })),
              ].map((opt) => {
                const selected = getMultiSelectValues(field.name).includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={fieldReadOnly}
                    onClick={() => toggleMultiSelectValue(field, opt.value)}
                    style={{
                      backgroundColor: selected ? colors.brand : colors.surfaceRaised,
                      border: `1px solid ${selected ? `${colors.brand}66` : colors.border}`,
                      borderRadius: 999,
                      color: selected ? colors.onBrand : colors.textPrimary,
                      cursor: fieldReadOnly ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                      minHeight: 34,
                      padding: "7px 12px",
                      boxShadow: selected ? `0 0 0 1px ${colors.brand}22 inset` : "none",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : field.type === "radio" ? (
            <div style={s.radioGroup}>
              {field.options?.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    ...s.radioOption,
                    ...(formData[field.name] === opt.value ? s.radioOptionSelected : {}),
                    ...(fieldReadOnly ? s.readOnlyRadio : {})
                  }}
                >
                  <input
                    id={`${fieldId}-${opt.value}`}
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={formData[field.name] === opt.value}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    style={s.radioInput}
                    disabled={fieldReadOnly}
                  />
                  <FitText as="span">{opt.label}</FitText>
                </label>
              ))}
            </div>
          ) : field.type === "textarea" ? (
            <FitTextArea
              id={fieldId}
              name={field.name}
              autoComplete="off"
              placeholder={field.placeholder}
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              maxLength={field.maxLength}
              disabled={fieldReadOnly}
              rows={4}
              style={{ ...s.fieldInput, ...s.fieldTextarea, ...(fieldReadOnly ? s.readOnlyField : {}) }}
            />
          ) : (
            <FitTextInput
              id={fieldId}
              name={field.name}
              autoComplete="off"
              type={field.type}
              inputMode={field.type === "tel" ? "tel" : undefined}
              placeholder={field.placeholder}
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              pattern={field.pattern}
              maxLength={field.maxLength}
              min={field.min}
              max={field.max}
              step={field.step}
              disabled={fieldReadOnly}
              style={{ ...s.fieldInput, ...(fieldReadOnly ? s.readOnlyField : {}) }}
            />
          )}
          {field.hint && !errors[field.name] && (
            <FitText style={s.hintText}>{field.hint}</FitText>
          )}
          {errors[field.name] && (
            <FitText style={s.errorText}>{errors[field.name]}</FitText>
          )}
        </div>
        );
      })}
      {children}
    </FitModal>
  );
}
