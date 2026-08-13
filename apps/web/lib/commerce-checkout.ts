export const COMMERCE_CHECKOUT_HOLD_STORAGE_KEY = "fittrack:commerce-checkout-hold";

export type CommerceCheckoutAttemptLike = {
  checkoutUrl?: string | null;
  checkout_url?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  holdId?: string | null;
  hold_id?: string | null;
  kind?: string | null;
};

export type StoredCommerceCheckoutHold = {
  expiresAt?: string | null;
  holdId: string;
  kind?: string | null;
};

export function createClientIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getCommerceCheckoutUrl(attempt?: CommerceCheckoutAttemptLike | null) {
  return attempt?.checkoutUrl ?? attempt?.checkout_url ?? null;
}

export function getCommerceCheckoutHoldId(attempt?: CommerceCheckoutAttemptLike | null) {
  return attempt?.holdId ?? attempt?.hold_id ?? null;
}

export function rememberCommerceCheckoutHold(attempt?: CommerceCheckoutAttemptLike | null) {
  if (typeof window === "undefined") return;

  const holdId = getCommerceCheckoutHoldId(attempt);
  if (!holdId) return;

  window.localStorage.setItem(
    COMMERCE_CHECKOUT_HOLD_STORAGE_KEY,
    JSON.stringify({
      expiresAt: attempt?.expiresAt ?? attempt?.expires_at ?? null,
      holdId,
      kind: attempt?.kind ?? null,
    }),
  );
}

export function readCommerceCheckoutHold(): StoredCommerceCheckoutHold | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(COMMERCE_CHECKOUT_HOLD_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      expiresAt?: string | null;
      holdId?: string | null;
      kind?: string | null;
    };
    return parsed.holdId ? { ...parsed, holdId: parsed.holdId } : null;
  } catch {
    window.localStorage.removeItem(COMMERCE_CHECKOUT_HOLD_STORAGE_KEY);
    return null;
  }
}

export function clearCommerceCheckoutHold(expectedHoldId?: string | null) {
  if (typeof window === "undefined") return;

  const storedHold = readCommerceCheckoutHold();
  if (!expectedHoldId || storedHold?.holdId === expectedHoldId) {
    window.localStorage.removeItem(COMMERCE_CHECKOUT_HOLD_STORAGE_KEY);
  }
}
