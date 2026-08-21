import { z } from "zod";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function splitDelimitedList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNonNegativeNumber(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function parseOptionalPositiveNumber(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

export const coachProfileSchema = z.object({
  bio: z.string().trim().max(500).optional().default(""),
  specialties: z.string().optional().default("").transform(splitDelimitedList),
  certifications: z.string().optional().default("").transform(splitDelimitedList),
  yearsExperience: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform(parseOptionalNonNegativeNumber)
    .refine((value) => value === undefined || !Number.isNaN(value), "Years of experience must be zero or greater"),
  hourlyRate: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform(parseOptionalPositiveNumber)
    .refine((value) => value === undefined || !Number.isNaN(value), "Hourly rate must be greater than zero")
});

export const upgradeCoachSchema = z.object({
  specialties: z
    .string()
    .trim()
    .min(1, "Enter at least one specialty")
    .transform(splitDelimitedList)
    .refine((value) => value.length > 0, "Enter at least one specialty"),
  bio: z.string().trim().optional().default(""),
  certifications: z.string().optional().default("").transform(splitDelimitedList),
  yearsExperience: z
    .string()
    .trim()
    .min(1, "Years of experience is required")
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= 0, "Years of experience must be zero or greater"),
  hourlyRate: z
    .string()
    .trim()
    .min(1, "Hourly rate is required")
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value > 0, "Hourly rate must be greater than zero")
});

export const coachAvailabilitySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_PATTERN, "Select a valid start time"),
    endTime: z.string().regex(TIME_PATTERN, "Select a valid end time"),
    isAvailable: z.boolean().default(true)
  })
  .refine(({ startTime, endTime }) => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startValue = startHour * 60 + startMinute;
    const endValue = endHour * 60 + endMinute;
    return endValue > startValue;
  }, {
    message: "End time must be later than start time",
    path: ["endTime"]
  });

export type CoachProfileData = z.infer<typeof coachProfileSchema>;
export type UpgradeCoachData = z.infer<typeof upgradeCoachSchema>;
export type CoachAvailabilityData = z.infer<typeof coachAvailabilitySchema>;