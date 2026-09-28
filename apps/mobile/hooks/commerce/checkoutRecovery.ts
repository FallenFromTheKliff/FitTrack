import type {
  CommerceCheckoutAttempt,
  CommerceCheckoutHoldState,
} from "@fittrack/api-client";

export const CHECKOUT_TERMINAL_STATES: ReadonlySet<CommerceCheckoutHoldState> =
  new Set(["succeeded", "expired", "failed"]);

export function isCommerceCheckoutTerminalState(
  state: CommerceCheckoutHoldState,
): state is Exclude<CommerceCheckoutHoldState, "pending"> {
  return CHECKOUT_TERMINAL_STATES.has(state);
}

/**
 * A status response may omit its checkout URL after the initial hold creation.
 * Keep the original provider URL available so Resume payment can reopen the
 * same session without creating another one.
 */
export function mergeCommerceCheckoutAttempt(
  previous: CommerceCheckoutAttempt | null,
  next: CommerceCheckoutAttempt,
): CommerceCheckoutAttempt {
  return {
    ...next,
    checkoutUrl: next.checkoutUrl?.trim() || previous?.checkoutUrl || null,
    expiresAt: next.expiresAt || previous?.expiresAt || "",
  };
}

export function getCommerceCheckoutRemainingSeconds(
  expiresAt: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!expiresAt) return null;

  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return null;

  return Math.max(0, Math.ceil((expiry - now) / 1000));
}

export function formatCommerceCheckoutCountdown(
  remainingSeconds: number | null | undefined,
) {
  if (remainingSeconds == null) return "Deadline unavailable";
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getCommerceCheckoutErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}
