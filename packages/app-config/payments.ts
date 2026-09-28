export const PAYMONGO_AVAILABILITY = {
  enabled: true,
  modalBody:
    "PayMongo checkout is currently unavailable for this action. Please try again in a moment or use the gym's manual payment flow if one is offered for this service.",
  modalTitle: "PayMongo checkout unavailable"
} as const;

export function isPaymongoCheckoutEnabled() {
  return PAYMONGO_AVAILABILITY.enabled;
}
