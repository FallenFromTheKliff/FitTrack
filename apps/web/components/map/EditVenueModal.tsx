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
  onDelete
}: Props) {
  const { colors } = useTheme();
  const s = modalStyles(colors);
  const [formData, setFormData] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelStyle = useMemo(() => ({
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 18,
    display: "grid",
    gap: 16,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 180ms ease, transform 180ms ease"
  }), [colors.border, colors.surface, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    setFormData(initialValues);
    setErrors({});
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
      <div style={{ display: "grid", gap: 4 }}>
        <FitText as="h3" style={{ fontSize: 18, fontWeight: 700 }}>
          {editTarget ? "Edit Venue" : "Add Venue"}
        </FitText>
        <FitText style={{ fontSize: 13, color: colors.textMuted }}>
          Create or update active venues used for reservations.
        </FitText>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {renderField({ name: "name", label: "Name", required: true, placeholder: "e.g., Boxing Ring" })}
        {renderField({ name: "description", label: "Description", type: "textarea", placeholder: "Optional venue description" })}
        <FacilityImageUploadCard
          title="Venue image"
          helperText="Upload an image that appears in the venue details preview and member-facing facility surfaces."
          buttonLabel={formData.imageUrl ? "UPLOAD NEW IMAGE" : "ADD IMAGE"}
          imageUrl={formData.imageUrl ?? ""}
          onUpload={handleVenueImageUpload}
          disabled={isLoading || !onUploadImage}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {renderField({ name: "capacity", label: "Capacity", required: true, placeholder: "e.g., 25" })}
          {renderField({ name: "hourlyRate", label: "Hourly Rate", placeholder: "Leave blank for facility-only zones" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {renderField({ name: "minimumHours", label: "Minimum Hours", placeholder: "Default 1" })}
          {renderField({ name: "displayOrder", label: "Display Order", placeholder: "Lower numbers appear first" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {renderField({ name: "iconKey", label: "Icon", type: "select", options: VENUE_ICON_OPTIONS })}
          {renderField({ name: "floorId", label: "Floor", type: "select", options: VENUE_FLOOR_OPTIONS })}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Dimensions
          </FitText>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {renderField({ name: "gridColumn", label: "Grid Column", required: true, placeholder: "1-14" })}
            {renderField({ name: "gridRow", label: "Grid Row", required: true, placeholder: "1-10" })}
            {renderField({ name: "gridWidth", label: "Grid Width", required: true, placeholder: "e.g., 3" })}
            {renderField({ name: "gridHeight", label: "Grid Height", required: true, placeholder: "e.g., 2" })}
          </div>
        </div>
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
      </div>
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <FitButton
          variant="primary"
          label={submitLabel}
          loading={isLoading}
          onClick={handleSubmit}
          fullWidth
        />
        {editTarget ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 14
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.danger, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Danger Zone
              </FitText>
              <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                {editTarget.isSystem
                  ? "This venue is part of the core floor plan. It stays locked and cannot be deleted."
                  : "Delete this venue only if you are certain it should be removed from the reservation system."}
              </FitText>
            </div>
            {editTarget.isSystem ? (
              <FitButton
                variant="danger"
                label="LOCKED CORE VENUE"
                disabled
                fullWidth
              />
            ) : (
              <FitButton
                variant="danger"
                label="DELETE VENUE"
                onClick={onDelete}
                fullWidth
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
