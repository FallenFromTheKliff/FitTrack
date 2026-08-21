"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import { modalStyles } from "@/styles/modalStyles";
import { VENUE_BOOKING_OPTIONS, VENUE_FLOOR_OPTIONS, VENUE_ICON_OPTIONS } from "@/data/facilities/venueFields";
import { COLS, ROWS, type VenueRecord } from "@/data/facilities/mapTypes";

import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit/FitCard";
import { FitText, FitTextInput, FitTextArea } from "@/components/fit/FitText";
import { FacilityImageUploadCard } from "./FacilityImageUploadCard";

const VenueImageCropCanvas = dynamic(() => import("./VenueImageCropCanvas"), {
  ssr: false,
});

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
const DETAIL_REQUIRED_FIELDS = ["name", "capacity"] as const;
type EditorStep = "details" | "placement" | "crop";
type CropSnapshot = Pick<Record<string, string>, "imageFit" | "imageFocalX" | "imageFocalY" | "imageCropZoom">;

function isVenueReservable(data: Record<string, string>) {
  return (data.isReservable ?? "true") === "true";
}

function validateVenueField(
  name: string,
  value: string,
  data: Record<string, string>,
) {
  const trimmedValue = value.trim();

  if (
    REQUIRED_FIELDS.includes(name as (typeof REQUIRED_FIELDS)[number]) &&
    !trimmedValue
  ) {
    return "Required";
  }

  if (name === "capacity" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      return "Capacity must be a whole number greater than zero.";
    }
  }

  if (name === "hourlyRate" && isVenueReservable(data)) {
    const numericValue = Number(trimmedValue);

    if (!trimmedValue || !Number.isFinite(numericValue) || numericValue <= 0) {
      return "Hourly rate is required for reservable venues.";
    }
  }

  if (name === "hourlyRate" && !isVenueReservable(data) && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return "Hourly rate must be zero or greater.";
    }
  }

  if (name === "minimumHours" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue < 1) {
      return "Minimum hours must be at least 1.";
    }
  }

  if (name === "displayOrder" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue < 0) {
      return "Display order must be zero or greater.";
    }
  }

  if (name === "gridColumn" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > COLS) {
      return `Column must be between 1 and ${COLS}.`;
    }
  }

  if (name === "gridRow" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > ROWS) {
      return `Row must be between 1 and ${ROWS}.`;
    }
  }

  if (name === "gridWidth" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    const gridColumn = Number(data.gridColumn ?? "1");
    if (
      !Number.isInteger(numericValue) ||
      numericValue < 1 ||
      (Number.isFinite(gridColumn) && gridColumn + numericValue - 1 > COLS)
    ) {
      return `Width must keep the venue inside the ${COLS} column layout.`;
    }
  }

  if (name === "gridHeight" && trimmedValue) {
    const numericValue = Number(trimmedValue);
    const gridRow = Number(data.gridRow ?? "1");
    if (
      !Number.isInteger(numericValue) ||
      numericValue < 1 ||
      (Number.isFinite(gridRow) && gridRow + numericValue - 1 > ROWS)
    ) {
      return `Height must keep the venue inside the ${ROWS} row layout.`;
    }
  }

  return "";
}

function validateVenueFields(
  data: Record<string, string>,
  fields: readonly string[] = REQUIRED_FIELDS,
  options: { includeHourlyRate?: boolean } = {},
) {
  const nextErrors: Record<string, string> = {};

  fields.forEach((field) => {
    const error = validateVenueField(field, data[field] ?? "", data);
    if (error) {
      nextErrors[field] = error;
    }
  });

  if (options.includeHourlyRate ?? true) {
    const hourlyRateError = validateVenueField(
      "hourlyRate",
      data.hourlyRate ?? "",
      data,
    );
    if (hourlyRateError) {
      nextErrors.hourlyRate = hourlyRateError;
    }
  }

  return nextErrors;
}

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
  const [step, setStep] = useState<EditorStep>("details");
  const [cropSnapshot, setCropSnapshot] = useState<CropSnapshot | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cropZoomDraft, setCropZoomDraft] = useState(1);
  const isReservable = isVenueReservable(formData);
  const cropImageUrl = useMemo(
    () =>
      buildRenderableAssetUrl({
        apiBaseUrl: WEB_API_BASE_URL,
        assetUrl: formData.imageUrl ?? null,
      }) ?? "",
    [formData.imageUrl],
  );
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
    setCropSnapshot(null);
    setIsUploadingImage(false);
  }, [initialValues, isVisible]);

  const handleChange = (name: string, value: string) => {
    const nextData = { ...formData, [name]: value };

    setFormData(nextData);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      const fieldError = validateVenueField(name, value, nextData);

      if (fieldError) {
        nextErrors[name] = fieldError;
      } else {
        delete nextErrors[name];
      }

      if (name === "isReservable" || name === "hourlyRate") {
        const hourlyRateError = validateVenueField(
          "hourlyRate",
          nextData.hourlyRate ?? "",
          nextData,
        );

        if (hourlyRateError) {
          nextErrors.hourlyRate = hourlyRateError;
        } else {
          delete nextErrors.hourlyRate;
        }
      }

      if (name === "gridColumn" || name === "gridWidth") {
        const widthError = validateVenueField(
          "gridWidth",
          nextData.gridWidth ?? "",
          nextData,
        );
        if (widthError) {
          nextErrors.gridWidth = widthError;
        } else {
          delete nextErrors.gridWidth;
        }
      }

      if (name === "gridRow" || name === "gridHeight") {
        const heightError = validateVenueField(
          "gridHeight",
          nextData.gridHeight ?? "",
          nextData,
        );
        if (heightError) {
          nextErrors.gridHeight = heightError;
        } else {
          delete nextErrors.gridHeight;
        }
      }

      return nextErrors;
    });
  };

  const handleSubmit = () => {
    const nextErrors = validateVenueFields(formData);

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

    setIsUploadingImage(true);
    try {
      const imageUrl = await onUploadImage(file);
      if (imageUrl) {
        handleChange("imageUrl", imageUrl);
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleBack = () => {
    if (step === "crop") {
      if (cropSnapshot) {
        setFormData((current) => ({ ...current, ...cropSnapshot }));
      }
      setCropSnapshot(null);
      setStep("details");
      return;
    }
    if (step === "placement") {
      setStep("details");
      return;
    }
    onBack?.();
  };

  const openCropEditor = () => {
    setCropSnapshot({
      imageFit: formData.imageFit ?? "cover",
      imageFocalX: formData.imageFocalX ?? "0.5",
      imageFocalY: formData.imageFocalY ?? "0.5",
      imageCropZoom: formData.imageCropZoom ?? "1",
    });
    setCropZoomDraft(Number(formData.imageCropZoom ?? 1));
    setStep("crop");
  };

  const applyCrop = () => {
    setFormData((current) => ({
      ...current,
      imageCropZoom: String(cropZoomDraft),
    }));
    setCropSnapshot(null);
    setStep("details");
  };

  const resetCrop = () => {
    setCropZoomDraft(1);
    setFormData((current) => ({
      ...current,
      imageFit: "cover",
      imageFocalX: "0.5",
      imageFocalY: "0.5",
      imageCropZoom: "1",
    }));
  };

  const handlePrimary = () => {
    if (step === "details") {
      const detailErrors = validateVenueFields(
        formData,
        DETAIL_REQUIRED_FIELDS,
        { includeHourlyRate: false },
      );

      if (Object.keys(detailErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...detailErrors }));
        return;
      }

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
      <FitText as="label" htmlFor={`venue-${name}`} style={s.fieldLabel}>
        {label}
        {required ? <FitText as="span" style={s.requiredAsterisk}>*</FitText> : null}
      </FitText>
      {type === "textarea" ? (
        <FitTextArea
          id={`venue-${name}`}
          name={name}
          rows={4}
          value={formData[name] ?? ""}
          onChange={(e) => handleChange(name, e.target.value)}
          placeholder={placeholder}
          style={{ ...s.fieldInput, ...s.fieldTextarea }}
        />
      ) : type === "select" ? (
        <FitSelect
          id={`venue-${name}`}
          name={name}
          aria-label={label}
          fullWidth
          value={formData[name] ?? ""}
          onChange={(e) => handleChange(name, e.target.value)}
          options={options ?? VENUE_ICON_OPTIONS}
          style={{ borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg }}
        />
      ) : (
        <FitTextInput
          id={`venue-${name}`}
          name={name}
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
            {step === "crop" ? "Crop Venue Image" : editTarget ? "Edit Venue" : "Add Venue"}
          </FitText>
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>
            {step === "crop"
              ? "Adjust the display crop. Venue geometry is unchanged."
              : step === "details"
                ? "Set the member-facing venue profile."
                : "Place the venue on the active facility map."}
          </FitText>
        </div>
        <FitButton
          variant="ghost"
          label={step === "details" ? backLabel : step === "crop" ? "Cancel crop" : "Back"}
          onClick={handleBack}
          style={{ height: 32, minHeight: 32 }}
          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
        />
      </div>

      {step !== "crop" ? <div
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
              onClick={() => setStep(value as EditorStep)}
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
      </div> : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {step === "crop" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                aspectRatio: "16 / 8",
                backgroundColor: colors.base,
                border: `1px solid ${colors.border}`,
                borderRadius: 9,
                overflow: "hidden",
              }}
            >
              <VenueImageCropCanvas
                backgroundColor={colors.base}
                fit={(formData.imageFit ?? "cover") as "cover" | "contain"}
                focalX={Number(formData.imageFocalX ?? 0.5)}
                focalY={Number(formData.imageFocalY ?? 0.5)}
                imageUrl={cropImageUrl}
                zoom={cropZoomDraft}
                onFocalChange={(focalX, focalY) => {
                  setFormData((current) => ({
                    ...current,
                    imageFocalX: String(focalX),
                    imageFocalY: String(focalY),
                  }));
                }}
              />
            </div>
            <div style={{ alignItems: "center", display: "grid", gap: 10, gridTemplateColumns: "auto minmax(160px, 1fr) auto auto auto" }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Zoom</FitText>
              <input
                aria-label="Venue image crop zoom"
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoomDraft}
                onChange={(event) => setCropZoomDraft(Number(event.target.value))}
                onPointerUp={() => handleChange("imageCropZoom", String(cropZoomDraft))}
                onKeyUp={() => handleChange("imageCropZoom", String(cropZoomDraft))}
                onBlur={() => handleChange("imageCropZoom", String(cropZoomDraft))}
              />
              <FitButton
                variant={(formData.imageFit ?? "cover") === "cover" ? "primary" : "ghost"}
                label="Cover"
                onClick={() => handleChange("imageFit", "cover")}
              />
              <FitButton
                variant={formData.imageFit === "contain" ? "primary" : "ghost"}
                label="Contain"
                onClick={() => handleChange("imageFit", "contain")}
              />
              <FitButton variant="ghost" label="Reset" onClick={resetCrop} />
            </div>
            <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.45 }}>
              Drag the image to set its focal point. Crop settings affect only image display and never resize the venue.
            </FitText>
          </div>
        ) : step === "details" ? (
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
              buttonLabel={isUploadingImage ? "UPLOADING IMAGE" : formData.imageUrl ? "UPLOAD NEW IMAGE" : "ADD IMAGE"}
              imageUrl={formData.imageUrl ?? ""}
              onUpload={handleVenueImageUpload}
              disabled={isLoading || isUploadingImage || !onUploadImage}
            />
            {formData.imageUrl ? (
              <FitButton
                variant="ghost"
                label="CROP IMAGE"
                onClick={openCropEditor}
                disabled={isLoading}
                fullWidth
              />
            ) : null}
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
            {editTarget ? (
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 9,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: "10px 12px",
                }}
              >
                Drag this venue on the Facilities canvas to reposition it. Its
                saved grid placement remains available to the layout engine.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {renderField({ name: "gridColumn", label: "Column", required: true, placeholder: "1-14" })}
                {renderField({ name: "gridRow", label: "Row", required: true, placeholder: "1-10" })}
                {renderField({ name: "gridWidth", label: "Width", required: true, placeholder: "3" })}
                {renderField({ name: "gridHeight", label: "Height", required: true, placeholder: "2" })}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {renderField({
                name: "hourlyRate",
                label: "Hourly Rate",
                placeholder: isReservable ? "Required" : "Optional",
                required: isReservable,
              })}
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
            label={editTarget.isSystem ? "LOCKED CORE VENUE" : "ARCHIVE VENUE"}
            disabled={editTarget.isSystem}
            onClick={onDelete}
            style={{ height: 34, minHeight: 34 }}
            textStyle={{ fontSize: 12 }}
          />
        ) : step === "crop" ? (
          <FitButton variant="ghost" label="CANCEL" onClick={handleBack} />
        ) : (
          <span />
        )}
        <FitButton
          variant="primary"
          label={step === "crop" ? "APPLY CROP" : step === "details" ? "NEXT: PLACEMENT" : submitLabel}
          loading={step === "crop" ? false : isLoading}
          onClick={step === "crop" ? applyCrop : handlePrimary}
          style={{ height: 34, minHeight: 34, minWidth: 178 }}
          textStyle={{ fontSize: 12 }}
        />
      </div>
    </div>
  );
}
