"use client";

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  CalendarDays,
  Camera,
  Check,
  Dumbbell,
  Mail,
  Phone,
  Ruler,
  Scale,
  User,
} from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { useProfilePage } from "@/hooks/profile/useProfile";
import { getPhilippinePhoneDigits, toPhilippinePhoneValue } from "@/components/profile/profileFieldUtils";
import FitButton from "@/components/fit/FitButton";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import { CalendarModal, ConfirmModal, FitModal } from "@/components/modals";
import { formatDate, formatDateYMD } from "@fittrack/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
] as const;

type GenderValue = (typeof GENDER_OPTIONS)[number]["value"];

const normalizeGender = (value?: string | null): GenderValue => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "male" || normalized === "female" || normalized === "other"
    ? normalized
    : "other";
};

const getInputStyle = (colors: ReturnType<typeof useTheme>["colors"], disabled: boolean): CSSProperties => ({
  boxSizing: "border-box",
  color: disabled ? colors.textMuted : colors.textPrimary,
  minHeight: 44,
  padding: "11px 12px 11px 38px",
  width: "100%",
  ...(disabled
    ? {
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
      }
    : {
        backgroundColor: colors.fieldBg,
        border: `1px solid ${colors.fieldBorder}`,
      }),
});

function FieldError({ message, colors }: { message?: string; colors: ReturnType<typeof useTheme>["colors"] }) {
  if (!message) return null;

  return (
    <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 1.35, margin: "6px 0 0" }}>
      {message}
    </FitText>
  );
}

export default function MemberEditProfileModal({ isOpen, onClose }: Props) {
  const { colors, onBrandTextColor } = useTheme();
  const {
    personalData,
    updatePersonalField,
    markPersonalFieldTouched,
    weightKg,
    setWeightKg,
    heightCm,
    setHeightCm,
    editing,
    setEditing,
    saving,
    saveLabel,
    showDobCalendar,
    setShowDobCalendar,
    hasChanges,
    fieldErrors,
    roleValue,
    tierValue,
    memberSinceValue,
    bmi,
    initials,
    displayedAvatarUri,
    message,
    setAvatarFile,
    gender,
    setGender,
    handleSave,
    resetPersonalData,
  } = useProfilePage({ requireFitness: true });
  const [activeTab, setActiveTab] = useState<"personal" | "fitness">("personal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setEditing(true);
      setActiveTab("personal");
      setConfirmOpen(false);
      setSaveFailed(false);
    }

    if (!isOpen) {
      wasOpenRef.current = false;
      setConfirmOpen(false);
      setSaveFailed(false);
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, setEditing]);

  const handleClose = () => {
    if (saving || confirmOpen) return;
    setShowDobCalendar(false);
    resetPersonalData();
    onClose();
  };

  const handleConfirmSave = async () => {
    if (saving) return;
    setConfirmOpen(false);
    const didSave = await handleSave();
    if (didSave) {
      setSaveFailed(false);
      onClose();
      return;
    }

    setSaveFailed(true);
  };

  const updateField = (field: "firstName" | "lastName" | "phone" | "dateOfBirth", value: string) => {
    setSaveFailed(false);
    updatePersonalField(field, value);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!nextFile) return;
    setSaveFailed(false);
    setAvatarFile(nextFile);
  };

  const selectedGender = normalizeGender(gender);
  const inputDisabled = !editing || saving;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const renderInput = ({
    id,
    label,
    icon: Icon,
    value,
    placeholder,
    onChange,
    error,
    disabled = inputDisabled,
    type = "text",
    inputMode,
    maxLength,
    prefix,
  }: {
    id: string;
    label: string;
    icon: typeof User;
    value: string;
    placeholder: string;
    onChange?: (value: string) => void;
    error?: string;
    disabled?: boolean;
    type?: string;
    inputMode?: "numeric" | "tel" | "email" | "text";
    maxLength?: number;
    prefix?: string;
  }) => (
    <div className="member-edit-field">
      <FitText as="label" htmlFor={id} style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>
        {label}
      </FitText>
      <div style={{ position: "relative" }}>
        <Icon aria-hidden="true" color={colors.textMuted} size={14} style={{ left: 12, pointerEvents: "none", position: "absolute", top: "50%", transform: "translateY(-50%)" }} />
        {prefix ? (
          <FitText aria-hidden="true" style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800, left: 36, pointerEvents: "none", position: "absolute", top: "50%", transform: "translateY(-50%)" }}>
            {prefix}
          </FitText>
        ) : null}
        <FitTextInput
          id={id}
          aria-label={label}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
          onBlur={() => {
            if (onChange) markPersonalFieldTouched(id.replace("member-profile-", "") as "firstName" | "lastName" | "phone" | "dateOfBirth");
          }}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          placeholder={placeholder}
          style={{ ...getInputStyle(colors, disabled), ...(prefix ? { paddingLeft: 72 } : {}) }}
          type={type}
          value={value}
        />
      </div>
      <FieldError colors={colors} message={error} />
    </div>
  );

  const renderReadOnly = (id: string, label: string, value: string) => (
    <div className="member-edit-field">
      <FitText as="label" htmlFor={id} style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>
        {label}
      </FitText>
      <FitTextInput
        id={id}
        aria-label={label}
        disabled
        value={value || "--"}
        style={{ ...getInputStyle(colors, true), paddingLeft: 12 }}
      />
    </div>
  );

  const inputGrid: CSSProperties = {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  };

  return (
    <>
      <FitModal
        isOpen={isOpen}
        onClose={handleClose}
        closeDisabled={saving || confirmOpen}
        title="Edit Profile"
        subtitle="Update your personal details and fitness profile."
        icon={User}
        maxWidth={720}
        containerStyle={{ width: "min(100%, 720px)", maxHeight: "min(90vh, 760px)" }}
        contentStyle={{ minHeight: 0, maxHeight: "min(64vh, 560px)", overflowY: "auto" }}
        footer={
          <div data-member-edit-profile-footer="true" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <FitButton
              className="member-edit-footer-button"
              variant="ghost"
              label="Cancel"
              disabled={saving}
              onClick={handleClose}
              style={{ minHeight: 44, minWidth: 132 }}
            />
            <FitButton
              className="member-edit-footer-button"
              variant="primary"
              label={saving ? saveLabel : "SAVE CHANGES"}
              icon={Check}
              loading={saving}
              disabled={!hasChanges || saving || hasFieldErrors}
              onClick={() => setConfirmOpen(true)}
              style={{ minHeight: 44, minWidth: 180 }}
            />
          </div>
        }
      >
        <div data-member-edit-profile-modal="true" style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <style>{`
            [data-member-edit-profile-modal="true"] .member-edit-two-column {
              display: grid;
              gap: 14px;
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            [data-member-edit-profile-modal="true"] .member-edit-tab {
              min-height: 42px;
              min-width: 0;
            }
            [data-member-edit-profile-modal="true"] .member-edit-gender-option {
              flex: 1 1 0;
              min-height: 42px;
              min-width: 0;
            }
            [data-member-edit-profile-modal="true"] .member-edit-avatar-button {
              align-items: center;
              border: 0;
              border-radius: 16px;
              cursor: pointer;
              display: inline-flex;
              height: 84px;
              justify-content: center;
              overflow: hidden;
              padding: 0;
              position: relative;
              width: 84px;
            }
            [data-member-edit-profile-modal="true"] .member-edit-avatar-button:focus-visible,
            [data-member-edit-profile-modal="true"] .member-edit-tab:focus-visible,
            [data-member-edit-profile-modal="true"] .member-edit-gender-option:focus-visible {
              outline: 2px solid ${colors.brand};
              outline-offset: 2px;
            }
            @media (max-width: 640px) {
              [data-member-edit-profile-modal="true"] .member-edit-two-column {
                grid-template-columns: minmax(0, 1fr);
              }
              [data-member-edit-profile-modal="true"] .member-edit-gender-row {
                flex-wrap: wrap;
              }
              [data-member-edit-profile-modal="true"] .member-edit-gender-option {
                flex: 1 1 calc(50% - 6px);
              }
              [data-member-edit-profile-footer="true"] .member-edit-footer-button {
                flex: 1 1 100%;
                min-width: 0 !important;
                width: 100%;
              }
            }
          `}</style>

          <div role="tablist" aria-label="Profile sections" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <FitButton
              className="member-edit-tab"
              id="member-profile-personal-tab"
              variant={activeTab === "personal" ? "primary" : "ghost"}
              icon={User}
              label="Personal"
              role="tab"
              aria-controls="member-profile-personal-panel"
              aria-selected={activeTab === "personal"}
              onClick={() => {
                setSaveFailed(false);
                setActiveTab("personal");
              }}
            />
            <FitButton
              className="member-edit-tab"
              id="member-profile-fitness-tab"
              variant={activeTab === "fitness" ? "primary" : "ghost"}
              icon={Dumbbell}
              label="Fitness"
              role="tab"
              aria-controls="member-profile-fitness-panel"
              aria-selected={activeTab === "fitness"}
              onClick={() => {
                setSaveFailed(false);
                setActiveTab("fitness");
              }}
            />
          </div>

          {saveFailed ? (
            <div role="alert" style={{ backgroundColor: `${colors.danger}14`, border: `1px solid ${colors.danger}55`, borderRadius: 10, padding: "10px 12px" }}>
              <FitText style={{ color: colors.danger, fontSize: 12, lineHeight: 1.4 }}>
                {message || "Unable to update profile. Check your entries and try again."}
              </FitText>
            </div>
          ) : null}

          {activeTab === "personal" ? (
            <div id="member-profile-personal-panel" role="tabpanel" aria-labelledby="member-profile-personal-tab" style={{ display: "grid", gap: 16 }}>
              <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                <button
                  type="button"
                  className="member-edit-avatar-button"
                  aria-label="Change profile avatar"
                  disabled={saving}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ backgroundColor: colors.brand, border: `2px solid ${colors.brandLight ?? colors.brand}`, color: onBrandTextColor }}
                >
                  {displayedAvatarUri ? (
                    <img src={displayedAvatarUri} alt="Profile avatar preview" style={{ height: "100%", objectFit: "cover", width: "100%" }} />
                  ) : (
                    <FitText style={{ color: onBrandTextColor, fontSize: 28, fontWeight: 800 }}>{initials}</FitText>
                  )}
                  <span aria-hidden="true" style={{ alignItems: "center", backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 999, bottom: 3, display: "inline-flex", height: 24, justifyContent: "center", position: "absolute", right: 3, width: 24 }}>
                    <Camera color={colors.brand} size={13} strokeWidth={2.4} />
                  </span>
                </button>
                <div style={{ minWidth: 0 }}>
                  <FitText style={{ color: colors.textPrimary, display: "block", fontSize: 15, fontWeight: 800 }}>Profile photo</FitText>
                  <FitText style={{ color: colors.textMuted, display: "block", fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>Choose a square image for the member profile.</FitText>
                  <FitButton variant="ghost" label="Change avatar" disabled={saving} onClick={() => fileInputRef.current?.click()} style={{ marginTop: 8, minHeight: 36, padding: "7px 10px" }} />
                </div>
              </div>

              <div className="member-edit-two-column" style={inputGrid}>
                {renderInput({ id: "member-profile-firstName", label: "First Name", icon: User, value: personalData.firstName, placeholder: "First name", onChange: (value) => updateField("firstName", value), error: fieldErrors.firstName })}
                {renderInput({ id: "member-profile-lastName", label: "Last Name", icon: User, value: personalData.lastName, placeholder: "Last name", onChange: (value) => updateField("lastName", value), error: fieldErrors.lastName })}
              </div>
              {renderInput({ id: "member-profile-email", label: "Email", icon: Mail, value: personalData.email, placeholder: "you@domain.com", disabled: true, type: "email" })}
              <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.4, marginTop: -10 }}>Email changes are managed outside profile settings.</FitText>
              {renderInput({ id: "member-profile-phone", label: "Phone", icon: Phone, value: getPhilippinePhoneDigits(personalData.phone), placeholder: "917xxxxxxx", onChange: (value) => updateField("phone", toPhilippinePhoneValue(value)), error: fieldErrors.phone, type: "tel", inputMode: "tel", maxLength: 10, prefix: "+63" })}
              <div className="member-edit-field">
                <FitText as="label" style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>Date of Birth</FitText>
                <FitButton
                  variant="field"
                  aria-label={`Date of Birth: ${personalData.dateOfBirth ? formatDate(personalData.dateOfBirth, "MMM d, yyyy") : "Select date"}`}
                  disabled={inputDisabled}
                  onClick={() => {
                    markPersonalFieldTouched("dateOfBirth");
                    setShowDobCalendar(true);
                  }}
                  style={{ ...getInputStyle(colors, inputDisabled), cursor: inputDisabled ? "not-allowed" : "pointer", display: "flex", justifyContent: "space-between", paddingLeft: 38, textAlign: "left" }}
                  textStyle={{ color: personalData.dateOfBirth ? colors.textPrimary : colors.textMuted, overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  <span style={{ alignItems: "center", display: "inline-flex", gap: 8, minWidth: 0 }}>
                    <CalendarDays aria-hidden="true" color={colors.textMuted} size={14} />
                    {personalData.dateOfBirth ? formatDate(personalData.dateOfBirth, "MMM d, yyyy") : "Select date"}
                  </span>
                </FitButton>
                <FieldError colors={colors} message={fieldErrors.dateOfBirth} />
              </div>
              <div>
                <FitText style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>Gender</FitText>
                <div className="member-edit-gender-row" role="radiogroup" aria-label="Gender" style={{ display: "flex", gap: 8 }}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = selectedGender === option.value;
                    return (
                      <FitButton
                        key={option.value}
                        className="member-edit-gender-option"
                        variant={selected ? "primary" : "ghost"}
                        label={option.label}
                        role="radio"
                        aria-checked={selected}
                        disabled={inputDisabled}
                        onClick={() => {
                          setSaveFailed(false);
                          setGender(option.value);
                        }}
                        style={{ minHeight: 42, padding: "8px 10px" }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div id="member-profile-fitness-panel" role="tabpanel" aria-labelledby="member-profile-fitness-tab" style={{ display: "grid", gap: 16 }}>
              <div className="member-edit-two-column" style={inputGrid}>
                {renderReadOnly("member-profile-role", "Role", roleValue)}
                {renderReadOnly("member-profile-tier", "Tier", tierValue)}
              </div>
              {renderReadOnly("member-profile-member-since", "Member Since", memberSinceValue)}
              <div className="member-edit-two-column" style={inputGrid}>
                <div className="member-edit-field">
                  <FitText as="label" htmlFor="member-profile-weight" style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>Weight (kg)</FitText>
                  <div style={{ position: "relative" }}>
                    <Scale aria-hidden="true" color={colors.textMuted} size={14} style={{ left: 12, pointerEvents: "none", position: "absolute", top: "50%", transform: "translateY(-50%)" }} />
                    <FitTextInput
                      id="member-profile-weight"
                      aria-label="Weight in kilograms"
                      disabled={inputDisabled}
                      inputMode="numeric"
                      maxLength={7}
                      onChange={(event) => {
                        setSaveFailed(false);
                        setWeightKg(event.target.value);
                      }}
                      placeholder="e.g. 70"
                      style={getInputStyle(colors, inputDisabled)}
                      type="text"
                      value={weightKg}
                    />
                  </div>
                  <FieldError colors={colors} message={fieldErrors.weightKg} />
                </div>
                <div className="member-edit-field">
                  <FitText as="label" htmlFor="member-profile-height" style={{ color: colors.textMuted, display: "block", fontSize: 12, marginBottom: 6 }}>Height (cm)</FitText>
                  <div style={{ position: "relative" }}>
                    <Ruler aria-hidden="true" color={colors.textMuted} size={14} style={{ left: 12, pointerEvents: "none", position: "absolute", top: "50%", transform: "translateY(-50%)" }} />
                    <FitTextInput
                      id="member-profile-height"
                      aria-label="Height in centimeters"
                      disabled={inputDisabled}
                      inputMode="numeric"
                      maxLength={7}
                      onChange={(event) => {
                        setSaveFailed(false);
                        setHeightCm(event.target.value);
                      }}
                      placeholder="e.g. 170"
                      style={getInputStyle(colors, inputDisabled)}
                      type="text"
                      value={heightCm}
                    />
                  </div>
                  <FieldError colors={colors} message={fieldErrors.heightCm} />
                </div>
              </div>
              <div style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14 }}>
                <FitText style={{ color: colors.textMuted, display: "block", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>BMI</FitText>
                <div style={{ alignItems: "baseline", display: "flex", gap: 10, marginTop: 6 }}>
                  <FitText style={{ color: bmi ? colors.brand : colors.textDisabled, fontSize: 26, fontWeight: 800 }}>{bmi ? bmi.bmi : "--"}</FitText>
                  <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>{bmi ? bmi.status : "Enter weight and height"}</FitText>
                </div>
                <FitText style={{ color: colors.textMuted, display: "block", fontSize: 11, lineHeight: 1.4, marginTop: 4 }}>Used for fitness personalization and progress summaries.</FitText>
              </div>
            </div>
          )}
        </div>
      </FitModal>

      <CalendarModal
        isOpen={showDobCalendar}
        minDate={null}
        maxDate={formatDateYMD(new Date())}
        closeOnSelect={false}
        keepViewOnMonthSelect
        keepViewOnYearSelect
        preserveViewOnSelectedDateChange
        yearRangeStart={new Date().getFullYear() - 100}
        yearRangeEnd={new Date().getFullYear()}
        noScroll={false}
        selectedDate={personalData.dateOfBirth}
        onSelect={(dateYmd) => updateField("dateOfBirth", dateYmd)}
        onClose={() => setShowDobCalendar(false)}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        title="Save profile changes?"
        message="Review your details, then confirm to update your member profile."
        confirmLabel="CONFIRM SAVE"
        cancelLabel="KEEP EDITING"
        confirmIcon={Check}
        isLoading={saving}
        loadingLabel="SAVING CHANGES"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmSave()}
      />
    </>
  );
}
