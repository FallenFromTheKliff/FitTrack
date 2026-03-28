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

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "time" | "password" | "select" | "radio" | "textarea";
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
  pattern?: string;
  hint?: string;
  maxLength?: number;
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
  dangerLabel?: string;
  dangerIcon?: LucideIcon;
  dangerDisabled?: boolean;
  onDanger?: () => void;
  children?: React.ReactNode;
  readOnly?: boolean;
  readOnlyBanner?: string;
  disableUnchanged?: boolean;
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
  dangerLabel,
  dangerIcon,
  dangerDisabled = false,
  onDanger,
  children,
  readOnly = false,
  readOnlyBanner,
  disableUnchanged = false
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

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      onChange?.(next);
      return next;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    onSubmit(formData);
  };

  const hasChanges = useMemo(() => (
    fields.some((field) => (formData[field.name] ?? "") !== (initialSnapshot[field.name] ?? ""))
  ), [fields, formData, initialSnapshot]);

  const disableSubmit = !readOnly && disableUnchanged && !hasChanges;

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      subtitle={subtitle}
      icon={FileText}
      hideFooterDivider
      footer={readOnly ? undefined : (
        <FitButton
          variant="primary"
          label={submitLabel}
          loading={isLoading}
          onClick={handleSubmit}
          disabled={disableSubmit}
          style={{ flex: 1 }}
        />
      )}
    >
      {readOnly && readOnlyBanner && (
        <div style={s.readOnlyBanner}>
          <FitText style={s.readOnlyBannerText}>{readOnlyBanner}</FitText>
        </div>
      )}
      {fields.map((field) => (
        <div key={field.name} style={s.field}>
          <FitText as="label" style={s.fieldLabel}>
            {field.label}
            {field.required && !readOnly && <FitText as="span" style={s.requiredAsterisk}>*</FitText>}
          </FitText>
          {field.type === "select" ? (
            <FitSelect
              fullWidth
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={`Select ${field.label}`}
              options={field.options ?? []}
              style={s.fieldSelect}
              disabled={readOnly}
            />
          ) : field.type === "radio" ? (
            <div style={s.radioGroup}>
              {field.options?.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    ...s.radioOption,
                    ...(formData[field.name] === opt.value ? s.radioOptionSelected : {}),
                    ...(readOnly ? s.readOnlyRadio : {})
                  }}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={formData[field.name] === opt.value}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    style={s.radioInput}
                    disabled={readOnly}
                  />
                  <FitText as="span">{opt.label}</FitText>
                </label>
              ))}
            </div>
          ) : field.type === "textarea" ? (
            <FitTextArea
              placeholder={field.placeholder}
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              maxLength={field.maxLength}
              disabled={readOnly}
              rows={4}
              style={{ ...s.fieldInput, ...s.fieldTextarea, ...(readOnly ? s.readOnlyField : {}) }}
            />
          ) : (
            <FitTextInput
              type={field.type}
              placeholder={field.placeholder}
              value={formData[field.name] ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              pattern={field.pattern}
              maxLength={field.maxLength}
              disabled={readOnly}
              style={{ ...s.fieldInput, ...(readOnly ? s.readOnlyField : {}) }}
            />
          )}
          {field.hint && !errors[field.name] && (
            <FitText style={s.hintText}>{field.hint}</FitText>
          )}
          {errors[field.name] && (
            <FitText style={s.errorText}>{errors[field.name]}</FitText>
          )}
        </div>
      ))}
      {children}
      {!readOnly && dangerLabel && onDanger && (
        <FitButton
          variant="danger"
          label={dangerLabel}
          icon={dangerIcon}
          fullWidth
          onClick={onDanger}
          disabled={dangerDisabled}
          style={{ marginTop: 8 }}
        />
      )}
    </FitModal>
  );
}
