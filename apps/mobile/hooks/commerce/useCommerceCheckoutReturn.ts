import { useEffect, useRef, useState } from "react";

import type {
  CommerceCheckoutAttempt,
  CommerceCheckoutHoldState,
} from "@fittrack/api-client";

import { mobileApiClient } from "@/lib/api-client";

type CheckoutTerminalState = Exclude<
  CommerceCheckoutHoldState,
  "pending"
>;

type Props = {
  onSucceeded?: (attempt: CommerceCheckoutAttempt) => void | Promise<void>;
  onTerminal?: (
    attempt: CommerceCheckoutAttempt,
    state: CheckoutTerminalState,
  ) => void | Promise<void>;
  pollIntervalMs?: number;
};

export function createCommerceAttemptIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

/**
 * Keeps a PayMongo attempt alive while the user returns from the external
 * checkout page. The UI never treats the hold as a confirmed product record;
 * only a terminal hold state is handed back to the caller.
 */
export function useCommerceCheckoutReturn({
  onSucceeded,
  onTerminal,
  pollIntervalMs = 2500,
}: Props = {}) {
  const [attempt, setAttempt] = useState<CommerceCheckoutAttempt | null>(null);
  const [state, setState] = useState<CommerceCheckoutHoldState | "idle">(
    "idle",
  );
  const onSucceededRef = useRef(onSucceeded);
  const onTerminalRef = useRef(onTerminal);

  onSucceededRef.current = onSucceeded;
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (!attempt?.holdId) return;

    let disposed = false;
    let requestInFlight = false;
    let handled = false;

    const poll = async () => {
      if (disposed || requestInFlight || handled) return;
      requestInFlight = true;
      try {
        const next = await mobileApiClient.commerceCheckout.getHoldStatus(
          attempt.holdId,
        );
        if (disposed) return;

        setState(next.state);
        if (next.state === "pending") return;

        handled = true;
        if (next.state === "succeeded") {
          await onSucceededRef.current?.(next);
        } else {
          await onTerminalRef.current?.(next, next.state);
        }
        if (!disposed) setAttempt(null);
      } catch {
        // A transient return-page/network error is retried on the next tick.
        if (!disposed) setState("pending");
      } finally {
        requestInFlight = false;
      }
    };

    setState("pending");
    void poll();
    const timer = setInterval(() => void poll(), pollIntervalMs);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [attempt?.holdId, pollIntervalMs]);

  const start = (next: CommerceCheckoutAttempt) => {
    setState("pending");
    setAttempt(next);
  };

  const clear = () => {
    setAttempt(null);
    setState("idle");
  };

  return { attempt, clear, start, state };
}
