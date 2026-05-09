"use client";
import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { modalStyles } from "@/styles/modalStyles";
import { VENUE_BOOKING_OPTIONS, VENUE_FLOOR_OPTIONS, VENUE_ICON_OPTIONS } from "@/data/facilities/venueFields";
import type { VenueRecord } from "@/data/facilities/mapTypes";

import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit/FitCard";
import { FitText, FitTextInput, FitTextArea } from "@/components/fit/FitText";
import { FacilityImageUploadCard } from "./FacilityImageUploadCard";

type Props = {
  isVisible: boolean;
  editTarget: VenueRecord | null;
  initialValues: Record<string, string>;
  submitLabel: string;
  isLoading: boolean;
  onUploadImage?: (file: File) => Promise<string | null>;
  onSubmit: (data: Record<string, string>) => void;
  onDelete: () => void;
  onBack?: () => void;
  backLabel?: string;
};

const REQUIRED_FIELDS = ["name", "capacity", "gridColumn", "gridRow", "gridWidth", "gridHeight"] as const;

export function EditVenueModal({
  isVisible,
  editTarget,
  initialValues,
  submitLabel,
  isLoading,
  onUploadImage,
  onSubmit,
  onDelete,
  onBack,
  backLabel = "Back to Table"
}: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const [formData, setFormData] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"details" | "placement">("details");
  const panelStyle = useMemo(() => ({
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 14,
    display: "grid",
    gap: 12,
    gridTemplateRows: "auto auto minmax(0, 1fr) auto",
    height: "100%",
    minHeight: 0,
    maxWidth: 980,
    margin: "0 auto",
    overflow: "hidden",
    width: "100%"
  }), [colors.border, colors.surface]);

  useEffect(() => {
    if (!isVisible) return;
    setFormData(initialValues);
    setErrors({});
    setStep("details");
  }, [initialValues, isVisible]);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    REQUIRED_FIELDS.forEach((field) => {
      if (!(formData[field] ?? "").trim()) {
        nextErrors[field] = "Required";
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit(formData);
  };

  const handleVenueImageUpload = async (file: File) => {
    if (!onUploadImage || isLoading) {
      return;
    }

    const imageUrl = await onUploadImage(file);
    if (imageUrl) {
      handleChange("imageUrl", imageUrl);
    }
  };

  const handleBack = () => {
    if (step === "placement") {
      setStep("details");
      return;
    }
    onBack?.();
  };

  const handlePrimary = () => {
    if (step === "details") {
      setStep("placement");
      return;
    }
    handleSubmit();
  };

  const renderField = ({
    name,
    label,
    required = false,
    type = "text",
    placeholder,
    options
  }: {
    name: string;
    label: string;
    required?: boolean;
    type?: "text" | "textarea" | "select";
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  }) => (
    <div style={{ display: "grid", gap: 6 }}>
      <FitText as="label" style={s.fieldLabel}>
        {label}
        {required ? <FitText as="span" style={s.requiredAsterisk}>*</FitText> : null}
      </FitText>
      {type === "textarea" ? (
        <FitTextArea
          rows={4}
          value={formData[name] ?? ""}
          onChange={(e) => handleChange(name, e.target.value)}
          placeholder={placeholder}
          style={{ ...s.fieldInput, ...s.fieldTextarea }}
        />
      ) : type === "select" ? (
        <FitSelect
          fullWidth
          value={formData[name] ?? ""}
          onChange={(e) => handleChange(name, e.target.value)}
          options={options ?? VENUE_ICON_OPTIONS}
          style={{ borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg }}
        />
      ) : (
        <FitTextInput
          value={formData[name] ?? ""}
          onChange={(e) => handleChange(name, e.target.value)}
          placeholder={placeholder}
          style={s.fieldInput}
        />
      )}
      {errors[name] ? <FitText style={s.errorText}>{errors[name]}</FitText> : null}
    </div>
  );

  return (
    <div style={panelStyle}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <FitText as="h3" style={{ fontSize: 18, fontWeight: 800 }}>
            {editTarget ? "Edit Venue" : "Add Venue"}
          </FitText>
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>
            {step === "details"
              ? "Set the member-facing venue profile."
              : "Place the venue on the active facility map."}
          </FitText>
        </div>
        <FitButton
          variant="ghost"
          label={step === "details" ? backLabel : "Back"}
          onClick={handleBack}
          style={{ height: 32, minHeight: 32 }}
          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
        }}
      >
        {[
          ["details", "Details"],
          ["placement", "Placement"]
        ].map(([value, label]) => {
          const isActive = step === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStep(value as "details" | "placement")}
              style={{
                border: `1px solid ${isActive ? colors.brand : colors.border}`,
                borderRadius: 8,
                backgroundColor: isActive ? `${colors.brand}18` : colors.surfaceRaised,
                color: isActive ? colors.brand : colors.textSecondary,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 800,
                minHeight: 34
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {step === "details" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(116px, 0.34fr)", gap: 12 }}>
              {renderField({ name: "name", label: "Name", required: true, placeholder: "e.g., Boxing Ring" })}
              {renderField({ name: "capacity", label: "Capacity", required: true, placeholder: "25" })}
            </div>
            {renderField({
              name: "description",
              label: "Description",
              type: "textarea",
              placeholder: "Optional venue description"
            })}
            <FacilityImageUploadCard
              title="Venue image"
              helperText="Used in venue details and member-facing facility surfaces."
              buttonLabel={formData.imageUrl ? "UPLOAD NEW IMAGE" : "ADD IMAGE"}
              imageUrl={formData.imageUrl ?? ""}
              onUpload={handleVenueImageUpload}
              disabled={isLoading || !onUploadImage}
            />
            <div style={{ display: "grid", gap: 6 }}>
              <FitText as="label" style={s.fieldLabel}>User Booking</FitText>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {VENUE_BOOKING_OPTIONS.map((option) => {
                  const isActive = (formData.isReservable ?? "true") === option.value;
                  return (
                    <FitButton
                      key={option.value}
                      variant={isActive ? "primary" : "ghost"}
                      label={option.label}
                      onClick={() => handleChange("isReservable", option.value)}
                      fullWidth
                    />
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {renderField({ name: "iconKey", label: "Icon", type: "select", options: VENUE_ICON_OPTIONS })}
              {renderField({ name: "floorId", label: "Floor", type: "select", options: VENUE_FLOOR_OPTIONS })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {renderField({ name: "gridColumn", label: "Column", required: true, placeholder: "1-14" })}
              {renderField({ name: "gridRow", label: "Row", required: true, placeholder: "1-10" })}
              {renderField({ name: "gridWidth", label: "Width", required: true, placeholder: "3" })}
              {renderField({ name: "gridHeight", label: "Height", required: true, placeholder: "2" })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {renderField({ name: "hourlyRate", label: "Hourly Rate", placeholder: "Optional" })}
              {renderField({ name: "minimumHours", label: "Minimum Hours", placeholder: "Default 1" })}
              {renderField({ name: "displayOrder", label: "Display Order", placeholder: "0" })}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          alignItems: "center",
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          paddingTop: 12
        }}
      >
        {editTarget && step === "placement" ? (
          <FitButton
            variant="danger"
            label={editTarget.isSystem ? "LOCKED CORE VENUE" : "DELETE VENUE"}
            disabled={editTarget.isSystem}
            onClick={onDelete}
            style={{ height: 34, minHeight: 34 }}
            textStyle={{ fontSize: 12 }}
          />
        ) : (
          <span />
        )}
        <FitButton
          variant="primary"
          label={step === "details" ? "NEXT: PLACEMENT" : submitLabel}
          loading={isLoading}
          onClick={handlePrimary}
          style={{ height: 34, minHeight: 34, minWidth: 178 }}
          textStyle={{ fontSize: 12 }}
        />
      </div>
    </div>
  );
}
