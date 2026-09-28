import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse } from "../request";

export type CommerceCheckoutKind =
  | "one_time"
  | "monthly"
  | "venue"
  | "subscription"
  | "membership_card";

export type CommerceCheckoutReturnTarget = "web" | "expo_web" | "mobile";

export type CommerceCheckoutFlow =
  | "membership-card"
  | "membership-subscription"
  | "coach-single"
  | "coach-monthly"
  | "venue-booking";

export type CommerceCheckoutReturnInput = {
  returnTarget?: CommerceCheckoutReturnTarget;
  returnUrl?: string;
};

export type CommerceCheckoutHoldState =
  | "pending"
  | "succeeded"
  | "expired"
  | "failed";

export type CommerceCheckoutAttempt = {
  appointmentId: string | null;
  bookingId: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  failureReason: string | null;
  holdId: string;
  kind: CommerceCheckoutKind;
  membershipCardId: string | null;
  paymentId: string | null;
  recurringPlanId: string | null;
  state: CommerceCheckoutHoldState;
  status: CommerceCheckoutHoldState;
  subscriptionId: string | null;
};

export type CommerceCheckoutApiRecord = {
  appointment_id?: string | null;
  booking_id?: string | null;
  checkout_url?: string | null;
  expires_at: string;
  failure_reason?: string | null;
  hold_id: string;
  kind: CommerceCheckoutKind;
  membership_card_id?: string | null;
  payment_id?: string | null;
  recurring_plan_id?: string | null;
  state?: CommerceCheckoutHoldState;
  status?:
    | CommerceCheckoutHoldState
    | "held"
    | "consumed"
    | "released";
  subscription_id?: string | null;
};

function normalizeState(
  state: CommerceCheckoutApiRecord["state"],
  status: CommerceCheckoutApiRecord["status"],
): CommerceCheckoutHoldState {
  if (state) return state;

  switch (status) {
    case "consumed":
    case "succeeded":
      return "succeeded";
    case "expired":
      return "expired";
    case "failed":
    case "released":
      return "failed";
    case "held":
    case "pending":
    default:
      return "pending";
  }
}

export function mapCommerceCheckoutAttempt(
  record: CommerceCheckoutApiRecord,
): CommerceCheckoutAttempt {
  const state = normalizeState(record.state, record.status);

  return {
    appointmentId: record.appointment_id ?? null,
    bookingId: record.booking_id ?? null,
    checkoutUrl: record.checkout_url ?? null,
    expiresAt: record.expires_at,
    failureReason: record.failure_reason ?? null,
    holdId: record.hold_id,
    kind: record.kind,
    membershipCardId: record.membership_card_id ?? null,
    paymentId: record.payment_id ?? null,
    recurringPlanId: record.recurring_plan_id ?? null,
    state,
    status: state,
    subscriptionId: record.subscription_id ?? null,
  };
}

export function createCommerceCheckoutApi(transport: ApiTransport) {
  return {
    getHoldStatus(holdId: string) {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.get(`/payments/checkout-holds/${holdId}`),
        "Unable to load checkout status.",
      ).then(mapCommerceCheckoutAttempt);
    },
    reconcileHold(holdId: string) {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.post(`/payments/checkout-holds/${holdId}/reconcile`),
        "Unable to verify checkout status with PayMongo.",
      ).then(mapCommerceCheckoutAttempt);
    },
    cancelHold(holdId: string) {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.post(`/payments/checkout-holds/${holdId}/cancel`),
        "Unable to cancel checkout.",
      ).then(mapCommerceCheckoutAttempt);
    },
  };
}
