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

export type CheckoutReturnAction = {
  href: string;
  label: string;
};

export function selectLatestCheckoutAttempt<T extends { state?: string }>(
  reconciledAttempt: T | null | undefined,
  polledAttempt: T | null | undefined,
): T | null | undefined {
  return reconciledAttempt?.state === "pending"
    ? (polledAttempt ?? reconciledAttempt)
    : (reconciledAttempt ?? polledAttempt);
}

export function resolveCompletedCheckoutReturnAction(
  baseAction: CheckoutReturnAction,
  state: string | null | undefined,
  attempt?: { bookingId?: string | null; kind?: string | null } | null,
): CheckoutReturnAction {
  if (
    state === "succeeded" &&
    (attempt?.kind === "venue" || Boolean(attempt?.bookingId))
  ) {
    return { href: "/bookings", label: "Return to Bookings" };
  }

  return baseAction;
}

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

type CheckoutHistoryTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener"
> & {
  history: Pick<History, "pushState" | "replaceState">;
  location: Pick<Location, "hash" | "pathname" | "search">;
};

export function installCompletedCheckoutHistoryGuard(
  target: CheckoutHistoryTarget = window,
) {
  const terminalUrl = `${target.location.pathname}${target.location.search}${target.location.hash}`;
  const terminalState = { fittrackCompletedCheckout: true };

  target.history.replaceState(terminalState, "", terminalUrl);
  target.history.pushState(terminalState, "", terminalUrl);

  const keepCheckoutTerminal = () => {
    target.history.pushState(terminalState, "", terminalUrl);
  };
  target.addEventListener("popstate", keepCheckoutTerminal);

  return () => {
    target.removeEventListener("popstate", keepCheckoutTerminal);
  };
}
