"use client";

import { useMemo, useRef } from "react";
import { Pencil, Save, User } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { formatDate } from "@fittrack/utils";
import { profileStyles } from "@/styles/pageStyles";
import { PERSONAL_FIELDS } from "@/data/profile/profile";
import { useProfilePage } from "@/hooks/profile/useProfile";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { CalendarModal } from "@/components/modals";
import { sanitizePhoneInput } from "./helpers";
import GymProfileSection from "./GymProfileSection";

export default function ProfileSettingsPage() {
  const { colors, onBrandTextColor } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const s = useMemo(() => profileStyles(colors), [colors]);

  const {
    personalData,
    setPersonalData,
    editing,
    setEditing,
    saving,
    saveLabel,
    showDobCalendar,
    setShowDobCalendar,
    hasChanges,
    roleValue,
    initials,
    displayedAvatarUri,
    isAdmin,
    message,
    setAvatarFile,
    handleSave,
    resetPersonalData
  } = useProfilePage();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const renderLabeledInput = ({
    label,
    icon: Icon,
    value,
    placeholder,
    type = "text",
    onChange
  }: {
    label: string;
    icon: typeof User;
    value: string;
    placeholder: string;
    type?: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <FitText style={s.fieldLabel}>{label}</FitText>
      <div style={{ position: "relative" }}>
        <Icon size={14} color={colors.textMuted} style={s.fieldIcon} />
        <FitTextInput
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={!editing}
          onChange={(event) => onChange(event.target.value)}
          style={editing ? s.inputBase : s.inputDisabled}
        />
      </div>
    </div>
  );

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div style={s.outerWrap}>
        <div style={s.innerWrap}>
          {message ? (
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>{message}</FitText>
            </div>
          ) : null}
          <div style={s.shell}>
            <div style={s.twoColGrid}>
              <div style={{ ...s.panel, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, marginBottom: 12 }}>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      setAvatarFile(nextFile);
                      event.target.value = "";
                    }}
                  />
                  <div
                    style={{
                      ...s.avatarCircle,
                      overflow: "hidden",
                      cursor: editing ? "pointer" : "default"
                    }}
                    onClick={() => {
                      if (!editing) return;
                      avatarInputRef.current?.click();
                    }}
                  >
                    {displayedAvatarUri ? (
                      <img
                        src={displayedAvatarUri}
                        alt="Profile avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <FitText style={{ fontSize: 34, fontWeight: 800, color: onBrandTextColor }}>{initials}</FitText>
                    )}
                  </div>
                  {editing ? (
                    <FitButton
                      variant="ghost"
                      label="Change Avatar"
                      style={{ marginTop: 8 }}
                      onClick={() => avatarInputRef.current?.click()}
                    />
                  ) : null}
                  <FitText style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: colors.brand }}>
                    Portal Role: {roleValue}
                  </FitText>
                </div>
                <FitText style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>My Profile</FitText>
                <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
                  Keep this surface focused on personal management details for the active web account.
                </FitText>
                <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                  <div style={s.twoColumnFieldGrid}>
                    {renderLabeledInput({
                      label: "First Name",
                      icon: User,
                      value: personalData.firstName,
                      placeholder: "First name",
                      onChange: (value) => setPersonalData((prev) => ({ ...prev, firstName: value }))
                    })}
                    {renderLabeledInput({
                      label: "Last Name",
                      icon: User,
                      value: personalData.lastName,
                      placeholder: "Last name",
                      onChange: (value) => setPersonalData((prev) => ({ ...prev, lastName: value }))
                    })}
                  </div>
                  {PERSONAL_FIELDS.filter((field) => field.key !== "firstName" && field.key !== "lastName").map((field) => (
                    <div key={field.key}>
                      <FitText style={s.fieldLabel}>{field.label}</FitText>
                      {field.key === "dateOfBirth" ? (
                        <FitButton
                          variant="field"
                          disabled={!editing}
                          onClick={() => {
                            if (!editing) return;
                            setShowDobCalendar(true);
                          }}
                          showTrailing={false}
                          style={{
                            ...(editing ? s.inputBase : s.inputDisabled),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: editing ? "pointer" : "not-allowed",
                            textAlign: "left"
                          }}
                          textStyle={{ color: personalData.dateOfBirth ? colors.textPrimary : colors.textMuted }}
                        >
                          {personalData.dateOfBirth ? formatDate(personalData.dateOfBirth, "MMM d, yyyy") : "Select date"}
                        </FitButton>
                      ) : (
                        <div style={{ position: "relative" }}>
                          <field.icon size={14} color={colors.textMuted} style={s.fieldIcon} />
                          <FitTextInput
                            type={field.type || "text"}
                            value={personalData[field.key]}
                            placeholder={field.placeholder}
                            disabled={!editing || field.key === "email"}
                            inputMode={field.key === "phone" ? "numeric" : undefined}
                            pattern={field.key === "phone" ? "[0-9]*" : undefined}
                            maxLength={field.key === "phone" ? 11 : undefined}
                            onChange={(event) => {
                              const nextValue = field.key === "phone"
                                ? sanitizePhoneInput(event.target.value)
                                : event.target.value;
                              setPersonalData((prev) => ({ ...prev, [field.key]: nextValue }));
                            }}
                            style={editing && field.key !== "email" ? s.inputBase : s.inputDisabled}
                          />
                        </div>
                      )}
                      {field.key === "email" ? (
                        <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                          Email updates are managed outside profile settings.
                        </FitText>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  {editing ? (
                    <>
                      <FitButton
                        variant="ghost"
                        label="Cancel"
                        fullWidth
                        style={s.actionBtn}
                        onClick={resetPersonalData}
                      />
                      <FitButton
                        variant="primary"
                        label={saving ? saveLabel : "SAVE CHANGES"}
                        icon={Save}
                        loading={saving}
                        disabled={!hasChanges}
                        fullWidth
                        style={s.actionBtn}
                        onClick={handleSave}
                      />
                    </>
                  ) : (
                    <FitButton
                      variant="primary"
                      label="Edit Profile"
                      icon={Pencil}
                      fullWidth
                      style={s.actionBtn}
                      onClick={() => setEditing(true)}
                    />
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <GymProfileSection canEdit={isAdmin} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <CalendarModal
        isOpen={showDobCalendar}
        selectedDate={personalData.dateOfBirth}
        onSelect={(dateYmd) => setPersonalData((prev) => ({ ...prev, dateOfBirth: dateYmd }))}
        onClose={() => setShowDobCalendar(false)}
      />
    </FitSection>
  );
}
