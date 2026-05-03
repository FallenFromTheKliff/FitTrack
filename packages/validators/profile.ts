import { z } from "zod";

export const canonicalPhilippineMobilePattern = /^\+639\d{9}$/;
export const localPhilippineMobilePattern = /^09\d{9}$/;
export const supportedPhilippineMobilePattern = /^(\+639\d{9}|09\d{9})$/;

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

export const profilePersonalSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().trim().refine((value) => isSupportedPhilippineMobileNumber(value), {
    message: "Enter a valid PH mobile number"
  })
});

export const profileBodySchema = z.object({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  age: z.number().min(13).max(100)
});

export const profileFitnessSchema = z.object({
  weightKg: z.number().min(30).max(300),
  heightCm: z.number().min(100).max(250),
  currentCalories: z.number().min(0).max(10000)
});

export const editProfilePersonalSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().trim().refine((value) => isSupportedPhilippineMobileNumber(value), {
    message: "Enter a valid PH mobile number"
  }),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional()
});

export const editProfileFitnessSchema = z.object({
  weightKg: z.string().refine((value) => value === "" || (!isNaN(Number(value)) && Number(value) >= 0), {
    message: "Enter a valid weight"
  }),
  heightCm: z.string().refine((value) => value === "" || (!isNaN(Number(value)) && Number(value) >= 0), {
    message: "Enter a valid height"
  })
});

export type ProfilePersonalData = z.infer<typeof profilePersonalSchema>;
export type ProfileBodyData = z.infer<typeof profileBodySchema>;
export type ProfileFitnessData = z.infer<typeof profileFitnessSchema>;
export type EditProfilePersonalData = z.infer<typeof editProfilePersonalSchema>;
export type EditProfileFitnessData = z.infer<typeof editProfileFitnessSchema>;
