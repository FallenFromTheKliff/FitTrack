"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ApiClientError, type GymProfileRecord } from "@fittrack/api-client";
import { useTimedMessage } from "@fittrack/hooks";
import {
  authCanonicalPhilippineMobilePattern,
  normalizeAuthPhilippineMobileNumber,
} from "@fittrack/validators";
import {
  gymProfileQueryOptions,
  queryKeys,
  updateGymProfileMutationOptions,
} from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { profileStyles } from "@/styles/pageStyles";
import { webApiClient } from "@/lib/api-client";
import FitButton from "@/components/fit/FitButton";
import { FitModal } from "@/components/modals";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import { getPhilippinePhoneDigits } from "@/components/profile/profileFieldUtils";

const DEFAULT_GYM_PROFILE: GymProfileRecord = {
  closingTime: "22:00",
  email: "contact@sertfit.com",
  location: "Pasay City, Metro Manila, Philippines",
  name: "SERTFIT Gym",
  openingTime: "06:00",
  phone: "+639281234567"
};

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

type LocationDraft = {
  country: string;
  region: string;
  province: string;
  cityMunicipality: string;
  barangay: string;
  streetAddress: string;
  postalCode: string;
};

type GymProfileFieldKey = "name" | "phone" | "location" | "email" | "openingTime" | "closingTime";
type GymProfileFieldErrors = Partial<Record<GymProfileFieldKey, string>>;

const EMPTY_LOCATION_DRAFT: LocationDraft = {
  country: "",
  region: "",
  province: "",
  cityMunicipality: "",
  barangay: "",
  streetAddress: "",
  postalCode: "",
};

const LOCATION_FIELD_DEFINITIONS: Array<{
  key: keyof LocationDraft;
  label: string;
  placeholder: string;
}> = [
  { key: "country", label: "Country", placeholder: "Philippines" },
  { key: "region", label: "Region", placeholder: "Region III" },
  { key: "province", label: "Province", placeholder: "Bulacan" },
  { key: "cityMunicipality", label: "City/Municipality", placeholder: "City or municipality" },
  { key: "barangay", label: "Barangay", placeholder: "Barangay" },
  { key: "streetAddress", label: "Street address", placeholder: "Street, building, or unit" },
  { key: "postalCode", label: "Postal code", placeholder: "Postal code" },
];

function createLocationDraft(location: string): LocationDraft {
  const segments = location
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "";
  const postalCode = /^\d{4,10}$/.test(lastSegment) ? lastSegment : "";
  const addressSegments = postalCode ? segments.slice(0, -1) : segments;

  if (addressSegments.length >= 6) {
    const last = (offset: number) =>
      addressSegments[addressSegments.length - 1 - offset] ?? "";
    return {
      country: last(0),
      region: last(1),
      province: last(2),
      cityMunicipality: last(3),
      barangay: last(4),
      streetAddress: addressSegments.slice(0, -5).join(", "),
      postalCode,
    };
  }

  if (addressSegments.length >= 3) {
    return {
      ...EMPTY_LOCATION_DRAFT,
      region: addressSegments[addressSegments.length - 1] ?? "",
      cityMunicipality: addressSegments[addressSegments.length - 2] ?? "",
      streetAddress: addressSegments.slice(0, -2).join(", "),
      postalCode,
    };
  }

  return {
    ...EMPTY_LOCATION_DRAFT,
    streetAddress: location.trim(),
    postalCode,
  };
}

function composeLocation(draft: LocationDraft) {
  return [
    draft.streetAddress,
    draft.barangay,
    draft.cityMunicipality,
    draft.province,
    draft.region,
    draft.country,
    draft.postalCode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function getGymProfileFieldErrors(draft: GymProfileRecord): GymProfileFieldErrors {
  const errors: GymProfileFieldErrors = {};
  const phone = normalizeAuthPhilippineMobileNumber(draft.phone);

  if (!draft.name.trim()) errors.name = "Gym name is required.";
  if (!phone) errors.phone = "Phone number is required.";
  else if (!authCanonicalPhilippineMobilePattern.test(phone)) {
    errors.phone = "Phone must use +639XXXXXXXXX format.";
  }
  if (!draft.location.trim()) errors.location = "Location is required.";
  if (!SIMPLE_EMAIL_PATTERN.test(draft.email.trim())) {
    errors.email = "Email must be a valid email address.";
  }
  if (!TIME_PATTERN.test(draft.openingTime)) {
    errors.openingTime = "Opening time must be valid.";
  }
  if (!TIME_PATTERN.test(draft.closingTime)) {
    errors.closingTime = "Closing time must be valid.";
  }

  return errors;
}

function sanitizeGymPhoneInput(value: string) {
  const compact = value.trim().replace(/[^\d+]/g, "");
  const singleLeadingPlus = compact.startsWith("+")
    ? `+${compact.slice(1).replace(/\D/g, "")}`
    : compact.replace(/\D/g, "");

  if (singleLeadingPlus.startsWith("+63")) {
    return `+${singleLeadingPlus.slice(1, 13)}`;
  }

  if (singleLeadingPlus.startsWith("63")) {
    return `+${singleLeadingPlus.slice(0, 12)}`;
  }

  if (singleLeadingPlus.startsWith("09")) {
    return `+63${singleLeadingPlus.slice(1, 11)}`;
  }

  if (singleLeadingPlus.startsWith("9")) {
    return `+63${singleLeadingPlus.slice(0, 10)}`;
  }

  return singleLeadingPlus.slice(0, 13);
}

function validateGymProfileDraft(draft: GymProfileRecord) {
  return Object.values(getGymProfileFieldErrors(draft))[0] ?? null;
}

function toGymProfileMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export default function GymProfileSection({ canEdit }: { canEdit: boolean }) {
  const { colors } = useTheme();
  const { message, showMessage } = useTimedMessage(2400);
  const s = useMemo(() => profileStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [savedData, setSavedData] = useState<GymProfileRecord>(DEFAULT_GYM_PROFILE);
  const [draftData, setDraftData] = useState<GymProfileRecord>(DEFAULT_GYM_PROFILE);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(EMPTY_LOCATION_DRAFT);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<GymProfileFieldKey, boolean>>>({});

  const {
    data: remoteProfile = DEFAULT_GYM_PROFILE,
    error: queryError,
    isPending
  } = useQuery({
    ...gymProfileQueryOptions(webApiClient),
    staleTime: 60_000
  });

  const updateGymProfileMutation = useMutation({
    ...updateGymProfileMutationOptions(webApiClient, queryClient),
    onSuccess: (nextProfile) => {
      setSavedData(nextProfile);
      setDraftData(nextProfile);
      setTouchedFields({});
      setLocationModalOpen(false);
      queryClient.setQueryData(queryKeys.gymKnowledgeProfile(), nextProfile);
      setEditing(false);
      setMessageTone("success");
      showMessage("Gym details saved.");
    },
    onError: (error: unknown) => {
      setMessageTone("error");
      showMessage(toGymProfileMessage(error, "Unable to save gym details."));
    }
  });

  useEffect(() => {
    if (editing || updateGymProfileMutation.isPending) return;
    setSavedData(remoteProfile);
    setDraftData(remoteProfile);
    setTouchedFields({});
  }, [editing, remoteProfile, updateGymProfileMutation.isPending]);

  const hasChanges = JSON.stringify(savedData) !== JSON.stringify(draftData);
  const queryErrorMessage = queryError
    ? toGymProfileMessage(queryError, "Unable to load shared gym details.")
    : null;
  const formDisabled = isPending || updateGymProfileMutation.isPending || (!canEdit && !editing);
  const fieldErrors = useMemo(() => {
    if (!editing) return {};

    const errors = getGymProfileFieldErrors(draftData);
    return (Object.keys(errors) as GymProfileFieldKey[]).reduce<GymProfileFieldErrors>(
      (visibleErrors, field) => {
        const error = errors[field];
        if (touchedFields[field] && error) visibleErrors[field] = error;
        return visibleErrors;
      },
      {}
    );
  }, [draftData, editing, touchedFields]);

  const updateField = (key: keyof GymProfileRecord, value: string) => {
    setDraftData((prev) => ({ ...prev, [key]: value }));
    setTouchedFields((prev) => ({ ...prev, [key]: true }));
  };

  const openLocationModal = () => {
    if (!editing || !canEdit || formDisabled) return;
    setLocationDraft(createLocationDraft(draftData.location));
    setLocationModalOpen(true);
  };

  const applyLocationDraft = () => {
    updateField("location", composeLocation(locationDraft));
    setLocationModalOpen(false);
  };

  const handleCancel = () => {
    if (locationModalOpen) return;
    setDraftData(savedData);
    setTouchedFields({});
    setLocationModalOpen(false);
    setEditing(false);
    setMessageTone("success");
    showMessage("Gym details reset.");
  };

  const handleSave = () => {
    if (!canEdit || updateGymProfileMutation.isPending) return;
    if (validateGymProfileDraft(draftData)) {
      const errors = getGymProfileFieldErrors(draftData);
      setTouchedFields((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(errors).map((field) => [field, true]))
      }));
      return;
    }

    updateGymProfileMutation.mutate({
      ...draftData,
      email: draftData.email.trim(),
      location: draftData.location.trim(),
      name: draftData.name.trim(),
      phone: normalizeAuthPhilippineMobileNumber(draftData.phone)
    });
  };

  const summaryField = (label: string, value: string, Icon: typeof Building2) => {
    const hasValue = value.trim() !== "";

    return (
      <div>
        <FitText style={s.fieldLabel}>{label}</FitText>
        <div
          style={{
            ...s.inputDisabled,
            alignItems: "center",
            display: "flex",
            minHeight: 44,
            paddingLeft: 48,
            position: "relative",
          }}
        >
          <Icon size={14} color={colors.textMuted} style={s.fieldIcon} />
          <FitText style={{ color: hasValue ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
            {hasValue ? value : "Not provided"}
          </FitText>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={s.panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 12 }}>
          <Building2 size={15} color={colors.brand} />
          <FitText style={{ fontSize: 13, color: colors.brand }}>
            {canEdit ? "Admin editable" : "Admin managed"}
          </FitText>
      </div>
      {message ? (
        <FitText style={{ fontSize: 13, color: messageTone === "error" ? colors.danger : colors.success, fontWeight: 600, marginBottom: 12 }}>
          {message}
        </FitText>
      ) : queryErrorMessage ? (
        <FitText style={{ fontSize: 13, color: colors.danger, fontWeight: 600, marginBottom: 12 }}>
          {queryErrorMessage}
        </FitText>
      ) : null}
      {!editing ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={s.twoColumnFieldGrid}>
            {summaryField("Gym Name", savedData.name, Building2)}
            {summaryField(
              "Phone",
              savedData.phone ? `+63 ${getPhilippinePhoneDigits(savedData.phone)}` : "",
              Phone
            )}
          </div>
          {summaryField("Location", savedData.location, MapPin)}
          <div style={s.twoColumnFieldGrid}>
            {summaryField("Email", savedData.email, Mail)}
            <div />
          </div>
          <div style={s.twoColumnFieldGrid}>
            {summaryField("Opening Time", savedData.openingTime, Clock3)}
            {summaryField("Closing Time", savedData.closingTime, Clock3)}
          </div>
        </div>
      ) : null}
      <FitModal
        isOpen={editing}
        onClose={() => {
          if (!locationModalOpen) handleCancel();
        }}
        closeDisabled={locationModalOpen}
        title="Edit Gym Details"
        subtitle="Update the shared identity, contact, location, and operating hours for your gym."
        maxWidth={860}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <FitButton
              variant="ghost"
              label="Cancel"
              onClick={handleCancel}
            />
            <FitButton
              variant="primary"
              label={updateGymProfileMutation.isPending ? "SAVING GYM DETAILS" : "SAVE GYM DETAILS"}
              disabled={!hasChanges || updateGymProfileMutation.isPending || Object.keys(fieldErrors).length > 0}
              onClick={handleSave}
            />
          </div>
        }
      >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={s.twoColumnFieldGrid}>
          <div>
            <FitText style={s.fieldLabel}>Gym Name</FitText>
            <div style={{ position: "relative" }}>
              <Building2 size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                id="gym-profile-name"
                aria-label="Gym Name"
                value={draftData.name}
                placeholder="SERTFIT Gym"
                maxLength={255}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("name", event.target.value)}
                style={editing && canEdit ? s.inputBase : s.inputDisabled}
              />
            </div>
            {fieldErrors.name ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                {fieldErrors.name}
              </FitText>
            ) : null}
          </div>
          <div>
            <FitText style={s.fieldLabel}>Phone</FitText>
            <div style={{ position: "relative" }}>
              <Phone size={14} color={colors.textMuted} style={s.fieldIcon} />
              <span
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  fontWeight: 700,
                  left: 38,
                  pointerEvents: "none",
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                +63
              </span>
              <FitTextInput
                id="gym-profile-phone"
                aria-label="Phone"
                type="tel"
                value={getPhilippinePhoneDigits(draftData.phone)}
                placeholder="9281234567"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("phone", sanitizeGymPhoneInput(event.target.value))}
                style={{
                  ...(editing && canEdit ? s.inputBase : s.inputDisabled),
                  paddingLeft: 72,
                }}
              />
            </div>
            {fieldErrors.phone ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                {fieldErrors.phone}
              </FitText>
            ) : null}
          </div>
        </div>
        <div>
          <FitText style={s.fieldLabel}>Location</FitText>
          <div style={{ position: "relative" }}>
            <MapPin size={14} color={colors.textMuted} style={s.fieldIcon} />
            <FitButton
              variant="field"
              id="gym-profile-location"
              aria-label="Location"
              showTrailing={false}
              disabled={!editing || !canEdit || formDisabled}
              onClick={openLocationModal}
              style={{
                ...(editing && canEdit ? s.inputBase : s.inputDisabled),
                cursor: editing && canEdit ? "pointer" : "not-allowed",
                display: "flex",
                textAlign: "left",
              }}
              textStyle={{ color: draftData.location ? colors.textPrimary : colors.textMuted }}
            >
              {draftData.location || "Add location"}
            </FitButton>
          </div>
          {fieldErrors.location ? (
            <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
              {fieldErrors.location}
            </FitText>
          ) : null}
        </div>
        <div style={s.twoColumnFieldGrid}>
          <div>
            <FitText style={s.fieldLabel}>Email</FitText>
            <div style={{ position: "relative" }}>
              <Mail size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                id="gym-profile-email"
                aria-label="Email"
                type="email"
                value={draftData.email}
                placeholder="contact@sertfit.com"
                maxLength={255}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("email", event.target.value)}
                style={editing && canEdit ? s.inputBase : s.inputDisabled}
              />
            </div>
            {fieldErrors.email ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                {fieldErrors.email}
              </FitText>
            ) : null}
          </div>
          <div />
        </div>
        <div style={s.twoColumnFieldGrid}>
          <div>
            <FitText style={s.fieldLabel}>Opening Time</FitText>
            <div style={{ position: "relative" }}>
              <Clock3 size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                id="gym-profile-opening-time"
                aria-label="Opening Time"
                type="time"
                value={draftData.openingTime}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("openingTime", event.target.value)}
                style={editing && canEdit ? s.inputBase : s.inputDisabled}
              />
            </div>
            {fieldErrors.openingTime ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                {fieldErrors.openingTime}
              </FitText>
            ) : null}
          </div>
          <div>
            <FitText style={s.fieldLabel}>Closing Time</FitText>
            <div style={{ position: "relative" }}>
              <Clock3 size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                id="gym-profile-closing-time"
                aria-label="Closing Time"
                type="time"
                value={draftData.closingTime}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("closingTime", event.target.value)}
                style={editing && canEdit ? s.inputBase : s.inputDisabled}
              />
            </div>
            {fieldErrors.closingTime ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                {fieldErrors.closingTime}
              </FitText>
            ) : null}
          </div>
        </div>
      </div>
      </FitModal>
      {canEdit ? (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          {!editing ? (
            <FitButton
              variant="primary"
              label="Edit Gym Details"
              fullWidth
              style={s.actionBtn}
              onClick={() => {
                setDraftData(savedData);
                setTouchedFields({});
                setEditing(true);
              }}
            />
          ) : null}
        </div>
      ) : (
        <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 14 }}>
          Staff can review these workspace details here. Admin accounts manage edits.
        </FitText>
      )}
    </div>
    <FitModal
      isOpen={locationModalOpen}
      onClose={() => setLocationModalOpen(false)}
      title="Edit location"
      subtitle="Add the address details used for gym identity."
      maxWidth={720}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <FitButton
            variant="ghost"
            label="Cancel"
            onClick={() => setLocationModalOpen(false)}
          />
          <FitButton
            variant="primary"
            label="Use Location"
            onClick={applyLocationDraft}
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        {LOCATION_FIELD_DEFINITIONS.map(({ key, label, placeholder }) => (
          <label key={key} style={{ display: "grid", gap: 6 }}>
            <FitText style={s.fieldLabel}>{label}</FitText>
            <FitTextInput
              id={"gym-location-" + key}
              aria-label={label}
              value={locationDraft[key]}
              placeholder={placeholder}
              inputMode={key === "postalCode" ? "numeric" : undefined}
              maxLength={key === "postalCode" ? 10 : 255}
              onChange={(event) =>
                setLocationDraft((prev) => ({
                  ...prev,
                  [key]:
                    key === "postalCode"
                      ? event.target.value.replace(/\D/g, "").slice(0, 10)
                      : event.target.value,
                }))
              }
              style={s.inputBase}
            />
          </label>
        ))}
      </div>
    </FitModal>
    </>
  );
}
