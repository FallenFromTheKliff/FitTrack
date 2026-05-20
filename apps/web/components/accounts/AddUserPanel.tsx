"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronUp,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserCog,
  UserPlus,
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
import type { MemberRecord } from "@fittrack/types";

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

type CreateRole = "admin" | "staff" | "member" | "coach";

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
    eyebrow: "Login verification",
    summary: "Starts pending until login verification.",
    access: "Member app access",
    state: "Not Verified",
    automation: "OTP email is sent on first sign-in",
    icon: Users,
    note: "Member account with verification required before active use.",
  },
  {
    value: "staff",
    label: "Staff",
    eyebrow: "Temporary password",
    summary: "Starts pending until login verification.",
    access: "Operational admin access",
    state: "Not Verified",
    automation: "OTP email is sent on first sign-in",
    icon: UserCog,
    note: "Operational account with verification required before active use.",
  },
  {
    value: "coach",
    label: "Coach",
    eyebrow: "Temporary password",
    summary: "Starts pending until login verification.",
    access: "Coach web profile access",
    state: "Not Verified",
    automation: "OTP email is sent on first sign-in",
    icon: UserRound,
    note: "Coach account with verification required before active use.",
  },
  {
    value: "admin",
    label: "Admin",
    eyebrow: "Temporary password",
    summary: "Starts pending until login verification.",
    access: "Full admin access",
    state: "Not Verified",
    automation: "OTP email is sent on first sign-in",
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
  gap: 10,
  padding: 12,
  borderRadius: 8,
};
const CREATE_PANE_SCROLL_MAX_HEIGHT = "calc(100dvh - 176px)";

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
  const { colors, onBrandTextColor } = useTheme();
  const [reviewData, setReviewData] = useState<AdminCreateUserData | null>(null);
  const [roleOptionsOpen, setRoleOptionsOpen] = useState(false);
  const roleOptionsPanelId = useId();
  const isStaffCreator = user?.role === "STAFF";
  const primaryActionTextColor = onBrandTextColor;
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
  const createAccountInitials =
    [firstNameValue.trim(), lastNameValue.trim()]
      .map((value) => value.charAt(0))
      .filter(Boolean)
      .join("")
      .toUpperCase() || activeRoleMeta.label.slice(0, 2).toUpperCase();
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
  const reviewNextStepCopy =
    "After confirmation, the account is created in Not Verified status. The verification OTP email is sent when the account holder signs in.";

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
            borderRadius: 8,
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
        borderRadius: 8,
        border: "none",
        background: "transparent",
        padding: 0,
        display: "grid",
        gap: 0,
        boxShadow: "none",
        height: "100%",
        minHeight: 0,
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (isReviewStep) {
            void handleConfirmCreate();
            return;
          }

          openReviewStep();
        }}
        style={{ display: "grid", gap: 10, height: "100%", minHeight: 0 }}
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
              height: "100%",
              minHeight: 0,
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
                    detail: "This address receives the verification OTP when the account holder signs in.",
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
                      borderRadius: 8,
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
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: `${colors.surface}dd`,
                }}
              >
                <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
                  What happens next
                </FitText>
                <FitText style={{ fontSize: 13.5, lineHeight: 1.6, color: colors.textSecondary }}>
                  {reviewNextStepCopy}
                </FitText>
              </div>
            </div>

            <div
              className="add-user-policy-column"
              style={{
                display: "grid",
                gap: 16,
                position: "sticky",
                top: 16,
                alignSelf: "start",
                height: "100%",
                minHeight: 0,
                maxHeight: CREATE_PANE_SCROLL_MAX_HEIGHT,
                overflowY: "auto",
                paddingRight: 4,
              }}
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
                      icon={UserPlus}
                      iconSize={14}
                      disabled={submitting}
                      style={{
                        backgroundColor: colors.brand,
                        color: primaryActionTextColor,
                        border: `1px solid ${colors.brand}`,
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
              className="add-user-workspace"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 0.76fr) minmax(0, 1.24fr)",
                gap: 12,
                alignItems: "stretch",
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                height: "100%",
                minHeight: 0,
              }}
            >
              <div
                className="create-account-card"
                style={{
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "transparent",
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                  alignItems: "start",
                  justifyItems: "center",
                  textAlign: "center",
                  alignSelf: "stretch",
                }}
              >
                <FitButton
                  type="button"
                  variant="ghost"
                  label="Back"
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
                    justifySelf: "start",
                    minHeight: 34,
                    paddingInline: 11,
                    borderRadius: 8,
                  }}
                  textStyle={{ fontSize: 11.5, fontWeight: 800 }}
                />
                <div
                  aria-hidden
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    border: `1px solid ${colors.brand}55`,
                    backgroundColor: colors.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: primaryActionTextColor,
                  }}
                >
                  <FitText style={{ fontSize: 21, fontWeight: 850, color: primaryActionTextColor }}>
                    {createAccountInitials}
                  </FitText>
                </div>
                <div style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <FitText
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: colors.textMuted,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Create Account Card
                    </FitText>
                    <FitText
                      style={{
                        fontSize: 19,
                        fontWeight: 850,
                        color: colors.textPrimary,
                        lineHeight: 1.1,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {liveSnapshotName || "New account"}
                    </FitText>
                    <FitText
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {normalizedEmail || "Email pending"}
                    </FitText>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 6,
                    }}
                  >
                    {[
                      ["Access", activeRoleMeta.access],
                      ["Status", activeRoleMeta.state],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          display: "grid",
                          gap: 5,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surfaceRaised,
                          padding: "9px 10px",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                      >
                        <FitText style={{ fontSize: 10, fontWeight: 500, color: colors.textMuted, letterSpacing: "0.05em" }}>
                          {label}
                        </FitText>
                        <FitText style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary, overflowWrap: "anywhere" }}>
                          {value}
                        </FitText>
                      </div>
                    ))}
                  </div>
                  <FitText style={{ fontSize: 11.5, lineHeight: 1.45, color: colors.textSecondary, textAlign: "left" }}>
                    {activeRoleMeta.automation}
                  </FitText>
                  <div
                    id={roleOptionsPanelId}
                    className="create-account-role-stack"
                    role="tablist"
                    aria-label="Create account role selector"
                    style={{
                      display: "grid",
                      gap: 6,
                      width: "100%",
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
                          aria-controls={isActive ? roleOptionsPanelId : undefined}
                          aria-expanded={isActive ? roleOptionsOpen : undefined}
                          onClick={() => {
                            if (isActive) {
                              setRoleOptionsOpen((current) => !current);
                              return;
                            }

                            setValue("role", option.value, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                            setRoleOptionsOpen(false);
                          }}
                          disabled={submitting}
                          style={{
                            width: "100%",
                            minHeight: 42,
                            borderRadius: 8,
                            border: `1px solid ${isActive ? `${colors.brand}66` : colors.border}`,
                            backgroundColor: isActive ? `${colors.brand}16` : colors.surfaceRaised,
                            color: isActive ? colors.brand : colors.textPrimary,
                            display: isActive || roleOptionsOpen ? "grid" : "none",
                            gridTemplateColumns: isActive ? "32px minmax(0, 1fr) auto" : "32px minmax(0, 1fr)",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 9px",
                            textAlign: "left",
                            cursor: submitting ? "not-allowed" : "pointer",
                            opacity: submitting ? 0.72 : 1,
                            order: isActive ? -1 : undefined,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: `1px solid ${isActive ? `${colors.brand}55` : colors.border}`,
                              backgroundColor: isActive ? `${colors.brand}18` : colors.surface,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Icon size={16} strokeWidth={2.2} />
                          </span>
                          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                            <FitText style={{ fontSize: 12.5, fontWeight: 850, color: isActive ? colors.brand : colors.textPrimary }}>
                              {option.label}
                            </FitText>
                            <FitText style={{ fontSize: 10.5, color: colors.textMuted, lineHeight: 1.3, overflowWrap: "anywhere" }}>
                              {option.summary}
                            </FitText>
                          </span>
                          {isActive ? (
                            <ChevronUp
                              size={15}
                              color={roleOptionsOpen ? colors.brand : colors.textMuted}
                              style={{
                                justifySelf: "end",
                                transform: roleOptionsOpen ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 180ms ease",
                              }}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <FitText style={{ fontSize: 11.5, lineHeight: 1.45, color: roleError ? colors.danger : colors.textMuted, textAlign: "left" }}>
                    {roleError ?? (isStaffCreator
                      ? `${activeRoleMeta.note} Staff can create staff and member accounts only.`
                      : activeRoleMeta.note)}
                  </FitText>
                </div>
              </div>
              <div
                className="add-user-form-column"
                style={{
                  display: "grid",
                  gap: 12,
                  minHeight: 0,
                  minWidth: 0,
                  height: "100%",
                  maxHeight: CREATE_PANE_SCROLL_MAX_HEIGHT,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                <div
                  className="add-user-card"
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 0,
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "transparent",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
                      Profile details
                    </FitText>
                    <FitText style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary }}>
                      Start with the essentials so the account is easy to recognize later.
                    </FitText>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "1fr",
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
                    display: "grid",
                    gap: 10,
                    padding: 0,
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "transparent",
                  }}
                >
                  <div style={{ display: "grid", gap: 2 }}>
                    <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
                      Sign-in details
                    </FitText>
                  </div>
                  <div
                    className="add-user-password-shell"
                    style={{
                      display: "grid",
                      gap: 10,
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
                      variant="primary"
                      label="Generate password"
                      icon={KeyRound}
                      iconSize={14}
                      onClick={handleGeneratePassword}
                      disabled={submitting}
                      style={{
                        minHeight: 44,
                        borderRadius: 8,
                        paddingInline: 14,
                        border: `1px solid ${colors.brand}`,
                        backgroundColor: colors.brand,
                      }}
                      textStyle={{ color: primaryActionTextColor, fontWeight: 800 }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 11.5, lineHeight: 1.6, color: passwordReady ? colors.success : colors.textMuted }}>
                      {formatPasswordStatus(passwordChecks)}
                    </FitText>
                  </div>
                </div>

                <div
                  className="add-user-card"
                  style={{
                    ...FIELD_CARD_STYLE,
                    borderRadius: 8,
                    border: `1px solid ${reviewBlockers.length ? `${colors.warning}55` : `${colors.success}45`}`,
                    backgroundColor: reviewBlockers.length ? `${colors.warning}10` : `${colors.success}10`,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
                      {reviewBlockers.length ? "Still blocking review" : "Ready for review"}
                    </FitText>
                    <FitText style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary }}>
                      {reviewBlockers.length
                        ? "Before Create account can open the review step, these details still need attention."
                        : `${liveSnapshotName || "This account"} is ready. Create account will open the review snapshot next.`}
                    </FitText>
                  </div>
                  {reviewBlockers.length ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {reviewBlockers.map((item) => (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "9px 11px",
                            borderRadius: 8,
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
                      icon={UserPlus}
                      iconSize={14}
                      onClick={openReviewStep}
                      disabled={submitting || !formReadyForReview}
                      style={{
                        backgroundColor: colors.brand,
                        color: primaryActionTextColor,
                        border: `1px solid ${colors.brand}`,
                        boxShadow: `0 18px 34px -26px ${colors.brand}`,
                      }}
                      textStyle={{ color: primaryActionTextColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </form>
      <style>{`
        .add-user-panel {
          animation: add-user-panel-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .add-user-role-option,
        .add-user-card,
        .add-user-summary-card,
        .create-account-card {
          transition: border-color 140ms ease-out, background-color 140ms ease-out;
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

          .add-user-form-column,
          .add-user-policy-column {
            max-height: none !important;
            overflow-y: visible !important;
            padding-right: 0 !important;
          }
        }

        @media (max-width: 760px) {
          .add-user-panel {
            padding: 0 !important;
          }

          .add-user-policy-column,
          .create-account-card,
          .add-user-password-shell {
            grid-template-columns: 1fr !important;
          }

          .create-account-card {
            justify-items: center !important;
            text-align: center !important;
            position: static !important;
          }

          .create-account-card > div:last-child > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .add-user-panel {
            animation: none !important;
          }

          .add-user-role-option,
          .add-user-card,
          .add-user-summary-card,
          .create-account-card {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
