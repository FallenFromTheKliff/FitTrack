import assert from "node:assert/strict";
import test from "node:test";

import { createCommerceCheckoutApi } from "./commerce-checkout";

test("cancels a checkout hold through the additive endpoint and maps its status", async () => {
  const calls: string[] = [];
  const transport = {
    post: async (path: string) => {
      calls.push(path);
      return {
        data: {
          appointment_id: null,
          checkout_url: "https://checkout.paymongo.com/cs_cancel",
          expires_at: "2026-09-10T12:15:00.000Z",
          failure_reason: "Checkout cancelled by member.",
          hold_id: "hold-cancel-1",
          kind: "one_time",
          payment_id: "payment-cancel-1",
          status: "released",
        },
      };
    },
  };

  const result = await createCommerceCheckoutApi(transport as never).cancelHold(
    "hold-cancel-1",
  );

  assert.deepEqual(calls, ["/payments/checkout-holds/hold-cancel-1/cancel"]);
  assert.deepEqual(result, {
    appointmentId: null,
    bookingId: null,
    checkoutUrl: "https://checkout.paymongo.com/cs_cancel",
    expiresAt: "2026-09-10T12:15:00.000Z",
    failureReason: "Checkout cancelled by member.",
    holdId: "hold-cancel-1",
    kind: "one_time",
    membershipCardId: null,
    paymentId: "payment-cancel-1",
    recurringPlanId: null,
    state: "failed",
    status: "failed",
    subscriptionId: null,
  });
});
