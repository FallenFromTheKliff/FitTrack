"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { useTimedMessage } from "@fittrack/hooks";

import { useTheme } from "@/contexts/ThemeContext";
import { profileStyles } from "@/styles/pageStyles";
import FitButton from "@/components/fit/FitButton";
import { FitText, FitTextInput } from "@/components/fit/FitText";

type GymProfileData = {
  closingTime: string;
  email: string;
  location: string;
  name: string;
  openingTime: string;
  phone: string;
};

const STORAGE_KEY = "fittrack:web:admin:gym-profile";
const DEFAULT_GYM_PROFILE: GymProfileData = {
  closingTime: "22:00",
  email: "contact@sertfit.com",
  location: "123 Fitness Ave, New York, NY 10001",
  name: "SERTFIT Gym",
  openingTime: "06:00",
  phone: "09281234567"
};

function readGymProfile(): GymProfileData {
  if (typeof window === "undefined") return DEFAULT_GYM_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GYM_PROFILE;
    return {
      ...DEFAULT_GYM_PROFILE,
      ...(JSON.parse(raw) as Partial<GymProfileData>)
    };
  } catch {
    return DEFAULT_GYM_PROFILE;
  }
}

function writeGymProfile(data: GymProfileData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

export default function GymProfileSection({ canEdit }: { canEdit: boolean }) {
  const { colors } = useTheme();
  const { message, showMessage } = useTimedMessage(2400);
  const s = useMemo(() => profileStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [savedData, setSavedData] = useState<GymProfileData>(DEFAULT_GYM_PROFILE);
  const [draftData, setDraftData] = useState<GymProfileData>(DEFAULT_GYM_PROFILE);

  useEffect(() => {
    const nextData = readGymProfile();
    setSavedData(nextData);
    setDraftData(nextData);
  }, []);

  const hasChanges = JSON.stringify(savedData) !== JSON.stringify(draftData);

  const updateField = (key: keyof GymProfileData, value: string) => {
    setDraftData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    setDraftData(savedData);
    setEditing(false);
    showMessage("Gym details reset.");
  };

  const handleSave = () => {
    writeGymProfile(draftData);
    setSavedData(draftData);
    setEditing(false);
    showMessage("Gym details saved for this workspace.");
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
        <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600, marginBottom: 12 }}>
          {message}
        </FitText>
      ) : null}
      <div style={{ display: "grid", gap: 16 }}>
        <div style={s.twoColumnFieldGrid}>
          <div>
            <FitText style={s.fieldLabel}>Gym Name</FitText>
            <div style={{ position: "relative" }}>
              <Building2 size={14} color={colors.textMuted} style={s.fieldIcon} />
              <FitTextInput
                value={draftData.name}
                placeholder="SERTFIT Gym"
                disabled={!editing || !canEdit}
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
                value={draftData.phone}
                placeholder="09281234567"
                disabled={!editing || !canEdit}
                onChange={(event) => updateField("phone", event.target.value)}
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
              value={draftData.location}
              placeholder="123 Fitness Ave, New York, NY 10001"
              disabled={!editing || !canEdit}
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
                type="email"
                value={draftData.email}
                placeholder="contact@sertfit.com"
                disabled={!editing || !canEdit}
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
                type="time"
                value={draftData.openingTime}
                disabled={!editing || !canEdit}
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
                type="time"
                value={draftData.closingTime}
                disabled={!editing || !canEdit}
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
                label="SAVE GYM DETAILS"
                fullWidth
                disabled={!hasChanges}
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
