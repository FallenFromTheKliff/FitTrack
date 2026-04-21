import { z } from "zod";

export const membershipPaymentProviderSchema = z.enum(["paymongo", "cash"]);
export const membershipPaymentStageSchema = z.enum(["downpayment", "balance", "full"]);
export const membershipPayableTypeSchema = z.enum(["subscription", "booking", "coaching", "product", "membership_card"]);
export const membershipPaymentStatusSchema = z.enum([
  "pending",
  "processing",
  "awaiting_verification",
  "completed",
  "failed"
]);

export const purchaseMembershipCardSchema = z.object({
  provider: membershipPaymentProviderSchema
});

export const subscribeToMembershipSchema = z.object({
  planId: z.string().uuid("Plan id must be a valid UUID"),
  provider: membershipPaymentProviderSchema
});

export const cancelMembershipSchema = z.object({
  reason: z.string().trim().max(500, "Reason must not exceed 500 characters").optional()
});

export const manualMembershipPaymentSchema = z.object({
  payableType: membershipPayableTypeSchema,
  payableId: z.string().uuid("Payable id must be a valid UUID"),
  paymentStage: membershipPaymentStageSchema,
  amount: z.number().positive("Amount must be a positive number"),
  screenshotUrl: z.string().url("Screenshot URL must be a valid URL"),
  referenceNo: z.string().trim().min(1, "Reference number is required").max(100, "Reference number must not exceed 100 characters")
});

export const verifyMembershipPaymentSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(500, "Rejection reason must not exceed 500 characters").optional()
}).refine((value) => value.action === "approve" || !!value.rejectionReason, {
  message: "Rejection reason is required when rejecting a payment",
  path: ["rejectionReason"]
});

export type SubscribeToMembershipData = z.infer<typeof subscribeToMembershipSchema>;
export type PurchaseMembershipCardData = z.infer<typeof purchaseMembershipCardSchema>;
export type CancelMembershipData = z.infer<typeof cancelMembershipSchema>;
export type ManualMembershipPaymentData = z.infer<typeof manualMembershipPaymentSchema>;
export type VerifyMembershipPaymentData = z.infer<typeof verifyMembershipPaymentSchema>;
