import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Minimum 8 characters"),
});

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email"),
    phone: z.string().regex(/^09\d{9}$/, "Enter a valid 11-digit PH number"),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profilePersonalSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^09\d{9}$/),
});

export const profileBodySchema = z.object({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  age: z.number().min(13).max(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const addProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  category: z.string().min(1),
  stock: z.number().min(0),
  price: z.number().min(0),
});

export const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type ProfilePersonalData = z.infer<typeof profilePersonalSchema>;
export type ProfileBodyData = z.infer<typeof profileBodySchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type AddProductData = z.infer<typeof addProductSchema>;
export type CreateBookingData = z.infer<typeof createBookingSchema>;
