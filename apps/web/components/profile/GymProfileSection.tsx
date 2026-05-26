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
import { FitText, FitTextInput } from "@/components/fit/FitText";

const DEFAULT_GYM_PROFILE: GymProfileRecord = {
  closingTime: "22:00",
  email: "contact@sertfit.com",
  location: "123 Fitness Ave, New York, NY 10001",
  name: "SERTFIT Gym",
  openingTime: "06:00",
  phone: "+639281234567"
};

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

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
  const phone = normalizeAuthPhilippineMobileNumber(draft.phone);

  if (!draft.name.trim()) return "Gym name is required.";
  if (!authCanonicalPhilippineMobilePattern.test(phone)) {
    return "Phone must use +639XXXXXXXXX format.";
  }
  if (!draft.location.trim()) return "Location is required.";
  if (!SIMPLE_EMAIL_PATTERN.test(draft.email.trim())) {
    return "Email must be a valid email address.";
  }
  if (!TIME_PATTERN.test(draft.openingTime) || !TIME_PATTERN.test(draft.closingTime)) {
    return "Opening and closing times must be valid.";
  }

  return null;
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
  }, [editing, remoteProfile, updateGymProfileMutation.isPending]);

  const hasChanges = JSON.stringify(savedData) !== JSON.stringify(draftData);
  const queryErrorMessage = queryError
    ? toGymProfileMessage(queryError, "Unable to load shared gym details.")
    : null;
  const formDisabled = isPending || updateGymProfileMutation.isPending || (!canEdit && !editing);

  const updateField = (key: keyof GymProfileRecord, value: string) => {
    setDraftData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    setDraftData(savedData);
    setEditing(false);
    setMessageTone("success");
    showMessage("Gym details reset.");
  };

  const handleSave = () => {
    if (!canEdit || updateGymProfileMutation.isPending) return;
    const validationMessage = validateGymProfileDraft(draftData);
    if (validationMessage) {
      setMessageTone("error");
      showMessage(validationMessage);
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

  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <FitText style={{ fontSize: 18, fontWeight: 800 }}>Gym Identity & Hours</FitText>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Building2 size={15} color={colors.brand} />
          <FitText style={{ fontSize: 13, color: colors.brand }}>
            {canEdit ? "Admin editable" : "Admin managed"}
          </FitText>
        </div>
      </div>
      <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
        Gym identity and operating details now live on the admin profile instead of web settings.
      </FitText>
      {message ? (
        <FitText style={{ fontSize: 13, color: messageTone === "error" ? colors.danger : colors.success, fontWeight: 600, marginBottom: 12 }}>
          {message}
        </FitText>
      ) : queryErrorMessage ? (
        <FitText style={{ fontSize: 13, color: colors.danger, fontWeight: 600, marginBottom: 12 }}>
          {queryErrorMessage}
        </FitText>
      ) : null}
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
          </div>
          <div>
            <FitText style={s.fieldLabel}>Phone</FitText>
            <div style={{ position: "relative" }}>
              <Phone size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                id="gym-profile-phone"
                aria-label="Phone"
                type="tel"
                value={draftData.phone}
                placeholder="+639281234567"
                inputMode="tel"
                pattern="[+]639[0-9]{9}"
                maxLength={13}
                disabled={!editing || !canEdit || formDisabled}
                onChange={(event) => updateField("phone", sanitizeGymPhoneInput(event.target.value))}
                style={editing && canEdit ? s.inputBase : s.inputDisabled}
              />
            </div>
          </div>
        </div>
        <div>
          <FitText style={s.fieldLabel}>Location</FitText>
          <div style={{ position: "relative" }}>
            <MapPin size={14} color={colors.textMuted} style={s.fieldIcon} />
            <FitTextInput
              id="gym-profile-location"
              aria-label="Location"
              value={draftData.location}
              placeholder="123 Fitness Ave, New York, NY 10001"
              maxLength={255}
              disabled={!editing || !canEdit || formDisabled}
              onChange={(event) => updateField("location", event.target.value)}
              style={editing && canEdit ? s.inputBase : s.inputDisabled}
            />
          </div>
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
          </div>
        </div>
      </div>
      {canEdit ? (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          {editing ? (
            <>
              <FitButton
                variant="ghost"
                label="Cancel"
                fullWidth
                style={s.actionBtn}
                onClick={handleCancel}
              />
              <FitButton
                variant="primary"
                label={updateGymProfileMutation.isPending ? "SAVING GYM DETAILS" : "SAVE GYM DETAILS"}
                fullWidth
                disabled={!hasChanges || updateGymProfileMutation.isPending}
                style={s.actionBtn}
                onClick={handleSave}
              />
            </>
          ) : (
            <FitButton
              variant="primary"
              label="Edit Gym Details"
              fullWidth
              style={s.actionBtn}
              onClick={() => setEditing(true)}
            />
          )}
        </div>
      ) : (
        <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 14 }}>
          Staff can review these workspace details here. Admin accounts manage edits.
        </FitText>
      )}
    </div>
  );
}
