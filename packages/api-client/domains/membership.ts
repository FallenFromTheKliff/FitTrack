import type {
  CancelMembershipInput,
  CreateMembershipPlanInput,
  MembershipCardPurchaseRecord,
  MembershipCatalogSettingsRecord,
  MembershipCardRecord,
  MembershipFreeDayPassEligibilityRecord,
  GrantFreeDayPassResponse,
  MembershipAccessCandidateRecord,
  MembershipAccessCandidatesParams,
  MembershipOnsiteSaleCandidateRecord,
  MembershipOnsiteSaleCandidatesParams,
  ManualMembershipPaymentInput,
  MembershipCheckoutRecord,
  MembershipOperationsDashboardRecord,
  MembershipPaymentDetailsRecord,
  MembershipPaymentHistoryParams,
  MembershipPaymentRecord,
  MembershipPaymentReviewFilters,
  MembershipPlanListParams,
  MembershipPlanRecord,
  MembershipSubscriptionRecord,
  PaginatedResult,
  PurchaseMembershipCardInput,
  RecordCashMembershipInput,
  RecordCashMembershipResponse,
  RevokeMembershipSubscriptionInput,
  RevokeMembershipSubscriptionResponse,
  RevokeFreeDayPassInput,
  RevokeFreeDayPassResponse,
  SubscribeToMembershipInput,
  UpdateMembershipCatalogSettingsInput,
  UpdateMembershipPlanInput,
  VerifyMembershipPaymentInput
} from "@fittrack/types";
import { ApiClientError } from "../errors/api-client-error";
import { unwrapPaginatedResponse, unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";
import {
  mapCommerceCheckoutAttempt,
  type CommerceCheckoutApiRecord,
  type CommerceCheckoutAttempt,
} from "./commerce-checkout";

export type {
  CancelMembershipInput,
  CreateMembershipPlanInput,
  MembershipCardPurchaseRecord,
  MembershipCatalogSettingsRecord,
  ManualMembershipPaymentInput,
  MembershipFreeDayPassEligibilityRecord,
  GrantFreeDayPassResponse,
  MembershipAccessCandidateRecord,
  MembershipAccessCandidatesParams,
  MembershipOnsiteSaleCandidateRecord,
  MembershipOnsiteSaleCandidatesParams,
  MembershipCheckoutRecord,
  MembershipOperationsDashboardRecord,
  MembershipPaymentDetailsRecord,
  MembershipPaymentHistoryParams,
  MembershipPaymentRecord,
  MembershipPaymentReviewFilters,
  MembershipPlanListParams,
  MembershipPlanRecord,
  MembershipSubscriptionRecord,
  PaginatedResult,
  PurchaseMembershipCardInput,
  RecordCashMembershipInput,
  RecordCashMembershipResponse,
  RevokeMembershipSubscriptionInput,
  RevokeMembershipSubscriptionResponse,
  RevokeFreeDayPassInput,
  RevokeFreeDayPassResponse,
  SubscribeToMembershipInput,
  UpdateMembershipCatalogSettingsInput,
  UpdateMembershipPlanInput,
  VerifyMembershipPaymentInput
} from "@fittrack/types";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toPaginationParams(params?: MembershipPlanListParams) {
  return {
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {})
  };
}

function toPaymentHistoryParams(params?: MembershipPaymentHistoryParams) {
  return {
    ...toPaginationParams(params),
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {})
  };
}

function toReviewFilterParams(filters?: MembershipPaymentReviewFilters) {
  return {
    ...toPaginationParams(filters),
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.payableType ? { payable_type: filters.payableType } : {})
  };
}

function toSubscribeRequest(payload: SubscribeToMembershipInput) {
  return {
    plan_id: payload.planId,
    provider: payload.provider,
    ...(payload.returnTarget ? { return_target: payload.returnTarget } : {}),
    ...(payload.returnUrl ? { return_url: payload.returnUrl } : {}),
  };
}

function toOnsiteSaleCandidatesParams(
  params: MembershipOnsiteSaleCandidatesParams,
) {
  return {
    action: params.action,
    purchase_type: params.purchaseType,
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
  };
}

function toMembershipAccessCandidatesParams(
  params: MembershipAccessCandidatesParams,
) {
  return {
    action: params.action,
    product: params.product,
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
  };
}

function toPlanMutationRequest(
  payload: CreateMembershipPlanInput | UpdateMembershipPlanInput
) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.durationDays !== undefined ? { duration_days: payload.durationDays } : {}),
    ...(payload.features !== undefined ? { features: payload.features } : {}),
    ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
    ...("isActive" in payload && payload.isActive !== undefined
      ? { is_active: payload.isActive }
      : {})
  };
}

type RawMembershipCardRecord = MembershipCardRecord & {
  activated_at?: string | null;
  purchased_at?: string | null;
  revoke_reason?: string | null;
  revoked_at?: string | null;
  updated_at?: string | null;
  verified_at?: string | null;
};

type RawMembershipSubscriptionRecord = MembershipSubscriptionRecord & {
  plan_name_snapshot?: string | null;
  plan_description_snapshot?: string | null;
  plan_price_snapshot?: string | null;
  plan_currency_snapshot?: string | null;
  duration_days_snapshot?: number | null;
  access_consumed_at?: string | null;
};

type RawMembershipOnsiteSaleCandidateRecord = {
  member_id: string;
  display_name: string;
  email: string | null;
  membership_card_status: MembershipCardRecord["status"] | null;
  subscription_id: string | null;
  subscription_status: MembershipSubscriptionRecord["status"] | null;
  plan_name: string | null;
  starts_at: string | null;
  expires_at: string | null;
};

type RawMembershipAccessCandidateRecord = RawMembershipOnsiteSaleCandidateRecord & {
  free_pass_expires_at: string | null;
};

type RawFreeDayPassLifecycleResponse = {
  message: string;
  member_id: string;
  granted_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
};

type RawRevokeMembershipSubscriptionResponse = {
  message: string;
  subscription: RawMembershipSubscriptionRecord;
};

type MembershipOperationsDashboardItemApiRecord = {
  expires_at: string | null;
  id: string;
  member_name: string;
  plan_name: string;
  starts_at: string | null;
  status: MembershipOperationsDashboardRecord["recentlyActivated"][number]["status"];
  user_id: string;
};

type MembershipOperationsDashboardApiRecord = {
  expiring_membership_count: number;
  expiring_memberships: MembershipOperationsDashboardItemApiRecord[];
  generated_at: string;
  recently_activated: MembershipOperationsDashboardItemApiRecord[];
  recently_activated_count: number;
  total_active_members_count: number;
};

function normalizeMembershipCard(record: RawMembershipCardRecord | null | undefined): MembershipCardRecord {
  return {
    activatedAt: record?.activatedAt ?? record?.activated_at ?? null,
    purchasedAt: record?.purchasedAt ?? record?.purchased_at ?? null,
    revokeReason: record?.revokeReason ?? record?.revoke_reason ?? null,
    revokedAt: record?.revokedAt ?? record?.revoked_at ?? null,
    source: record?.source ?? null,
    status: record?.status ?? "none",
    updatedAt: record?.updatedAt ?? record?.updated_at ?? null,
    verifiedAt: record?.verifiedAt ?? record?.verified_at ?? null
  };
}

function mapOperationsDashboardItem(
  record: MembershipOperationsDashboardItemApiRecord
): MembershipOperationsDashboardRecord["recentlyActivated"][number] {
  return {
    expiresAt: record.expires_at,
    id: record.id,
    memberName: record.member_name,
    planName: record.plan_name,
    startsAt: record.starts_at,
    status: record.status,
    userId: record.user_id
  };
}

function mapOperationsDashboard(
  record: MembershipOperationsDashboardApiRecord
): MembershipOperationsDashboardRecord {
  return {
    expiringMembershipCount: record.expiring_membership_count,
    expiringMemberships: record.expiring_memberships.map(mapOperationsDashboardItem),
    generatedAt: record.generated_at,
    recentlyActivated: record.recently_activated.map(mapOperationsDashboardItem),
    recentlyActivatedCount: record.recently_activated_count,
    totalActiveMembersCount: record.total_active_members_count
  };
}

function toPurchaseMembershipCardRequest(payload: PurchaseMembershipCardInput) {
  return {
    provider: payload.provider,
    ...(payload.returnTarget ? { return_target: payload.returnTarget } : {}),
    ...(payload.returnUrl ? { return_url: payload.returnUrl } : {}),
  };
}

function mapOnsiteSaleCandidate(
  record: RawMembershipOnsiteSaleCandidateRecord,
): MembershipOnsiteSaleCandidateRecord {
  return {
    memberId: record.member_id,
    displayName: record.display_name,
    email: record.email,
    membershipCardStatus: record.membership_card_status,
    subscriptionId: record.subscription_id,
    subscriptionStatus: record.subscription_status,
    planName: record.plan_name,
    startsAt: record.starts_at,
    expiresAt: record.expires_at,
  };
}

function mapMembershipAccessCandidate(
  record: RawMembershipAccessCandidateRecord,
): MembershipAccessCandidateRecord {
  return {
    memberId: record.member_id,
    displayName: record.display_name,
    email: record.email,
    membershipCardStatus: record.membership_card_status,
    subscriptionId: record.subscription_id,
    subscriptionStatus: record.subscription_status,
    planName: record.plan_name,
    startsAt: record.starts_at,
    expiresAt: record.expires_at,
    freePassExpiresAt: record.free_pass_expires_at ?? null,
  };
}

function mapFreeDayPassLifecycle(
  record: RawFreeDayPassLifecycleResponse,
): GrantFreeDayPassResponse {
  return {
    message: record.message,
    memberId: record.member_id,
    grantedAt: record.granted_at,
    expiresAt: record.expires_at,
    redeemedAt: record.redeemed_at,
    revokedAt: record.revoked_at,
    revokeReason: record.revoke_reason,
  };
}

function normalizeMembershipSubscription(
  record: RawMembershipSubscriptionRecord | null,
): MembershipSubscriptionRecord | null {
  if (!record) return null;
  const snapshotName = record.plan_name_snapshot ?? record.plan?.name;
  const snapshotDescription = record.plan_description_snapshot ?? record.plan?.description;
  const snapshotPrice = record.plan_price_snapshot ?? record.plan?.price;
  const snapshotCurrency = record.plan_currency_snapshot ?? record.plan?.currency;
  const snapshotDuration = record.duration_days_snapshot ?? record.plan?.duration_days;
  return {
    ...record,
    plan: record.plan
      ? {
          ...record.plan,
          ...(snapshotName !== undefined ? { name: snapshotName } : {}),
          ...(snapshotDescription !== undefined ? { description: snapshotDescription } : {}),
          ...(snapshotPrice !== undefined ? { price: snapshotPrice } : {}),
          ...(snapshotCurrency !== undefined ? { currency: snapshotCurrency } : {}),
          ...(snapshotDuration !== undefined ? { duration_days: snapshotDuration } : {}),
        }
      : record.plan,
  };
}

function toCancelRequest(payload?: CancelMembershipInput) {
  return payload?.reason ? { reason: payload.reason } : {};
}

function toManualPaymentRequest(payload: ManualMembershipPaymentInput) {
  return {
    payable_type: payload.payableType,
    payable_id: payload.payableId,
    payment_stage: payload.paymentStage,
    amount: payload.amount,
    screenshot_url: payload.screenshotUrl,
    reference_no: payload.referenceNo
  };
}

function toVerifyPaymentRequest(payload: VerifyMembershipPaymentInput) {
  return {
    action: payload.action,
    ...(payload.rejectionReason ? { rejection_reason: payload.rejectionReason } : {})
  };
}

function normalizeMembershipCardPurchaseResponse(payload: {
  checkout_url?: string | null;
  membership_card: RawMembershipCardRecord;
  message: string;
  payment: MembershipPaymentRecord;
}): MembershipCardPurchaseRecord {
  return {
    checkoutUrl: payload.checkout_url ?? null,
    membershipCard: normalizeMembershipCard(payload.membership_card),
    message: payload.message,
    payment: payload.payment
  };
}

function toCatalogSettingsRequest(payload: UpdateMembershipCatalogSettingsInput) {
  return {
    membership_card_price: payload.membershipCardPrice,
  };
}

export function createMembershipApi(transport: ApiTransport) {
  return {
    getCatalogSettings() {
      return unwrapResponse<MembershipCatalogSettingsRecord>(
        transport.get("/membership/catalog-settings"),
        "Unable to load membership catalog settings."
      );
    },
    listPlans(params?: MembershipPlanListParams): Promise<PaginatedResult<MembershipPlanRecord>> {
      return unwrapPaginatedResponse<MembershipPlanRecord>(
        transport.get("/membership/plans", { params: toPaginationParams(params) }),
        "Unable to load membership plans."
      );
    },
    getPlanById(planId: string) {
      return unwrapResponse<MembershipPlanRecord>(
        transport.get(`/membership/plans/${planId}`),
        "Unable to load membership plan."
      );
    },
    getOperationsDashboard() {
      return unwrapResponse<MembershipOperationsDashboardApiRecord>(
        transport.get("/membership/operations-dashboard"),
        "Unable to load membership operations dashboard."
      ).then(mapOperationsDashboard);
    },
    createPlan(payload: CreateMembershipPlanInput) {
      return unwrapResponse<MembershipPlanRecord>(
        transport.post("/membership/plans", toPlanMutationRequest(payload)),
        "Unable to create membership plan."
      );
    },
    updatePlan(planId: string, payload: UpdateMembershipPlanInput) {
      return unwrapResponse<MembershipPlanRecord>(
        transport.patch(`/membership/plans/${planId}`, toPlanMutationRequest(payload)),
        "Unable to update membership plan."
      );
    },
    deletePlan(planId: string) {
      return unwrapVoidResponse(
        transport.delete("/membership/plans/" + planId),
        "Unable to delete membership plan."
      );
    },
    listManagementPlans(params?: MembershipPlanListParams): Promise<PaginatedResult<MembershipPlanRecord>> {
      return unwrapPaginatedResponse<MembershipPlanRecord>(
        transport.get("/membership/plans/management", { params: toPaginationParams(params) }),
        "Unable to load membership plan management catalog."
      );
    },
    updateCatalogSettings(payload: UpdateMembershipCatalogSettingsInput) {
      return unwrapResponse<MembershipCatalogSettingsRecord>(
        transport.patch("/membership/catalog-settings", toCatalogSettingsRequest(payload)),
        "Unable to update membership catalog settings."
      );
    },
    async getCurrentSubscription(): Promise<MembershipSubscriptionRecord | null> {
      try {
        const record = await unwrapResponse<RawMembershipSubscriptionRecord>(
          transport.get("/membership/my-subscription"),
          "Unable to load current subscription."
        );
        return normalizeMembershipSubscription(record);
      } catch (error: unknown) {
        if (error instanceof ApiClientError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    getFreeDayPassEligibility(): Promise<MembershipFreeDayPassEligibilityRecord> {
      return unwrapResponse<MembershipFreeDayPassEligibilityRecord>(
        transport.get("/membership/free-day-pass-eligibility"),
        "Unable to load free-day-pass eligibility."
      );
    },
    subscribe(payload: SubscribeToMembershipInput): Promise<CommerceCheckoutAttempt> {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.post("/membership/subscribe", toSubscribeRequest(payload), {
          headers: {
            "Idempotency-Key": payload.idempotencyKey ?? createIdempotencyKey()
          }
        }),
        "Unable to start membership checkout."
      ).then(mapCommerceCheckoutAttempt);
    },
    recordCashMembership(
      payload: RecordCashMembershipInput,
    ): Promise<RecordCashMembershipResponse> {
      return unwrapResponse<RecordCashMembershipResponse>(
        transport.post(
          "/membership/onsite-sale",
          {
            member_id: payload.memberId,
            purchase_type: payload.purchaseType,
            ...(payload.planId ? { plan_id: payload.planId } : {}),
          },
          {
            headers: {
              "Idempotency-Key": payload.idempotencyKey ?? createIdempotencyKey(),
            },
          },
        ),
        "Unable to record the cash membership sale."
      ).then((result) => ({
        ...result,
        subscription: normalizeMembershipSubscription(result.subscription),
      }));
    },
    listOnsiteSaleCandidates(
      params: MembershipOnsiteSaleCandidatesParams,
    ): Promise<MembershipOnsiteSaleCandidateRecord[]> {
      return unwrapResponse<RawMembershipOnsiteSaleCandidateRecord[]>(
        transport.get("/membership/onsite-sale/candidates", {
          params: toOnsiteSaleCandidatesParams(params),
        }),
        "Unable to load eligible onsite membership candidates."
      ).then((records) => records.map(mapOnsiteSaleCandidate));
    },
    listMembershipAccessCandidates(
      params: MembershipAccessCandidatesParams,
    ): Promise<MembershipAccessCandidateRecord[]> {
      return unwrapResponse<RawMembershipAccessCandidateRecord[]>(
        transport.get("/membership/access-management/candidates", {
          params: toMembershipAccessCandidatesParams(params),
        }),
        "Unable to load eligible membership access candidates."
      ).then((records) => records.map(mapMembershipAccessCandidate));
    },
    grantFreeDayPass(memberId: string): Promise<GrantFreeDayPassResponse> {
      return unwrapResponse<RawFreeDayPassLifecycleResponse>(
        transport.post(
          "/membership/access-management/free-day-pass/grant",
          { member_id: memberId },
        ),
        "Unable to grant the free one-day pass."
      ).then(mapFreeDayPassLifecycle);
    },
    revokeFreeDayPass(
      memberId: string,
      payload: RevokeFreeDayPassInput,
    ): Promise<RevokeFreeDayPassResponse> {
      return unwrapResponse<RawFreeDayPassLifecycleResponse>(
        transport.patch(
          `/membership/access-management/free-day-pass/${memberId}/revoke`,
          { reason: payload.reason.trim() },
        ),
        "Unable to revoke the free one-day pass."
      ).then(mapFreeDayPassLifecycle);
    },
    revokeMembershipSubscription(
      subscriptionId: string,
      payload?: RevokeMembershipSubscriptionInput,
    ): Promise<RevokeMembershipSubscriptionResponse> {
      return unwrapResponse<RawRevokeMembershipSubscriptionResponse>(
        transport.patch(
          `/membership/subscriptions/${subscriptionId}/revoke`,
          payload?.reason?.trim() ? { reason: payload.reason.trim() } : {},
        ),
        "Unable to revoke Gym Membership access."
      ).then((result) => {
        const subscription = normalizeMembershipSubscription(result.subscription);
        if (!subscription) {
          throw new Error("Membership revoke response did not include a subscription.");
        }
        return { message: result.message, subscription };
      });
    },
    purchaseMembershipCard(payload: PurchaseMembershipCardInput): Promise<CommerceCheckoutAttempt> {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.post(
          "/membership/card/purchase",
          toPurchaseMembershipCardRequest(payload),
          {
            headers: {
              "Idempotency-Key": payload.idempotencyKey ?? createIdempotencyKey()
            }
          }
        ),
        "Unable to start membership-card purchase."
      ).then(mapCommerceCheckoutAttempt);
    },
    cancelSubscription(payload?: CancelMembershipInput) {
      return unwrapVoidResponse(
        transport.post("/membership/cancel", toCancelRequest(payload)),
        "Unable to cancel membership."
      );
    },
    listMyPayments(
      params?: MembershipPaymentHistoryParams
    ): Promise<PaginatedResult<MembershipPaymentRecord>> {
      return unwrapPaginatedResponse<MembershipPaymentRecord>(
        transport.get("/payments/my", { params: toPaymentHistoryParams(params) }),
        "Unable to load payment history."
      );
    },
    listPayments(
      filters?: MembershipPaymentReviewFilters
    ): Promise<PaginatedResult<MembershipPaymentDetailsRecord>> {
      return unwrapPaginatedResponse<MembershipPaymentDetailsRecord>(
        transport.get("/payments", { params: toReviewFilterParams(filters) }),
        "Unable to load membership payments."
      );
    },
    getPaymentById(paymentId: string) {
      return unwrapResponse<MembershipPaymentDetailsRecord>(
        transport.get(`/payments/${paymentId}`),
        "Unable to load payment."
      );
    },
    submitManualPayment(payload: ManualMembershipPaymentInput) {
      return unwrapResponse<MembershipPaymentRecord>(
        transport.post("/payments/manual", toManualPaymentRequest(payload)),
        "Unable to submit manual payment."
      );
    },
    verifyPayment(paymentId: string, payload: VerifyMembershipPaymentInput) {
      return unwrapVoidResponse(
        transport.patch(`/payments/${paymentId}/verify`, toVerifyPaymentRequest(payload)),
        "Unable to verify membership payment."
      );
    }
  };
}
