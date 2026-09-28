import type { MembershipCardRecord } from "./member.js";

export type PaginationMeta = {
  limit: number;
  next_cursor?: string | null;
  page: number;
  snapshot?: string | null;
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

export type MembershipOnsiteSaleAction = "grant" | "revoke";

export type MembershipOnsiteSalePurchaseType =
  | "membership_card"
  | "gym_membership";

export type MembershipAccessAction = "grant" | "revoke";

export type MembershipAccessProduct =
  | "membership_card"
  | "gym_membership"
  | "free_day_pass";

export type MembershipAccessCandidatesParams = {
  action: MembershipAccessAction;
  product: MembershipAccessProduct;
  search?: string;
};

export type MembershipAccessCandidateRecord = {
  displayName: string;
  email: string | null;
  expiresAt: string | null;
  freePassExpiresAt: string | null;
  memberId: string;
  membershipCardStatus: MembershipCardRecord["status"] | null;
  planName: string | null;
  startsAt: string | null;
  subscriptionId: string | null;
  subscriptionStatus: MembershipSubscriptionStatus | null;
};

export type MembershipOnsiteSaleCandidatesParams = {
  action: MembershipOnsiteSaleAction;
  purchaseType: MembershipOnsiteSalePurchaseType;
  search?: string;
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
  is_active: boolean;
  name: string;
  price: string;
  sort_order: number;
  updated_at: string;
};

export type CreateMembershipPlanInput = {
  description?: string;
  durationDays: number;
  features?: Record<string, unknown>;
  name: string;
  price: number;
  sortOrder?: number;
};

export type UpdateMembershipPlanInput = {
  description?: string;
  durationDays?: number;
  features?: Record<string, unknown>;
  isActive?: boolean;
  name?: string;
  price?: number;
  sortOrder?: number;
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
  plan_name_snapshot?: string | null;
  plan_description_snapshot?: string | null;
  plan_price_snapshot?: string | null;
  plan_currency_snapshot?: string | null;
  duration_days_snapshot?: number | null;
  access_consumed_at?: string | null;
  plan_id: string;
  starts_at: string | null;
  status: MembershipSubscriptionStatus;
  updated_at: string;
  user_id: string;
  warned_1d_at: string | null;
  warned_3d_at: string | null;
  warned_7d_at: string | null;
};

export type MembershipOnsiteSaleCandidateRecord = {
  displayName: string;
  email: string | null;
  expiresAt: string | null;
  memberId: string;
  membershipCardStatus: MembershipCardRecord["status"] | null;
  planName: string | null;
  startsAt: string | null;
  subscriptionId: string | null;
  subscriptionStatus: MembershipSubscriptionStatus | null;
};

export type GrantFreeDayPassResponse = {
  expiresAt: string | null;
  grantedAt: string | null;
  memberId: string;
  redeemedAt: string | null;
  revokeReason: string | null;
  revokedAt: string | null;
  message: string;
};

export type RevokeFreeDayPassInput = {
  reason: string;
};

export type RevokeFreeDayPassResponse = GrantFreeDayPassResponse;

export type RevokeMembershipSubscriptionInput = {
  reason?: string;
};

export type RevokeMembershipSubscriptionResponse = {
  message: string;
  subscription: MembershipSubscriptionRecord;
};

export type MembershipFreeDayPassEligibilityRecord = {
  eligible: boolean;
  expires_at: string | null;
  granted_at: string | null;
  reason: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
};

export type MembershipOperationsDashboardItemRecord = {
  expiresAt: string | null;
  id: string;
  memberName: string;
  planName: string;
  startsAt: string | null;
  status: MembershipSubscriptionStatus;
  userId: string;
};

export type MembershipOperationsDashboardRecord = {
  expiringMembershipCount: number;
  expiringMemberships: MembershipOperationsDashboardItemRecord[];
  generatedAt: string;
  recentlyActivated: MembershipOperationsDashboardItemRecord[];
  recentlyActivatedCount: number;
  totalActiveMembersCount: number;
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
  | "commerce_checkout_hold"
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
  membership_kind?: "membership_card" | "gym_membership" | null;
  membership_item_name?: string | null;
  membership_plan_name?: string | null;
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

export type MembershipCatalogSettingsRecord = {
  membership_card_price: string;
  updated_at: string;
};

export type UpdateMembershipCatalogSettingsInput = {
  membershipCardPrice: number;
};

export type SubscribeToMembershipInput = {
  returnTarget?: "web" | "expo_web" | "mobile";
  returnUrl?: string;
  idempotencyKey?: string;
  planId: string;
  provider: "paymongo";
};

export type RecordCashMembershipInput = {
  memberId: string;
  planId?: string;
  purchaseType: "membership_card" | "gym_membership";
  idempotencyKey?: string;
};

export type RecordCashMembershipResponse = {
  can_check_in_now: boolean;
  membership_card: MembershipCardRecord | null;
  payment: MembershipPaymentRecord;
  subscription: MembershipSubscriptionRecord | null;
};

export type PurchaseMembershipCardInput = {
  returnTarget?: "web" | "expo_web" | "mobile";
  returnUrl?: string;
  idempotencyKey?: string;
  provider: "paymongo";
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
  /** @deprecated The backend returns 410 for product-visible manual payment flows. */
  paymentStage: "full";
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
