import { z } from "zod";

export const profilePersonalSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^09\d{9}$/)
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
  phone: z.string().regex(/^09\d{9}$/, "Enter a valid 11-digit PH number"),
  dateOfBirth: z.string().optional()
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