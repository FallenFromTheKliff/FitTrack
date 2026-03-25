export function buildProfileInfoRows(
  roleValue: string,
  tierValue: string,
  memberSinceValue: string,
  dobDisplay: string,
  colors: { brand: string; warning: string; textPrimary: string }
) {
  return [
    { label: "Role", value: roleValue, tone: colors.brand },
    { label: "Tier", value: tierValue, tone: colors.warning },
    { label: "Member Since", value: memberSinceValue, tone: colors.textPrimary },
    { label: "Date of Birth", value: dobDisplay, tone: colors.textPrimary }
  ];
}

export function buildProfileStatusRows(
  hasChanges: boolean,
  colors: { success: string; warning: string; brand: string }
) {
  return [
    { label: "Email Verified", state: "Active", color: colors.success },
    {
      label: "Profile Completeness",
      state: hasChanges ? "Unsaved" : "Saved",
      color: hasChanges ? colors.warning : colors.success
    },
    { label: "Security Status", state: "Protected", color: colors.brand },
    { label: "Membership Access", state: "Enabled", color: colors.success }
  ];
}

export function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}