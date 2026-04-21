export const PAYMONGO_AVAILABILITY = {
  enabled: false,
  modalBody:
    "Online checkout is temporarily unavailable while the PayMongo integration is deferred. Please try again later or use the gym's manual payment flow if one is offered for this service.",
  modalTitle: "PayMongo is temporarily down"
} as const;

export function isPaymongoCheckoutEnabled() {
  return PAYMONGO_AVAILABILITY.enabled;
}
