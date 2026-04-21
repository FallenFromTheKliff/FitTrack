import type { MembershipCardRecord } from "./member";

export type PaginationMeta = {
  limit: number;
  page: number;
  total: number;
  total_pages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type MembershipPlanListParams = {
  limit?: number;
  page?: number;
};

export type MembershipPaymentHistoryParams = MembershipPlanListParams & {
  endDate?: string;
  startDate?: string;
};

export type MembershipPlanRecord = {
  created_at: string;
  currency: string;
  description: string | null;
  duration_days: number;
  features: Record<string, unknown>;
  id: string;
  includes_coaching: boolean;
  is_active: boolean;
  name: string;
  price: string;
  sort_order: number;
  updated_at: string;
};

export type MembershipSubscriptionStatus =
  | "pending_payment"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "suspended";

export type MembershipSubscriptionRecord = {
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  expires_at: string | null;
  id: string;
  payment_id: string | null;
  plan: MembershipPlanRecord;
  plan_id: string;
  starts_at: string | null;
  status: MembershipSubscriptionStatus;
  updated_at: string;
  user_id: string;
  warned_1d_at: string | null;
  warned_3d_at: string | null;
  warned_7d_at: string | null;
};

export type MembershipCheckoutRecord = {
  checkout_url: string;
};

export type MembershipPaymentProvider = "paymongo" | "cash";

export type MembershipPaymentStage = "downpayment" | "balance" | "full";

export type MembershipPayableType =
  | "subscription"
  | "booking"
  | "coaching"
  | "product"
  | "membership_card";

export type MembershipPaymentStatus =
  | "pending"
  | "processing"
  | "awaiting_verification"
  | "completed"
  | "failed";

export type MembershipActorRole = "admin" | "staff" | "member" | "coach";

export type MembershipActorStatus = "pending" | "active" | "suspended" | "banned";

export type MembershipPaymentRecord = {
  amount: string;
  created_at: string;
  currency: string;
  gateway_event_id: string | null;
  gateway_metadata?: Record<string, unknown> | null;
  id: string;
  idempotency_key: string;
  payable_id: string;
  payable_type: MembershipPayableType;
  payment_stage: MembershipPaymentStage;
  provider: MembershipPaymentProvider;
  provider_ref: string | null;
  rejection_reason: string | null;
  screenshot_url: string | null;
  status: MembershipPaymentStatus;
  updated_at: string;
  user_id: string;
  verified_at: string | null;
  verified_by: string | null;
};

export type MembershipPaymentProfileSummaryRecord = {
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

export type MembershipPaymentActorSummaryRecord = {
  id: string;
  profile?: MembershipPaymentProfileSummaryRecord | null;
  role: MembershipActorRole;
  status: MembershipActorStatus;
};

export type MembershipPaymentDetailsRecord = MembershipPaymentRecord & {
  user?: MembershipPaymentActorSummaryRecord | null;
  verifier?: MembershipPaymentActorSummaryRecord | null;
};

export type SubscribeToMembershipInput = {
  planId: string;
  provider: MembershipPaymentProvider;
};

export type PurchaseMembershipCardInput = {
  provider: MembershipPaymentProvider;
};

export type MembershipCardPurchaseRecord = {
  checkoutUrl: string | null;
  membershipCard: MembershipCardRecord;
  message: string;
  payment: MembershipPaymentRecord;
};

export type CancelMembershipInput = {
  reason?: string;
};

export type ManualMembershipPaymentInput = {
  amount: number;
  payableId: string;
  payableType: MembershipPayableType;
  paymentStage: MembershipPaymentStage;
  referenceNo: string;
  screenshotUrl: string;
};

export type VerifyMembershipPaymentInput = {
  action: "approve" | "reject";
  rejectionReason?: string;
};

export type MembershipPaymentReviewFilters = MembershipPlanListParams & {
  payableType?: MembershipPayableType;
  status?: MembershipPaymentStatus;
};
