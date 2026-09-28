import {
  formatCommerceCheckoutCountdown,
  getCommerceCheckoutRemainingSeconds,
  isCommerceCheckoutTerminalState,
  mergeCommerceCheckoutAttempt,
} from "./checkoutRecovery.ts";

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const initialAttempt = {
  appointmentId: "appointment-1",
  bookingId: null,
  checkoutUrl: "https://checkout.example/hold-1",
  expiresAt: "2026-09-10T12:15:00.000Z",
  failureReason: null,
  holdId: "hold-1",
  kind: "one_time",
  membershipCardId: null,
  paymentId: null,
  recurringPlanId: null,
  state: "pending",
  status: "pending",
  subscriptionId: null,
};

const refreshedAttempt = {
  ...initialAttempt,
  checkoutUrl: null,
  expiresAt: "2026-09-10T12:14:58.000Z",
};

assertEqual(
  mergeCommerceCheckoutAttempt(initialAttempt, refreshedAttempt).checkoutUrl,
  initialAttempt.checkoutUrl,
  "status refresh retains the original checkout URL",
);
assertEqual(
  getCommerceCheckoutRemainingSeconds(
    initialAttempt.expiresAt,
    Date.parse("2026-09-10T12:14:01.000Z"),
  ),
  59,
  "countdown is derived from the server expiry",
);
assertEqual(
  getCommerceCheckoutRemainingSeconds(
    initialAttempt.expiresAt,
    Date.parse("2026-09-10T12:16:00.000Z"),
  ),
  0,
  "countdown clamps at zero without changing checkout state",
);
assertEqual(
  formatCommerceCheckoutCountdown(0),
  "00:00",
  "zero countdown is readable",
);
assertEqual(
  formatCommerceCheckoutCountdown(125),
  "02:05",
  "countdown formats minutes and seconds",
);
assertEqual(
  isCommerceCheckoutTerminalState("succeeded"),
  true,
  "succeeded is terminal",
);
assertEqual(
  isCommerceCheckoutTerminalState("pending"),
  false,
  "pending remains recoverable",
);
