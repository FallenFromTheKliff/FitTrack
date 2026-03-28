import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Minimum 8 characters")
});

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email"),
    phone: z.string().regex(/^09\d{9}$/, "Enter a valid 11-digit PH number"),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;