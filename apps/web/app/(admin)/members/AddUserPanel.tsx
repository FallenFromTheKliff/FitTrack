"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserCog,
  UserRound,
  Users
} from "lucide-react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

import {
  adminCreateUserSchema,
  authStrongPasswordPattern,
  isAllowedAuthEmailDomain,
  isSupportedAuthPhilippineMobileNumber,
  normalizePhilippineMobileNumber,
  type AdminCreateUserData
} from "@fittrack/validators";
import { themes } from "@fittrack/ui/theme";
import type { MemberRecord } from "@fittrack/types";
import { getReadableTextColor } from "@fittrack/utils";

import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  existingAccounts: Array<Pick<MemberRecord, "email" | "phone_no">>;
  isLoading: boolean;
  loadingLabel: string;
  onBack: () => void;
  onSubmit: (data: AdminCreateUserData) => Promise<void> | void;
};

type CreateRole = "admin" | "staff" | "member";

type AdminCreateUserFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone_no: string;
  role: CreateRole;
};

type RoleMeta = {
  value: CreateRole;
  label: string;
  eyebrow: string;
  summary: string;
  access: string;
  state: string;
  automation: string;
  icon: LucideIcon;
  note: string;
};

const ROLE_OPTIONS = [
  {
    value: "member",
    label: "Member",
    eyebrow: "OTP on create",
    summary: "Starts pending until email verification.",
    access: "Member app access",
    state: "Pending verification",
    automation: "OTP email is sent automatically",
    icon: Users,
    note: "Member account with verification required before active use.",
  },
  {
    value: "staff",
    label: "Staff",
    eyebrow: "Active on create",
    summary: "Starts active with directory and attendance access.",
    access: "Operational admin access",
    state: "Active immediately",
    automation: "No verification hold",
    icon: UserCog,
    note: "Operational account with active access right away.",
  },
  {
    value: "admin",
    label: "Admin",
    eyebrow: "Active on create",
    summary: "Starts active with full portal access.",
    access: "Full admin access",
    state: "Active immediately",
    automation: "No verification hold",
    icon: ShieldCheck,
    note: "Full-access admin account, active immediately.",
  },
] as const;

const ROLE_META = ROLE_OPTIONS.reduce<Record<CreateRole, RoleMeta>>((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {} as Record<CreateRole, RoleMeta>);

const FIELD_CARD_STYLE: CSSProperties = {
  display: "grid",
  gap: 18,
  padding: 20,
  borderRadius: 22,
};

const PERSON_NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

export default function AddUserPanel({
  existingAccounts,
  isLoading,
  loadingLabel,
  onBack,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const primaryActionTextColor = getReadableTextColor(
    colors.brandLight,
    themes.sunlight.textPrimary,
    colors.textPrimary
  );
  const resolver = zodResolver(adminCreateUserSchema) as Resolver<AdminCreateUserFormValues>;
  const {
    control,
    formState: { errors, isSubmitting, submitCount },
    handleSubmit,
    register,
    setValue,
  } = useForm<AdminCreateUserFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone_no: "",
      role: "member",
    },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver,
  });

  const watchedValues = (useWatch({ control }) ?? {}) as Partial<AdminCreateUserFormValues>;
  const activeRole = (useWatch({ control, name: "role" }) ?? "member") as CreateRole;
  const activeRoleMeta = ROLE_META[activeRole];
  const roleError = errors.role?.message as string | undefined;
  const submitting = isLoading || isSubmitting;
  const firstNameValue = watchedValues.firstName ?? "";
  const lastNameValue = watchedValues.lastName ?? "";
  const emailValue = watchedValues.email ?? "";
  const passwordValue = watchedValues.password ?? "";
  const phoneValue = watchedValues.phone_no ?? "";
  const normalizedEmail = emailValue.trim().toLowerCase();
  const normalizedPhone = phoneValue.trim().length > 0
    ? normalizePhilippineMobileNumber(phoneValue)
    : "";
  const existingEmailSet = useMemo(
    () => new Set(existingAccounts.map((account) => account.email.trim().toLowerCase()).filter(Boolean)),
    [existingAccounts]
  );
  const existingPhoneSet = useMemo(
    () => new Set(existingAccounts.map((account) => normalizePhilippineMobileNumber(account.phone_no ?? "")).filter(Boolean)),
    [existingAccounts]
  );
  const duplicateEmail = normalizedEmail.length > 0 && existingEmailSet.has(normalizedEmail);
  const duplicatePhone = normalizedPhone.length > 0 && existingPhoneSet.has(normalizedPhone);
  const identityReady = (
    firstNameValue.trim().length >= 2 &&
    lastNameValue.trim().length >= 2 &&
    PERSON_NAME_PATTERN.test(firstNameValue.trim()) &&
    PERSON_NAME_PATTERN.test(lastNameValue.trim())
  );
  const passwordChecks = [
    { key: "length", label: "10+ characters", ready: passwordValue.trim().length >= 10 },
    { key: "upper", label: "Uppercase", ready: /[A-Z]/.test(passwordValue) },
    { key: "lower", label: "Lowercase", ready: /[a-z]/.test(passwordValue) },
    { key: "number", label: "Number", ready: /\d/.test(passwordValue) },
    { key: "symbol", label: "Symbol", ready: authStrongPasswordPattern.test(passwordValue) },
    { key: "spaces", label: "No spaces", ready: passwordValue.length > 0 && !/\s/.test(passwordValue) },
  ] as const;
  const passwordReady = passwordChecks.every((item) => item.ready);
  const snapshotName = [firstNameValue.trim(), lastNameValue.trim()].filter(Boolean).join(" ");
  const validationItems = [
    {
      key: "identity",
      label: "Identity",
      detail: identityReady
        ? "Name format looks clean and ready for the directory."
        : "Use real names with letters, spaces, apostrophes, or hyphens only.",
      ready: identityReady,
    },
    {
      key: "email",
      label: "Email",
      detail: duplicateEmail
        ? "This email already belongs to an existing account."
        : normalizedEmail.length > 0 && isAllowedAuthEmailDomain(normalizedEmail)
          ? "Allowed provider, valid format, and ready to save."
          : "Use a valid email with an allowed provider.",
      ready: normalizedEmail.length > 0 && isAllowedAuthEmailDomain(normalizedEmail) && !errors.email && !duplicateEmail,
    },
    {
      key: "password",
      label: "Password",
      detail: passwordReady
        ? "Temporary password meets the stronger account-creation rules."
        : "Use 10+ characters with upper, lower, number, symbol, and no spaces.",
      ready: passwordReady && !errors.password,
    },
    {
      key: "phone",
      label: "Phone",
      detail: phoneValue.trim().length === 0
        ? "Optional field can stay empty."
        : duplicatePhone
          ? "This mobile number is already used by another account."
          : isSupportedAuthPhilippineMobileNumber(phoneValue)
          ? `Will save as ${normalizedPhone}.`
          : "Use a valid PH mobile number.",
      ready: phoneValue.trim().length === 0 || (isSupportedAuthPhilippineMobileNumber(phoneValue) && !errors.phone_no && !duplicatePhone),
    },
    {
      key: "role",
      label: "Access",
      detail: `${activeRoleMeta.label} access is selected.`,
      ready: !roleError,
    },
  ] as const;
  const hasValidationIssues = validationItems.some((item) => !item.ready);

  return (
    <div
      className="add-user-panel"
      style={{
        borderRadius: 28,
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
        padding: 24,
        display: "grid",
        gap: 22,
        boxShadow: "0 24px 54px rgba(0,0,0,0.2)",
      }}
    >
      <div
        className="add-user-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <FitButton
            type="button"
            variant="ghost"
            label="Back to directory"
            icon={ArrowLeft}
            iconSize={15}
            onClick={onBack}
            disabled={submitting}
            style={{
              minHeight: 40,
              paddingInline: 14,
              borderRadius: 14,
            }}
          />
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 24, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.05 }}>
              Add a new person
            </FitText>
            <FitText as="p" style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary, maxWidth: 420 }}>
              Create the account from one tighter workspace, catch input issues early, and send people back to the directory cleanly.
            </FitText>
          </div>
        </div>
        <div
          className="add-user-header-status"
          style={{
            display: "grid",
            gap: 4,
            minWidth: 180,
            padding: "12px 14px",
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surface}d8`,
          }}
        >
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              Selected account
          </FitText>
          <FitText style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
            {activeRoleMeta.label}
          </FitText>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(async (data) => {
            await onSubmit(adminCreateUserSchema.parse(data));
          })(event);
        }}
        style={{ display: "grid", gap: 20 }}
      >
        {submitCount > 0 && hasValidationIssues ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 18,
              border: `1px solid ${colors.danger}33`,
              backgroundColor: `${colors.danger}10`,
            }}
          >
            <AlertCircle size={18} color={colors.danger} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ display: "grid", gap: 4 }}>
              <FitText style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>
                A few fields still need attention.
              </FitText>
              <FitText style={{ fontSize: 12, lineHeight: 1.55, color: colors.textSecondary }}>
                Resolve the highlighted inputs before creating the account.
              </FitText>
            </div>
          </div>
        ) : null}
        <input type="hidden" {...register("role")} />
        <div
          className="add-user-role-shell"
          style={{
            display: "grid",
            gap: 10,
            padding: 18,
            borderRadius: 22,
            border: `1px solid ${roleError ? colors.danger : colors.border}`,
            backgroundColor: `${colors.surface}c7`,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
              Account type
            </FitText>
            <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
              Choose what this person needs access to.
            </FitText>
          </div>
          <div
            className="add-user-role-grid"
            role="tablist"
            aria-label="Add account role selector"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {ROLE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = activeRole === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setValue("role", option.value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  className="add-user-role-option"
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${isActive ? `${colors.brand}55` : colors.border}`,
                    background: isActive
                      ? `linear-gradient(180deg, ${colors.brand}20 0%, ${colors.surfaceRaised} 100%)`
                      : `${colors.surfaceRaised}cc`,
                    padding: 16,
                    display: "grid",
                    gap: 10,
                    textAlign: "left",
                    boxShadow: isActive ? `0 22px 40px -28px ${colors.brand}` : "none",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.72 : 1,
                  }}
                  disabled={submitting}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${isActive ? `${colors.brand}44` : colors.border}`,
                        backgroundColor: isActive ? `${colors.brand}18` : `${colors.surface}cc`,
                        color: isActive ? colors.brand : colors.textMuted,
                      }}
                    >
                      <Icon size={18} strokeWidth={2.1} />
                    </div>
                    <FitText
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isActive ? colors.brand : colors.textMuted,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {option.eyebrow}
                    </FitText>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
                      {option.label}
                    </FitText>
                    <FitText style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary }}>
                      {option.summary}
                    </FitText>
                  </div>
                </button>
              );
            })}
          </div>
          <FitText style={{ fontSize: 12, color: roleError ? colors.danger : colors.textMuted }}>
            {roleError ?? activeRoleMeta.note}
          </FitText>
        </div>

        <div
          className="add-user-workspace"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, 0.82fr)",
            gap: 20,
            alignItems: "start",
            padding: 20,
            borderRadius: 28,
            border: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}d8`,
          }}
        >
          <div className="add-user-form-column" style={{ display: "grid", gap: 16 }}>
            <div
              className="add-user-card"
              style={{
                ...FIELD_CARD_STYLE,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surface}d8`,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  Profile details
                </FitText>
                <FitText style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary }}>
                  Start with the essentials so the account is easy to recognize later.
                </FitText>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <FitInputField
                  autoComplete="given-name"
                  control={control}
                  errors={errors}
                  icon={UserRound}
                  label="First name"
                  name="firstName"
                  placeholder="Ava"
                  disabled={submitting}
                  maxLength={100}
                  rules={{
                    validate: (value) => (
                      value.trim().length === 0 ||
                      PERSON_NAME_PATTERN.test(value.trim()) ||
                      "Use letters, spaces, apostrophes, or hyphens only"
                    ),
                  }}
                  inputRowStyle={{ transition: "border-color 140ms ease, box-shadow 140ms ease" }}
                />
                <FitInputField
                  autoComplete="family-name"
                  control={control}
                  errors={errors}
                  icon={UserRound}
                  label="Last name"
                  name="lastName"
                  placeholder="Rivera"
                  disabled={submitting}
                  maxLength={100}
                  rules={{
                    validate: (value) => (
                      value.trim().length === 0 ||
                      PERSON_NAME_PATTERN.test(value.trim()) ||
                      "Use letters, spaces, apostrophes, or hyphens only"
                    ),
                  }}
                  inputRowStyle={{ transition: "border-color 140ms ease, box-shadow 140ms ease" }}
                />
                <FitInputField
                  autoComplete="email"
                  control={control}
                  errors={errors}
                  icon={Mail}
                  label="Email"
                  name="email"
                  placeholder="member@fittrack.com"
                  type="email"
                  disabled={submitting}
                  maxLength={255}
                  rules={{
                    validate: (value) => {
                      const normalizedValue = value.trim().toLowerCase();
                      if (!normalizedValue) return true;
                      return !existingEmailSet.has(normalizedValue) || "An account with this email already exists";
                    },
                  }}
                  inputRowStyle={{ transition: "border-color 140ms ease, box-shadow 140ms ease" }}
                />
                <FitInputField
                  autoComplete="tel"
                  control={control}
                  errors={errors}
                  icon={Phone}
                  label="Phone"
                  name="phone_no"
                  placeholder="09XXXXXXXXX"
                  type="tel"
                  disabled={submitting}
                  optional
                  maxLength={13}
                  rules={{
                    validate: (value) => {
                      const normalizedValue = value.trim().length > 0
                        ? normalizePhilippineMobileNumber(value)
                        : "";
                      if (!normalizedValue) return true;
                      return !existingPhoneSet.has(normalizedValue) || "This phone number is already used by another account";
                    },
                  }}
                  inputRowStyle={{ transition: "border-color 140ms ease, box-shadow 140ms ease" }}
                />
              </div>
            </div>

            <div
              className="add-user-card"
              style={{
                ...FIELD_CARD_STYLE,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surface}d8`,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  Sign-in details
                </FitText>
                <FitText style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary }}>
                  Temporary credentials are only here until the person sets their own access.
                </FitText>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <FitInputField
                  autoComplete="new-password"
                  control={control}
                  errors={errors}
                  icon={Lock}
                  label="Temporary password"
                  name="password"
                  placeholder="Temporary password"
                  type="password"
                  disabled={submitting}
                  maxLength={64}
                  inputRowStyle={{ transition: "border-color 140ms ease, box-shadow 140ms ease" }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                }}
              >
                {passwordChecks.map((item) => {
                  const Icon = item.ready ? CheckCircle2 : AlertCircle;
                  const accent = item.ready ? colors.success : colors.textMuted;
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: `1px solid ${item.ready ? `${colors.success}2a` : colors.border}`,
                        backgroundColor: `${colors.surfaceRaised}cc`,
                      }}
                    >
                      <Icon size={14} color={accent} />
                      <FitText style={{ fontSize: 11.5, fontWeight: 700, color: item.ready ? colors.textPrimary : colors.textSecondary }}>
                        {item.label}
                      </FitText>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="add-user-policy-column"
            style={{ display: "grid", gap: 16, position: "sticky", top: 16, alignSelf: "start" }}
          >
            <div
              className="add-user-summary-card"
              style={{
                ...FIELD_CARD_STYLE,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.brand}10`,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
                  Account snapshot
                </FitText>
                <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  {snapshotName || "Waiting for profile details"}
                </FitText>
              </div>
              {[
                { label: "Create as", value: activeRoleMeta.label },
                { label: "Starts as", value: activeRoleMeta.state },
                { label: "Access", value: activeRoleMeta.access },
                { label: "Automation", value: activeRoleMeta.automation },
                { label: "Email", value: normalizedEmail || "No email entered yet" },
                { label: "Phone", value: normalizedPhone || "No phone added" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gap: 3,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: `${colors.surface}d8`,
                  }}
                >
                  <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
                    {item.label}
                  </FitText>
                  <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                    {item.value}
                  </FitText>
                </div>
              ))}
            </div>

            <div
              className="add-user-summary-card"
              style={{
                ...FIELD_CARD_STYLE,
                border: `1px solid ${hasValidationIssues ? `${colors.warning}33` : `${colors.success}2a`}`,
                backgroundColor: hasValidationIssues ? `${colors.warning}10` : `${colors.success}10`,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
                  Validation check
                </FitText>
                <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  {hasValidationIssues ? "Needs attention" : "Ready to create"}
                </FitText>
              </div>
              {validationItems.map((item) => {
                const Icon = item.ready ? CheckCircle2 : AlertCircle;
                const accent = item.ready ? colors.success : colors.warning;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: `1px solid ${accent}26`,
                      backgroundColor: `${colors.surface}de`,
                    }}
                  >
                    <Icon size={16} color={accent} style={{ marginTop: 2 }} />
                    <div style={{ display: "grid", gap: 2 }}>
                      <FitText style={{ fontSize: 12.5, fontWeight: 800, color: colors.textPrimary }}>
                        {item.label}
                      </FitText>
                      <FitText style={{ fontSize: 11.5, lineHeight: 1.45, color: colors.textSecondary }}>
                        {item.detail}
                      </FitText>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="add-user-footer"
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            padding: "16px 18px",
            borderRadius: 22,
            border: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}ee`,
            boxShadow: "0 -16px 34px rgba(0,0,0,0.18)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div style={{ display: "grid", gap: 4, minWidth: 220 }}>
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              Ready to create
            </FitText>
            <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
              {hasValidationIssues
                ? "Finish the validation items first, then create the account."
                : "Create the account here, then return to the directory when you are done."}
            </FitText>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <FitButton
              type="button"
              variant="ghost"
              label="Cancel"
              onClick={onBack}
              disabled={submitting}
            />
            <FitButton
              type="submit"
              variant="primary"
              label={submitting ? loadingLabel : "Create account"}
              disabled={submitting || hasValidationIssues}
              style={{
                backgroundColor: colors.brandLight,
                color: primaryActionTextColor,
                border: `1px solid ${colors.brand}33`,
                boxShadow: `0 18px 34px -26px ${colors.brand}`,
              }}
              textStyle={{ color: primaryActionTextColor }}
            />
          </div>
        </div>
      </form>
      <style>{`
        .add-user-panel {
          animation: add-user-panel-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .add-user-role-option,
        .add-user-card,
        .add-user-summary-card,
        .add-user-footer,
        .add-user-header-status {
          transition: transform 140ms ease-out, box-shadow 140ms ease-out, border-color 140ms ease-out, background-color 140ms ease-out;
        }

        .add-user-role-option:hover,
        .add-user-role-option:focus-visible,
        .add-user-card:hover,
        .add-user-summary-card:hover,
        .add-user-header-status:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
        }

        .add-user-role-option:focus-visible {
          outline: 2px solid ${colors.brand};
          outline-offset: 2px;
        }

        @keyframes add-user-panel-in {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1040px) {
          .add-user-workspace {
            grid-template-columns: 1fr !important;
          }

          .add-user-policy-column {
            position: static !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .add-user-panel {
            padding: 18px !important;
          }

          .add-user-role-grid,
          .add-user-policy-column {
            grid-template-columns: 1fr !important;
          }

          .add-user-header {
            align-items: flex-start !important;
          }

          .add-user-footer {
            padding: 14px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .add-user-panel {
            animation: none !important;
          }

          .add-user-role-option,
          .add-user-card,
          .add-user-summary-card,
          .add-user-footer,
          .add-user-header-status {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
