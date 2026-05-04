"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserCog,
  UserRound,
  Users
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
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

type SnapshotItem = {
  label: string;
  value: string;
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
    eyebrow: "OTP on create",
    summary: "Starts pending until email verification.",
    access: "Operational admin access",
    state: "Pending verification",
    automation: "OTP email is sent automatically",
    icon: UserCog,
    note: "Operational account with verification required before active use.",
  },
  {
    value: "admin",
    label: "Admin",
    eyebrow: "OTP on create",
    summary: "Starts pending until email verification.",
    access: "Full admin access",
    state: "Pending verification",
    automation: "OTP email is sent automatically",
    icon: ShieldCheck,
    note: "Full-access admin account with verification required before active use.",
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
const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz";
const NUMBER_CHARS = "23456789";
const SYMBOL_CHARS = "!@#$%&*_-";
const ALL_PASSWORD_CHARS = `${UPPERCASE_CHARS}${LOWERCASE_CHARS}${NUMBER_CHARS}${SYMBOL_CHARS}`;
const GENERATED_PASSWORD_LENGTH = 16;

function getRandomInt(max: number) {
  if (max <= 0) return 0;

  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function pickCharacters(source: string, count: number) {
  return Array.from({ length: count }, () => source[getRandomInt(source.length)] ?? source[0] ?? "");
}

function shuffleCharacters(characters: string[]) {
  const next = [...characters];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = getRandomInt(index + 1);
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function generateSecurePassword() {
  const requiredCharacters = [
    ...pickCharacters(UPPERCASE_CHARS, 1),
    ...pickCharacters(LOWERCASE_CHARS, 1),
    ...pickCharacters(NUMBER_CHARS, 1),
    ...pickCharacters(SYMBOL_CHARS, 1),
  ];

  const fillerCharacters = pickCharacters(
    ALL_PASSWORD_CHARS,
    Math.max(0, GENERATED_PASSWORD_LENGTH - requiredCharacters.length),
  );

  return shuffleCharacters([...requiredCharacters, ...fillerCharacters]).join("");
}

function formatPasswordStatus(
  passwordChecks: ReadonlyArray<{ label: string; ready: boolean }>,
) {
  const missingItems = passwordChecks
    .filter((item) => !item.ready)
    .map((item) => item.label.toLowerCase());

  if (missingItems.length === 0) {
    return "Password looks ready for account creation.";
  }

  return `Still needed: ${missingItems.join(", ")}.`;
}

function getPasswordRequirementsMessage(
  passwordChecks: ReadonlyArray<{ label: string; ready: boolean }>,
) {
  const missingItems = passwordChecks
    .filter((item) => !item.ready)
    .map((item) => item.label.toLowerCase());

  if (missingItems.length === 0) {
    return "";
  }

  return `Password still needs ${missingItems.join(", ")}.`;
}

function buildSnapshotItems(
  roleMeta: RoleMeta,
  values: {
    email: string;
    password: string;
    phone: string;
  },
): SnapshotItem[] {
  return [
    { label: "Account type", value: roleMeta.label },
    { label: "Starts as", value: roleMeta.state },
    { label: "Access", value: roleMeta.access },
    { label: "Automation", value: roleMeta.automation },
    { label: "Email", value: values.email || "No email entered yet" },
    { label: "Phone", value: values.phone || "No phone added" },
    { label: "Temporary password", value: values.password || "No password set yet" },
  ];
}

export default function AddUserPanel({
  existingAccounts,
  isLoading,
  loadingLabel,
  onBack,
  onSubmit,
}: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [reviewData, setReviewData] = useState<AdminCreateUserData | null>(null);
  const isStaffCreator = user?.role === "STAFF";
  const primaryActionTextColor = getReadableTextColor(
    colors.brandLight,
    themes.sunlight.textPrimary,
    colors.textPrimary,
  );
  const resolver = zodResolver(adminCreateUserSchema) as Resolver<AdminCreateUserFormValues>;
  const {
    control,
    formState: { errors, isSubmitting },
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
  const availableRoleOptions = useMemo(
    () => (isStaffCreator ? ROLE_OPTIONS.filter((option) => option.value !== "admin") : ROLE_OPTIONS),
    [isStaffCreator],
  );
  const activeRoleMeta = ROLE_META[activeRole];
  const roleError = errors.role?.message as string | undefined;
  const submitting = isLoading || isSubmitting;
  const isReviewStep = reviewData !== null;
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
    [existingAccounts],
  );
  const existingPhoneSet = useMemo(
    () => new Set(existingAccounts.map((account) => normalizePhilippineMobileNumber(account.phone_no ?? "")).filter(Boolean)),
    [existingAccounts],
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
    { key: "upper", label: "uppercase", ready: /[A-Z]/.test(passwordValue) },
    { key: "lower", label: "lowercase", ready: /[a-z]/.test(passwordValue) },
    { key: "number", label: "number", ready: /\d/.test(passwordValue) },
    { key: "symbol", label: "symbol", ready: authStrongPasswordPattern.test(passwordValue) },
    { key: "spaces", label: "no spaces", ready: passwordValue.length > 0 && !/\s/.test(passwordValue) },
  ] as const;
  const passwordReady = passwordChecks.every((item) => item.ready);
  const passwordRequirementsMessage = getPasswordRequirementsMessage(passwordChecks);
  const formReadyForReview = (
    identityReady &&
    normalizedEmail.length > 0 &&
    isAllowedAuthEmailDomain(normalizedEmail) &&
    !errors.email &&
    !duplicateEmail &&
    passwordReady &&
    !errors.password &&
    (
      phoneValue.trim().length === 0 ||
      (isSupportedAuthPhilippineMobileNumber(phoneValue) && !errors.phone_no && !duplicatePhone)
    ) &&
    !roleError
  );

  const liveSnapshotName = [firstNameValue.trim(), lastNameValue.trim()].filter(Boolean).join(" ");
  const reviewRoleMeta = reviewData ? ROLE_META[reviewData.role] : activeRoleMeta;
  const reviewSnapshotName = reviewData
    ? [reviewData.firstName.trim(), reviewData.lastName.trim()].filter(Boolean).join(" ")
    : liveSnapshotName;
  const reviewSnapshotItems = reviewData
    ? buildSnapshotItems(reviewRoleMeta, {
      email: reviewData.email.trim().toLowerCase(),
      password: reviewData.password,
      phone: reviewData.phone_no?.trim()
        ? normalizePhilippineMobileNumber(reviewData.phone_no)
        : "",
    })
    : buildSnapshotItems(activeRoleMeta, {
      email: normalizedEmail,
      password: passwordValue,
      phone: normalizedPhone,
    });

  const reviewBlockers = useMemo(() => {
    const blockers: string[] = [];

    if (!firstNameValue.trim()) {
      blockers.push("Add a first name.");
    } else if (!PERSON_NAME_PATTERN.test(firstNameValue.trim()) || firstNameValue.trim().length < 2) {
      blockers.push("Use a valid first name with at least 2 letters.");
    }

    if (!lastNameValue.trim()) {
      blockers.push("Add a last name.");
    } else if (!PERSON_NAME_PATTERN.test(lastNameValue.trim()) || lastNameValue.trim().length < 2) {
      blockers.push("Use a valid last name with at least 2 letters.");
    }

    if (!normalizedEmail) {
      blockers.push("Add an email address.");
    } else if (errors.email?.message) {
      blockers.push(String(errors.email.message));
    } else if (!isAllowedAuthEmailDomain(normalizedEmail)) {
      blockers.push("Use a supported email address.");
    } else if (duplicateEmail) {
      blockers.push("This email is already used by another account.");
    }

    if (!passwordValue.trim()) {
      blockers.push("Add a temporary password.");
    } else if (!passwordReady) {
      blockers.push(passwordRequirementsMessage);
    } else if (errors.password?.message) {
      blockers.push(String(errors.password.message));
    }

    if (phoneValue.trim()) {
      if (!isSupportedAuthPhilippineMobileNumber(phoneValue)) {
        blockers.push("Use a valid Philippine mobile number.");
      } else if (duplicatePhone) {
        blockers.push("This phone number is already used by another account.");
      } else if (errors.phone_no?.message) {
        blockers.push(String(errors.phone_no.message));
      }
    }

    if (roleError) {
      blockers.push(roleError);
    }

    return Array.from(new Set(blockers.filter(Boolean)));
  }, [
    duplicateEmail,
    duplicatePhone,
    errors.email?.message,
    errors.password?.message,
    errors.phone_no?.message,
    firstNameValue,
    lastNameValue,
    normalizedEmail,
    passwordReady,
    passwordRequirementsMessage,
    passwordValue,
    phoneValue,
    roleError,
  ]);

  const handleGeneratePassword = () => {
    const nextPassword = generateSecurePassword();
    setValue("password", nextPassword, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const openReviewStep = () => {
    void handleSubmit((data) => {
      setReviewData(adminCreateUserSchema.parse(data));
    })();
  };

  const handleConfirmCreate = async () => {
    if (!reviewData) return;
    await onSubmit(reviewData);
  };

  const renderSnapshotCard = (
    heading: string,
    name: string,
    items: SnapshotItem[],
    footer?: ReactNode,
  ) => (
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
          {heading}
        </FitText>
        <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
          {name || "Waiting for profile details"}
        </FitText>
      </div>
      {items.map((item) => (
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
      {footer ? <div style={{ display: "grid", gap: 10 }}>{footer}</div> : null}
    </div>
  );

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
            label={isReviewStep ? "Back to editing" : "Back to accounts"}
            icon={ArrowLeft}
            iconSize={15}
            onClick={() => {
              if (isReviewStep) {
                setReviewData(null);
                return;
              }

              onBack();
            }}
            disabled={submitting}
            style={{
              minHeight: 40,
              paddingInline: 14,
              borderRadius: 14,
            }}
          />
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 24, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.05 }}>
              {isReviewStep ? "Review account" : "Create account"}
            </FitText>
            <FitText as="p" style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary, maxWidth: 420 }}>
              {isReviewStep
                ? "Check the snapshot and temporary sign-in details before the account is created."
                : "Create the account from one workspace, validate the fields inline, and review everything before confirming."}
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
            {isReviewStep ? "Review status" : "Selected account type"}
          </FitText>
          <FitText style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
            {isReviewStep ? "Awaiting confirmation" : activeRoleMeta.label}
          </FitText>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (isReviewStep) {
            void handleConfirmCreate();
            return;
          }

          openReviewStep();
        }}
        style={{ display: "grid", gap: 20 }}
      >
        <input type="hidden" {...register("role")} />

        {isReviewStep ? (
          <div
            className="add-user-review-shell"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div
              className="add-user-card"
              style={{
                ...FIELD_CARD_STYLE,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surfaceRaised}d8`,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  Review before confirming
                </FitText>
                <FitText style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary }}>
                  This is the last check before the account is created. The snapshot stays visible here so the creator can verify the temporary password, access level, and contact details in one pass.
                </FitText>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                {[
                  {
                    label: "Account holder",
                    value: reviewSnapshotName || "Not provided",
                    detail: "Name shown in the directory and account records.",
                  },
                  {
                    label: "Email",
                    value: reviewData?.email ?? "",
                    detail: reviewRoleMeta.value === "member"
                      ? "This address receives the verification OTP."
                      : "This address can sign in immediately after creation.",
                  },
                  {
                    label: "Phone",
                    value: reviewData?.phone_no?.trim()
                      ? normalizePhilippineMobileNumber(reviewData.phone_no)
                      : "No phone added",
                    detail: "Optional contact detail stored on the account.",
                  },
                  {
                    label: "Temporary password",
                    value: reviewData?.password ?? "",
                    detail: "Share this securely with the account holder after creation.",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: `${colors.surface}dd`,
                    }}
                  >
                    <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
                      {item.label}
                    </FitText>
                    <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.4 }}>
                      {item.value}
                    </FitText>
                    <FitText style={{ fontSize: 11.5, lineHeight: 1.5, color: colors.textSecondary }}>
                      {item.detail}
                    </FitText>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: `${colors.surface}dd`,
                }}
              >
                <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
                  What happens next
                </FitText>
                <FitText style={{ fontSize: 13.5, lineHeight: 1.6, color: colors.textSecondary }}>
                  After confirmation, the account is created in pending
                  verification status and the OTP email is sent automatically.
                </FitText>
              </div>
            </div>

            <div
              className="add-user-policy-column"
              style={{ display: "grid", gap: 16, position: "sticky", top: 16, alignSelf: "start" }}
            >
              {renderSnapshotCard(
                "Account snapshot",
                reviewSnapshotName,
                reviewSnapshotItems,
                <>
                  <FitText style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary }}>
                    If everything in this snapshot looks correct, create the account from here.
                  </FitText>
                  <div style={{ display: "grid", gap: 10 }}>
                    <FitButton
                      type="submit"
                      variant="primary"
                      label={submitting ? loadingLabel : "Create account"}
                      disabled={submitting}
                      style={{
                        backgroundColor: colors.brandLight,
                        color: primaryActionTextColor,
                        border: `1px solid ${colors.brand}33`,
                        boxShadow: `0 18px 34px -26px ${colors.brand}`,
                      }}
                      textStyle={{ color: primaryActionTextColor }}
                    />
                    <FitButton
                      type="button"
                      variant="ghost"
                      label="Back to edit"
                      onClick={() => setReviewData(null)}
                      disabled={submitting}
                    />
                  </div>
                </>,
              )}
            </div>
          </div>
        ) : (
          <>
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
                aria-label="Create account role selector"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${availableRoleOptions.length}, minmax(0, 1fr))`,
                  gap: 10,
                }}
              >
                {availableRoleOptions.map((option) => {
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
                {roleError ?? (isStaffCreator
                  ? `${activeRoleMeta.note} Staff can create staff and member accounts only.`
                  : activeRoleMeta.note)}
              </FitText>
            </div>

            <div
              className="add-user-workspace"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
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
                    <div style={{ display: "grid", gap: 6 }}>
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
                      {duplicateEmail ? (
                        <FitText style={{ fontSize: 11.5, lineHeight: 1.5, color: colors.danger }}>
                          This email address already belongs to another account.
                        </FitText>
                      ) : null}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
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
                      {duplicatePhone ? (
                        <FitText style={{ fontSize: 11.5, lineHeight: 1.5, color: colors.danger }}>
                          This phone number already belongs to another account.
                        </FitText>
                      ) : null}
                    </div>
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
                    className="add-user-password-shell"
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      alignItems: "end",
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
                    <FitButton
                      type="button"
                      variant="ghost"
                      label="Generate password"
                      onClick={handleGeneratePassword}
                      disabled={submitting}
                      style={{
                        minHeight: 44,
                        borderRadius: 14,
                        paddingInline: 14,
                        border: `1px solid ${colors.brand}26`,
                        backgroundColor: `${colors.brand}10`,
                      }}
                      textStyle={{ color: colors.brand, fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 11.5, lineHeight: 1.6, color: colors.textSecondary }}>
                      Use 10+ characters with uppercase, lowercase, number, symbol, and no spaces.
                    </FitText>
                    <FitText style={{ fontSize: 11.5, lineHeight: 1.6, color: passwordReady ? colors.success : colors.textMuted }}>
                      {formatPasswordStatus(passwordChecks)}
                    </FitText>
                  </div>
                </div>

                <div
                  className="add-user-card"
                  style={{
                    ...FIELD_CARD_STYLE,
                    border: `1px solid ${reviewBlockers.length ? `${colors.warning}55` : `${colors.success}45`}`,
                    backgroundColor: reviewBlockers.length ? `${colors.warning}10` : `${colors.success}10`,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                      {reviewBlockers.length ? "Still blocking review" : "Ready for review"}
                    </FitText>
                    <FitText style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary }}>
                      {reviewBlockers.length
                        ? "Before Create account can open the review step, these details still need attention."
                        : `${liveSnapshotName || "This account"} is ready. Create account will open the review snapshot next.`}
                    </FitText>
                  </div>
                  {reviewBlockers.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {reviewBlockers.map((item) => (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: `${colors.surface}da`,
                          }}
                        >
                          <FitText style={{ fontSize: 12, fontWeight: 800, color: colors.warning }}>
                            !
                          </FitText>
                          <FitText style={{ fontSize: 12, lineHeight: 1.55, color: colors.textPrimary }}>
                            {item}
                          </FitText>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}

        {!isReviewStep ? (
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
                Ready to review
              </FitText>
              <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {formReadyForReview
                  ? "Create account now opens the review step before anything is submitted."
                  : "Check the alert above to see exactly what is still blocking review."}
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
                type="button"
                variant="primary"
                label="Create account"
                onClick={openReviewStep}
                disabled={submitting || !formReadyForReview}
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
        ) : null}
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
          .add-user-workspace,
          .add-user-review-shell {
            grid-template-columns: 1fr !important;
          }

          .add-user-policy-column {
            position: static !important;
          }
        }

        @media (max-width: 760px) {
          .add-user-panel {
            padding: 18px !important;
          }

          .add-user-role-grid,
          .add-user-policy-column,
          .add-user-password-shell {
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
