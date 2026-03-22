"use client";
import { useMemo } from "react";
import { User, Dumbbell, Ruler, Shield, Activity, Pencil, Save, UserX, Lock } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { formatDate } from "@fittrack/utils";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { profileStyles } from "@/styles/pageStyles";
import { PERSONAL_FIELDS } from "@/data/profile/profile";
import { useProfilePage } from "@/hooks/profile/useProfile";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import ConfirmModal from "@/components/modals/ConfirmModal";
import CalendarModal from "@/components/modals/CalendarModal";
import SecurityModal from "@/components/modals/SecurityModal";

export default function ProfileSettingsPage() {
  const { colors, onBrandTextColor } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const s = useMemo(() => profileStyles(colors), [colors]);

  const {
    personalData,
    setPersonalData,
    weightKg,
    setWeightKg,
    heightCm,
    setHeightCm,
    editing,
    setEditing,
    saving,
    saveLabel,
    terminating,
    terminateLabel,
    showTerminateConfirm,
    setShowTerminateConfirm,
    showDobCalendar,
    setShowDobCalendar,
    showSecurityModal,
    setShowSecurityModal,
    showSensitiveConfirm,
    setShowSensitiveConfirm,
    sensitiveAction,
    setSensitiveAction,
    sensitiveLoading,
    bmi,
    hasChanges,
    roleValue,
    tierValue,
    memberSinceValue,
    dobDisplay,
    initials,
    isAdmin,
    message,
    handleSave,
    handleSensitiveConfirm,
    handleTerminate,
    resetPersonalData
  } = useProfilePage();

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

  const renderPanelHeader = ({
                               title,
                               buttonLabel,
                               icon
                             }: {
    title: string;
    buttonLabel: string;
    icon: typeof Shield;
  }) => (
      <div style={s.panelHeader}>
        <FitText style={{ fontSize: 18, fontWeight: 800 }}>{title}</FitText>
        <FitButton variant="ghost" label={buttonLabel} icon={icon} iconSize={17} disabled />
      </div>
  );

  const infoRows = [
    { label: "Role", value: roleValue, tone: colors.brand },
    { label: "Tier", value: tierValue, tone: colors.warning },
    { label: "Member Since", value: memberSinceValue, tone: colors.textPrimary },
    { label: "Date of Birth", value: dobDisplay, tone: colors.textPrimary }
  ];

  const statusRows = [
    { label: "Email Verified", state: "Active", color: colors.success },
    { label: "Profile Completeness", state: hasChanges ? "Unsaved" : "Saved", color: hasChanges ? colors.warning : colors.success },
    { label: "Security Status", state: "Protected", color: colors.brand },
    { label: "Membership Access", state: "Enabled", color: colors.success }
  ];

  return (
      <section className={themeTransition} style={fadeIn}>
        <div style={s.outerWrap}>
          <div style={s.innerWrap}>
            {message && (
                <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                  <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>{message}</FitText>
                </div>
            )}
            <div style={s.shell}>
              <div style={s.twoColGrid}>
                <div style={{ ...s.panel, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, marginBottom: 12 }}>
                    <div style={s.avatarCircle}>
                      <FitText style={{ fontSize: 34, fontWeight: 800, color: onBrandTextColor }}>{initials}</FitText>
                    </div>
                    <FitText style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: colors.brand }}>
                      Member Since: {memberSinceValue}
                    </FitText>
                  </div>
                  <FitText style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>My Profile</FitText>
                  <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                    <div style={s.twoColumnFieldGrid}>
                      {renderLabeledInput({
                        label: "First Name", icon: User, value: personalData.firstName, placeholder: "First name",
                        onChange: (value) => setPersonalData((prev) => ({ ...prev, firstName: value }))
                      })}
                      {renderLabeledInput({
                        label: "Last Name", icon: User, value: personalData.lastName, placeholder: "Last name",
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
                                  onClick={() => { if (!editing) return; setShowDobCalendar(true); }}
                                  showTrailing={false}
                                  style={{
                                    ...(editing ? s.inputBase : s.inputDisabled),
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    cursor: editing ? "pointer" : "not-allowed", textAlign: "left"
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
                                    disabled={!editing}
                                    inputMode={field.key === "phone" ? "numeric" : undefined}
                                    pattern={field.key === "phone" ? "[0-9]*" : undefined}
                                    maxLength={field.key === "phone" ? 11 : undefined}
                                    onChange={(e) => {
                                      const nextValue = field.key === "phone"
                                          ? e.target.value.replace(/\D/g, "").slice(0, 11)
                                          : e.target.value;
                                      setPersonalData((prev) => ({ ...prev, [field.key]: nextValue }));
                                    }}
                                    style={editing ? s.inputBase : s.inputDisabled}
                                />
                              </div>
                          )}
                        </div>
                    ))}
                    <div style={s.twoColumnFieldGrid}>
                      {renderLabeledInput({
                        label: "Weight (kg)", icon: Dumbbell, value: weightKg, type: "number", placeholder: "70",
                        onChange: setWeightKg
                      })}
                      {renderLabeledInput({
                        label: "Height (cm)", icon: Ruler, value: heightCm, type: "number", placeholder: "170",
                        onChange: setHeightCm
                      })}
                    </div>
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
                  <div style={s.panel}>
                    {renderPanelHeader({ title: "Membership Access", buttonLabel: editing ? "Editing" : "Locked", icon: Shield })}
                    <div style={{ display: "grid", gap: 9 }}>
                      {infoRows.map((row) => (
                          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <FitText style={{ fontSize: 14, color: colors.textMuted }}>{row.label}</FitText>
                            <FitText style={{ fontSize: 14, fontWeight: 700, color: row.tone }}>{row.value}</FitText>
                          </div>
                      ))}
                    </div>
                  </div>
                  <div style={s.panel}>
                    {renderPanelHeader({ title: "Health Snapshot", buttonLabel: "Status", icon: Activity })}
                    <div style={s.bmiCard}>
                      <FitText style={{ fontSize: 13, color: colors.textMuted, marginBottom: 3 }}>BMI</FitText>
                      <FitText style={{ fontSize: 24, fontWeight: 800, color: bmi ? colors.brand : colors.textDisabled }}>
                        {bmi ? String(bmi.bmi) : "--"}
                      </FitText>
                      <FitText style={{ fontSize: 14, color: colors.textSecondary }}>{bmi ? bmi.status : "Set weight and height"}</FitText>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {statusRows.map((row) => (
                          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <FitText style={{ fontSize: 14, color: colors.textMuted }}>{row.label}</FitText>
                            <FitPill mode="status" label={row.state} color={row.color} style={{ padding: "5px 11px" }} />
                          </div>
                      ))}
                    </div>
                  </div>
                  <div style={s.securityPanel}>
                    <FitText style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>Security Action</FitText>
                    <FitButton
                        variant="ghost"
                        label="CHANGE PASSWORD"
                        icon={Lock}
                        iconSize={17}
                        fullWidth
                        style={{ marginTop: 3 }}
                        onClick={() => setShowSecurityModal(true)}
                    />
                    <FitButton
                        variant="danger"
                        label={terminating ? terminateLabel : "TERMINATE ACCOUNT"}
                        icon={UserX}
                        iconSize={17}
                        loading={terminating}
                        disabled={isAdmin}
                        fullWidth
                        onClick={() => setShowTerminateConfirm(true)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ConfirmModal
            isOpen={showTerminateConfirm}
            title="Terminate Account"
            message="This will permanently delete your account. This action cannot be undone."
            confirmLabel={CONFIRM_COPY.terminateAccount.confirmLabel}
            cancelLabel="KEEP ACCOUNT"
            loadingLabel={CONFIRM_COPY.terminateAccount.loadingLabel}
            loadingTitle="TERMINATING ACCOUNT"
            isDanger
            isLoading={terminating}
            onConfirm={handleTerminate}
            onCancel={() => setShowTerminateConfirm(false)}
        />
        <ConfirmModal
            isOpen={showSensitiveConfirm}
            title="Sensitive Information Changed"
            message={
              sensitiveAction === "email"
                  ? "You are changing your email address. For account security, you must log in again after this update. Continue?"
                  : "You changed your password. For account security, you must log in again. Continue?"
            }
            confirmLabel={CONFIRM_COPY.sensitiveLogout.confirmLabel}
            cancelLabel="CANCEL"
            loadingLabel={CONFIRM_COPY.sensitiveLogout.loadingLabel}
            loadingTitle="LOGGING OUT"
            isLoading={sensitiveLoading}
            onConfirm={handleSensitiveConfirm}
            onCancel={() => {
              if (!sensitiveLoading) { setShowSensitiveConfirm(false); setSensitiveAction(null); }
            }}
        />
        <CalendarModal
            isOpen={showDobCalendar}
            selectedDate={personalData.dateOfBirth}
            onSelect={(dateYmd) => setPersonalData((prev) => ({ ...prev, dateOfBirth: dateYmd }))}
            onClose={() => setShowDobCalendar(false)}
            title="Date of Birth"
        />
        <SecurityModal
            isOpen={showSecurityModal}
            onClose={() => setShowSecurityModal(false)}
            onSuccess={() => { setSensitiveAction("password"); setShowSensitiveConfirm(true); }}
        />
      </section>
  );
}