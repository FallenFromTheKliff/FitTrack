import { z } from "zod";

export type AuthPhonePrefixMode = "+63" | "09";

export const authCanonicalPhilippineMobilePattern = /^\+639\d{9}$/;
export const authLocalPhilippineMobilePattern = /^09\d{9}$/;
export const authNoPlusPhilippineMobilePattern = /^639\d{9}$/;
export const authAllowedEmailDomains = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.com.ph",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "fittrack.com",
] as const;
export const authStrongPasswordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

function sanitizeAuthPhoneDecorators(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function stripToDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function composeAuthPhilippineMobileNumber(
  mode: AuthPhonePrefixMode,
  digits: string,
) {
  const normalizedDigits = stripToDigits(digits);
  if (!normalizedDigits) return "";

  if (mode === "+63") {
    return `+63${normalizedDigits.slice(0, 10)}`;
  }

  return `09${normalizedDigits.slice(0, 9)}`;
}

export function coerceAuthPhilippineMobileInput(
  input: string,
  currentMode: AuthPhonePrefixMode = "+63",
) {
  const sanitized = sanitizeAuthPhoneDecorators(input);
  if (!sanitized) {
    return { mode: currentMode, digits: "", value: "" };
  }

  const digits = stripToDigits(sanitized);

  if (sanitized.startsWith("+63") || digits.startsWith("63")) {
    const canonicalDigits = digits.slice(2, 12);
    return {
      mode: "+63" as const,
      digits: canonicalDigits,
      value: composeAuthPhilippineMobileNumber("+63", canonicalDigits),
    };
  }

  if (digits.startsWith("09")) {
    const localDigits = digits.slice(2, 11);
    return {
      mode: "09" as const,
      digits: localDigits,
      value: composeAuthPhilippineMobileNumber("09", localDigits),
    };
  }

  if (digits.startsWith("9")) {
    const canonicalDigits = digits.slice(0, 10);
    return {
      mode: "+63" as const,
      digits: canonicalDigits,
      value: composeAuthPhilippineMobileNumber("+63", canonicalDigits),
    };
  }

  const nextDigits = currentMode === "+63" ? digits.slice(0, 10) : digits.slice(0, 9);

  return {
    mode: currentMode,
    digits: nextDigits,
    value: composeAuthPhilippineMobileNumber(currentMode, nextDigits),
  };
}

export function formatAuthPhilippineMobileDigits(
  value: string,
  mode: AuthPhonePrefixMode,
) {
  const sanitized = sanitizeAuthPhoneDecorators(value);
  if (!sanitized) return "";

  const normalized = normalizeAuthPhilippineMobileNumber(sanitized);
  if (authCanonicalPhilippineMobilePattern.test(normalized)) {
    const canonicalDigits = normalized.slice(3);
    return mode === "+63" ? canonicalDigits : canonicalDigits.slice(1);
  }

  const digits = stripToDigits(sanitized);
  if (mode === "+63") {
    if (digits.startsWith("63")) return digits.slice(2, 12);
    if (digits.startsWith("09")) return `9${digits.slice(2, 11)}`.slice(0, 10);
    return digits.slice(0, 10);
  }

  if (digits.startsWith("63")) return digits.slice(3, 12);
  if (digits.startsWith("09")) return digits.slice(2, 11);
  if (digits.startsWith("9")) return digits.slice(1, 10);
  return digits.slice(0, 9);
}

export function normalizeAuthPhilippineMobileNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const sanitized = sanitizeAuthPhoneDecorators(trimmed);

  if (authCanonicalPhilippineMobilePattern.test(sanitized)) return sanitized;

  const digits = stripToDigits(sanitized);
  if (authNoPlusPhilippineMobilePattern.test(digits)) {
    return `+${digits}`;
  }
  if (authLocalPhilippineMobilePattern.test(digits)) {
    return `+63${digits.slice(1)}`;
  }

  return trimmed;
}

export function isSupportedAuthPhilippineMobileNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;

  const sanitized = sanitizeAuthPhoneDecorators(trimmed);
  if (authCanonicalPhilippineMobilePattern.test(sanitized)) return true;

  const digits = stripToDigits(sanitized);
  return (
    authNoPlusPhilippineMobilePattern.test(digits) ||
    authLocalPhilippineMobilePattern.test(digits)
  );
}

export function isAllowedAuthEmailDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;

  const [, domain = ""] = trimmed.split("@");
  return authAllowedEmailDomains.includes(
    domain as (typeof authAllowedEmailDomains)[number],
  );
}

function buildAuthPersonNameSchema(fieldLabel: string) {
  return z
    .string({ required_error: `${fieldLabel} is required` })
    .trim()
    .min(2, `${fieldLabel} must be at least 2 characters long`)
    .max(100, `${fieldLabel} must not exceed 100 characters`)
    .refine((value) => /^[\p{L}]+(?:[ \p{L}]*[\p{L}])?$/u.test(value), {
      message: `${fieldLabel} may contain only Unicode letters and spaces`,
    });
}

function buildAuthAllowedEmailSchema(fieldLabel: string) {
  return z
    .string({ required_error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .max(255, `${fieldLabel} must not exceed 255 characters`)
    .email(`${fieldLabel} must be a valid email address`)
    .refine((value) => isAllowedAuthEmailDomain(value), {
      message: `${fieldLabel} must use an allowed provider domain`,
    })
    .transform((value: string) => value.toLowerCase());
}

function buildAuthStrongPasswordSchema(fieldLabel: string) {
  return z
    .string({ required_error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .min(8, `${fieldLabel} must be at least 8 characters long`)
    .max(64, `${fieldLabel} must not exceed 64 characters`)
    .refine((value) => !/\s/.test(value), {
      message: `${fieldLabel} must not contain spaces`,
    })
    .refine((value) => /[A-Z]/.test(value), {
      message: `${fieldLabel} must contain at least one uppercase letter`,
    })
    .refine((value) => /[a-z]/.test(value), {
      message: `${fieldLabel} must contain at least one lowercase letter`,
    })
    .refine((value) => /\d/.test(value), {
      message: `${fieldLabel} must contain at least one number`,
    })
    .refine((value) => authStrongPasswordPattern.test(value), {
      message: `${fieldLabel} must contain at least one symbol`,
    });
}

function buildOptionalAuthPhilippineMobileSchema(fieldLabel: string) {
  return z.preprocess(
    (value) => (value == null ? "" : value),
    z
      .string()
      .trim()
      .refine((value) => value.length === 0 || isSupportedAuthPhilippineMobileNumber(value), {
        message:
          `${fieldLabel} must be a valid PH mobile number (+639XXXXXXXXX, 09XXXXXXXXX, or 639XXXXXXXXX)`,
      })
      .transform((value) => (value.length === 0 ? undefined : value)),
  );
}

export const authPersonNameSchema = buildAuthPersonNameSchema("Name");
export const authAllowedEmailSchema = buildAuthAllowedEmailSchema("Email");
export const authStrongPasswordSchema = buildAuthStrongPasswordSchema("Password");
export const authOptionalPhilippineMobileSchema =
  buildOptionalAuthPhilippineMobileSchema("Phone number");

export const adminCreateUserSchema = z.object({
  firstName: buildAuthPersonNameSchema("First name"),
  lastName: buildAuthPersonNameSchema("Last name"),
  email: buildAuthAllowedEmailSchema("Email"),
  password: buildAuthStrongPasswordSchema("Password"),
  role: z.enum(["admin", "staff", "member", "coach"], {
    required_error: "Role is required",
    invalid_type_error: "Role must be one of: admin, staff, member, coach",
  }),
  phone_no: buildOptionalAuthPhilippineMobileSchema("Phone number"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export const registerSchema = z
  .object({
    firstName: buildAuthPersonNameSchema("First name"),
    lastName: buildAuthPersonNameSchema("Last name"),
    email: buildAuthAllowedEmailSchema("Email"),
    phone: z.string().trim().refine((value) => value.length === 0 || isSupportedAuthPhilippineMobileNumber(value), {
      message: "Enter a valid PH mobile number (+639XXXXXXXXX, 09XXXXXXXXX, or 639XXXXXXXXX)"
    }),
    password: buildAuthStrongPasswordSchema("Password"),
    confirmPassword: z.string().trim().min(1, "Please confirm your password")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

// Registration uses the canonical challenge contract. Keep registerSchema's
// permissive phone compatibility for existing profile/admin consumers; mobile
// registration must validate exactly what the registration DTO accepts.
export const mobileRegisterSchema = z
  .object({
    firstName: buildAuthPersonNameSchema("First name"),
    lastName: buildAuthPersonNameSchema("Last name"),
    email: buildAuthAllowedEmailSchema("Email"),
    phone: z.string().trim().refine(
      (value) => value.length === 0 || authCanonicalPhilippineMobilePattern.test(value),
      {
        message: "Enter a valid PH mobile number in +639XXXXXXXXX format",
      },
    ),
    password: buildAuthStrongPasswordSchema("Password"),
    confirmPassword: z.string().trim().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().trim().min(1, "Current password is required"),
    newPassword: z
      .string({ required_error: "New password is required" })
      .trim()
      .min(1, "New password is required")
      .min(8, "New password must be at least 8 characters long")
      .max(64, "New password must not exceed 64 characters")
      .refine((value) => /[A-Z]/.test(value), {
        message: "New password must contain at least one uppercase letter",
      })
      .refine((value) => /[a-z]/.test(value), {
        message: "New password must contain at least one lowercase letter",
      })
      .refine((value) => /\d/.test(value), {
        message: "New password must contain at least one number",
      })
      .refine((value) => authStrongPasswordPattern.test(value), {
        message: "New password must contain at least one special character",
      }),
    confirmPassword: z.string().trim().min(1, "Please confirm your new password")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type MobileRegisterData = z.infer<typeof mobileRegisterSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type AdminCreateUserData = z.infer<typeof adminCreateUserSchema>;
