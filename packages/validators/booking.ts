import { z } from "zod";

export const addProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  category: z.string().min(1),
  stock: z.number().min(0),
  price: z.number().min(0)
});

export const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1)
});

export type AddProductData = z.infer<typeof addProductSchema>;
export type CreateBookingData = z.infer<typeof createBookingSchema>;