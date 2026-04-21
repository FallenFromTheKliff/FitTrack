import type {
  CancelMembershipInput,
  MembershipCardPurchaseRecord,
  MembershipCardRecord,
  ManualMembershipPaymentInput,
  MembershipCheckoutRecord,
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
  VerifyMembershipPaymentInput
} from "@fittrack/types";
import { ApiClientError } from "../errors/api-client-error";
import { unwrapPaginatedResponse, unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  CancelMembershipInput,
  MembershipCardPurchaseRecord,
  ManualMembershipPaymentInput,
  MembershipCheckoutRecord,
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
    provider: payload.provider
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

function toPurchaseMembershipCardRequest(payload: PurchaseMembershipCardInput) {
  return {
    provider: payload.provider
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

export function createMembershipApi(transport: ApiTransport) {
  return {
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
    subscribe(payload: SubscribeToMembershipInput) {
      return unwrapResponse<MembershipCheckoutRecord>(
        transport.post("/membership/subscribe", toSubscribeRequest(payload), {
          headers: {
            "Idempotency-Key": createIdempotencyKey()
          }
        }),
        "Unable to start membership checkout."
      );
    },
    purchaseMembershipCard(payload: PurchaseMembershipCardInput) {
      return unwrapResponse<{
        checkout_url?: string | null;
        membership_card: RawMembershipCardRecord;
        message: string;
        payment: MembershipPaymentRecord;
      }>(
        transport.post(
          "/membership/card/purchase",
          toPurchaseMembershipCardRequest(payload),
          {
            headers: {
              "Idempotency-Key": createIdempotencyKey()
            }
          }
        ),
        "Unable to start membership-card purchase."
      ).then(normalizeMembershipCardPurchaseResponse);
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
