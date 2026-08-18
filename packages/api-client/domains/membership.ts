import type {
  CancelMembershipInput,
  CreateMembershipPlanInput,
  MembershipCardPurchaseRecord,
  MembershipCatalogSettingsRecord,
  MembershipCardRecord,
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
    ...(payload.includesCoaching !== undefined
      ? { includes_coaching: payload.includesCoaching }
      : {}),
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
    updateCatalogSettings(payload: UpdateMembershipCatalogSettingsInput) {
      return unwrapResponse<MembershipCatalogSettingsRecord>(
        transport.patch("/membership/catalog-settings", toCatalogSettingsRequest(payload)),
        "Unable to update membership catalog settings."
      );
    },
    async getCurrentSubscription(): Promise<MembershipSubscriptionRecord | null> {
      try {
        return await unwrapResponse<MembershipSubscriptionRecord>(
          transport.get("/membership/my-subscription"),
          "Unable to load current subscription."
        );
      } catch (error: unknown) {
        if (error instanceof ApiClientError && error.status === 404) {
          return null;
        }
        throw error;
      }
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
