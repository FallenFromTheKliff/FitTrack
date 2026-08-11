import { z } from "zod";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MINIMUM_MEMBER_AGE_YEARS = 5;

export const canonicalPhilippineMobilePattern = /^\+639\d{9}$/;
export const localPhilippineMobilePattern = /^09\d{9}$/;
export const philippineMobileSubscriberPattern = /^9\d{9}$/;
export const supportedPhilippineMobilePattern = /^(\+639\d{9}|09\d{9})$/;
const memberNamePattern = /^[\p{L}\p{M}]+(?:[ \p{L}\p{M}]*[\p{L}\p{M}])?$/u;

export function sanitizePhilippineMobileSubscriberInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) return digits.slice(2, 12);
  if (digits.startsWith("0")) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

export function sanitizePhilippineMobileInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return `0${digits.slice(2, 12)}`.slice(0, 11);
  }

  if (digits.startsWith("9")) {
    return `0${digits.slice(0, 10)}`.slice(0, 11);
  }

  return digits.slice(0, 11);
}

export function formatPhilippineMobileForInput(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (localPhilippineMobilePattern.test(trimmed)) return trimmed;
  if (canonicalPhilippineMobilePattern.test(trimmed)) {
    return `0${trimmed.slice(3)}`;
  }

  const sanitized = sanitizePhilippineMobileInput(trimmed);
  return localPhilippineMobilePattern.test(sanitized) ? sanitized : trimmed;
}

export function normalizePhilippineMobileNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (canonicalPhilippineMobilePattern.test(trimmed)) return trimmed;

  const sanitized = sanitizePhilippineMobileInput(trimmed);
  if (localPhilippineMobilePattern.test(sanitized)) {
    return `+63${sanitized.slice(1)}`;
  }

  return trimmed;
}

export function isSupportedPhilippineMobileNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 || supportedPhilippineMobilePattern.test(trimmed);
}

function parseIsoDateOnly(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

function getTodayParts(today = new Date()) {
  return {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear()
  };
}

export function formatDatePartsYmd(parts: { day: number; month: number; year: number }) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

export function getLatestAllowedMemberBirthDate(today = new Date()) {
  const todayParts = getTodayParts(today);
  return formatDatePartsYmd({
    day: todayParts.day,
    month: todayParts.month,
    year: todayParts.year - MINIMUM_MEMBER_AGE_YEARS
  });
}

export function calculateAgeFromDateOfBirth(value: string, today = new Date()) {
  const parsed = parseIsoDateOnly(value);
  if (!parsed) return null;

  const todayParts = getTodayParts(today);
  let age = todayParts.year - parsed.year;
  if (
    todayParts.month < parsed.month ||
    (todayParts.month === parsed.month && todayParts.day < parsed.day)
  ) {
    age -= 1;
  }

  return age;
}

export function isValidMemberDateOfBirth(value: string, today = new Date()) {
  const trimmed = value.trim();
  if (!parseIsoDateOnly(trimmed)) return false;
  if (trimmed > formatDatePartsYmd(getTodayParts(today))) return false;
  const age = calculateAgeFromDateOfBirth(trimmed, today);
  return age !== null && age >= MINIMUM_MEMBER_AGE_YEARS;
}

export const requiredMemberDateOfBirthSchema = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, "Date of birth is required")
  .refine((value) => parseIsoDateOnly(value) !== null, {
    message: "Date of birth must be a real calendar date"
  })
  .refine((value) => value <= formatDatePartsYmd(getTodayParts()), {
    message: "Date of birth cannot be in the future"
  })
  .refine((value) => isValidMemberDateOfBirth(value), {
    message: `Member must be at least ${MINIMUM_MEMBER_AGE_YEARS} years old`
  });

export const optionalMemberDateOfBirthSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || parseIsoDateOnly(value) !== null, {
    message: "Date of birth must be a real calendar date"
  })
  .refine((value) => !value || value <= formatDatePartsYmd(getTodayParts()), {
    message: "Date of birth cannot be in the future"
  })
  .refine((value) => !value || isValidMemberDateOfBirth(value), {
    message: `Member must be at least ${MINIMUM_MEMBER_AGE_YEARS} years old`
  });

export const profilePersonalSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().trim().refine((value) => isSupportedPhilippineMobileNumber(value), {
    message: "Enter a valid PH mobile number"
  })
});

export const profileBodySchema = z.object({
  heightCm: z.number().positive().max(300),
  weightKg: z.number().positive().max(700),
  age: z.number().min(13).max(100)
});

export const profileFitnessSchema = z.object({
  weightKg: z.number().positive().max(700),
  heightCm: z.number().positive().max(300),
  currentCalories: z.number().min(0).max(10000)
});

const memberNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(100, `${label} must be 100 characters or fewer`)
    .regex(memberNamePattern, `${label} may contain only Unicode letters and spaces`);

export const editProfilePersonalSchema = z.object({
  firstName: memberNameSchema("First name"),
  lastName: memberNameSchema("Last name"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(canonicalPhilippineMobilePattern, "Enter 10 mobile digits starting with 9"),
  dateOfBirth: optionalMemberDateOfBirthSchema,
  gender: z.enum(["male", "female", "other"]).optional()
});

export const editProfileFitnessSchema = z.object({
  weightKg: z
    .string()
    .trim()
    .min(1, "Weight is required")
    .regex(/^\d+(?:\.\d+)?$/, "Enter a valid weight")
    .refine((value) => Number(value) > 0, "Weight must be greater than zero")
    .refine((value) => Number(value) <= 700, "Weight must be 700 kg or less"),
  heightCm: z
    .string()
    .trim()
    .min(1, "Height is required")
    .regex(/^\d+(?:\.\d+)?$/, "Enter a valid height")
    .refine((value) => Number(value) > 0, "Height must be greater than zero")
    .refine((value) => Number(value) <= 300, "Height must be 300 cm or less")
});

export type ProfilePersonalData = z.infer<typeof profilePersonalSchema>;
export type ProfileBodyData = z.infer<typeof profileBodySchema>;
export type ProfileFitnessData = z.infer<typeof profileFitnessSchema>;
export type EditProfilePersonalData = z.infer<typeof editProfilePersonalSchema>;
export type EditProfileFitnessData = z.infer<typeof editProfileFitnessSchema>;
