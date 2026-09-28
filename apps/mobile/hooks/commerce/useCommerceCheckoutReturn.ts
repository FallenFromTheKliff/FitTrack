import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import type {
  CommerceCheckoutAttempt,
  CommerceCheckoutHoldState,
} from "@fittrack/api-client";

import { mobileApiClient } from "@/lib/api-client";
import {
  getCommerceCheckoutErrorMessage,
  getCommerceCheckoutRemainingSeconds,
  isCommerceCheckoutTerminalState,
  mergeCommerceCheckoutAttempt,
} from "./checkoutRecovery";
import { useBookingCheckoutRecoveryScope } from "@/contexts/BookingCheckoutRecoveryContext";
import type { BookingCheckoutRecoveryScope } from "@/contexts/bookingCheckoutRecoveryScope";

type CheckoutReturnRoute = "bookings" | "profile";

export type CheckoutRecoveryScope = "booking";

export type CheckoutRecoveryOperation =
  | "checking"
  | "reconciling"
  | "cancelling"
  | null;

export function resolveCheckoutReturnInput(route: CheckoutReturnRoute) {
  if (Platform.OS !== "web") {
    return {
      returnTarget: "mobile" as const,
    };
  }

  const origin =
    typeof window !== "undefined" &&
    typeof window.location?.origin === "string" &&
    window.location.origin.length > 0
      ? window.location.origin
      : null;

  if (!origin) {
    return {
      returnTarget: "mobile" as const,
    };
  }

  return {
    returnTarget: "expo_web" as const,
    returnUrl: new URL(`/${route}`, origin).toString(),
  };
}

type CheckoutTerminalState = Exclude<
  CommerceCheckoutHoldState,
  "pending"
>;

type Props = {
  isActive?: boolean;
  onSucceeded?: (attempt: CommerceCheckoutAttempt) => void | Promise<void>;
  onTerminal?: (
    attempt: CommerceCheckoutAttempt,
    state: CheckoutTerminalState,
  ) => void | Promise<void>;
  onCancelled?: (attempt: CommerceCheckoutAttempt) => void | Promise<void>;
  pollIntervalMs?: number;
  sharedScope?: CheckoutRecoveryScope;
};

type OperationKind = Exclude<CheckoutRecoveryOperation, null>;

type OperationRecord = {
  generation: number;
  holdId: string;
  kind: OperationKind;
  version: number;
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
  isActive = true,
  onSucceeded,
  onTerminal,
  onCancelled,
  pollIntervalMs = 2500,
  sharedScope,
}: Props = {}) {
  const bookingScope = useBookingCheckoutRecoveryScope();
  const shared: BookingCheckoutRecoveryScope | null =
    sharedScope === "booking" ? bookingScope : null;
  const tokenRef = useRef<object | null>(null);
  if (!tokenRef.current) tokenRef.current = {};
  const [attempt, setAttempt] = useState<CommerceCheckoutAttempt | null>(
    () => shared?.attempt ?? null,
  );
  const [state, setState] = useState<CommerceCheckoutHoldState | "idle">(
    () => shared?.attempt?.state ?? "idle",
  );
  const [operation, setOperation] =
    useState<CheckoutRecoveryOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    null,
  );
  const onSucceededRef = useRef(onSucceeded);
  const onTerminalRef = useRef(onTerminal);
  const onCancelledRef = useRef(onCancelled);
  const attemptRef = useRef<CommerceCheckoutAttempt | null>(
    shared?.attempt ?? null,
  );
  const generationRef = useRef(0);
  const attemptVersionRef = useRef(0);
  const operationRef = useRef<OperationRecord | null>(null);
  const terminalHandledRef = useRef<string | null>(null);

  const previousSharedScopeRef = useRef<BookingCheckoutRecoveryScope | null>(
    shared,
  );
  if (previousSharedScopeRef.current !== shared) {
    previousSharedScopeRef.current = shared;
    attemptRef.current = shared?.attempt ?? null;
    generationRef.current += 1;
    attemptVersionRef.current += 1;
    operationRef.current = null;
    terminalHandledRef.current = null;
  }
  const activeAttempt = shared ? shared.attempt : attempt;

  onSucceededRef.current = onSucceeded;
  onTerminalRef.current = onTerminal;
  onCancelledRef.current = onCancelled;

  const syncSharedAttempt = useCallback(
    (next: CommerceCheckoutAttempt | null) => {
      attemptRef.current = next;
      setAttempt(next);
      setState(next?.state ?? "idle");
    },
    [],
  );

  const setCurrentAttempt = useCallback(
    (
      next: CommerceCheckoutAttempt | null,
      options?: { silent?: boolean },
    ) => {
      attemptRef.current = next;
      if (!options?.silent) {
        setAttempt(next);
      }
      if (!shared) return;

      shared.attempt = next;
      if (options?.silent) return;
      for (const [token, listener] of shared.listeners) {
        if (token !== tokenRef.current) listener(next);
      }
    },
    [shared],
  );

  useEffect(() => {
    if (!shared || !tokenRef.current) return;
    const token = tokenRef.current;
    shared.listeners.set(token, syncSharedAttempt);
    syncSharedAttempt(shared.attempt);

    return () => {
      shared.listeners.delete(token);
      if (shared.ownerToken === token) shared.ownerToken = null;
    };
  }, [shared, syncSharedAttempt]);

  const isCurrentOperation = useCallback(
    (current: OperationRecord) =>
      !shared?.disposed &&
      attemptRef.current?.holdId === current.holdId &&
      generationRef.current === current.generation &&
      attemptVersionRef.current === current.version,
    [shared],
  );

  const runOperation = useCallback(
    async (kind: OperationKind, silent = false) => {
      const currentAttempt = attemptRef.current;
      if (!currentAttempt || operationRef.current) return false;
      if (shared?.disposed) return false;
      if (shared?.operationToken) return false;

      const current: OperationRecord = {
        generation: generationRef.current,
        holdId: currentAttempt.holdId,
        kind,
        version: attemptVersionRef.current,
      };
      operationRef.current = current;
      if (shared) shared.operationToken = tokenRef.current;
      if (!silent) {
        setOperation(kind);
        setErrorMessage(null);
      }

      try {
        const next =
          kind === "cancelling"
            ? await mobileApiClient.commerceCheckout.cancelHold(current.holdId)
            : kind === "reconciling"
              ? await mobileApiClient.commerceCheckout.reconcileHold(
                  current.holdId,
                )
              : await mobileApiClient.commerceCheckout.getHoldStatus(
                  current.holdId,
                );

        if (!isCurrentOperation(current)) return false;

        const merged = mergeCommerceCheckoutAttempt(
          attemptRef.current,
          next,
        );
        const terminalState = isCommerceCheckoutTerminalState(merged.state)
          ? merged.state
          : null;
        setCurrentAttempt(merged, { silent: silent && !terminalState });
        if (!silent || terminalState) {
          setState(merged.state);
        }

        if (!terminalState) return true;

        const terminalKey = `${current.generation}:${current.version}:${current.holdId}`;
        if (
          shared
            ? shared.terminalHandledKey === terminalKey
            : terminalHandledRef.current === terminalKey
        ) {
          return true;
        }
        if (shared) {
          shared.terminalHandledKey = terminalKey;
        } else {
          terminalHandledRef.current = terminalKey;
        }

        const callbacks = shared?.callbacks ?? {
          onCancelled: onCancelledRef.current,
          onSucceeded: onSucceededRef.current,
          onTerminal: onTerminalRef.current,
        };

        try {
          if (merged.state === "succeeded") {
            await callbacks.onSucceeded?.(merged);
          } else if (kind === "cancelling") {
            await callbacks.onCancelled?.(merged);
          } else {
            await callbacks.onTerminal?.(merged, terminalState);
          }
        } catch {
          // A host notification callback must not turn a confirmed terminal
          // state into a false retryable payment state.
        }

        if (
          isCurrentOperation(current) &&
          attemptRef.current === merged
        ) {
          setCurrentAttempt(null);
          setState(merged.state);
          setRemainingSeconds(null);
          setErrorMessage(null);
          if (shared) shared.callbacks = null;
        }

        return true;
      } catch (error: unknown) {
        if (isCurrentOperation(current) && !silent) {
          setState("pending");
          setErrorMessage(
            getCommerceCheckoutErrorMessage(
              error,
              kind === "cancelling"
                ? "Unable to cancel this checkout yet. It remains locked while FitTrack checks the server."
                : kind === "reconciling"
                  ? "Unable to verify this checkout yet. Try again."
                  : "Unable to load checkout status. Try again.",
            ),
          );
        }
        return false;
      } finally {
        if (operationRef.current === current) {
          operationRef.current = null;
          if (!silent) setOperation(null);
        }
        if (shared?.operationToken === tokenRef.current) {
          shared.operationToken = null;
        }
      }
    },
    [
      isCurrentOperation,
      onCancelledRef,
      onSucceededRef,
      onTerminalRef,
      setCurrentAttempt,
      shared,
    ],
  );

  const checkStatus = useCallback(
    (silent = false) => runOperation("checking", silent),
    [runOperation],
  );
  const reconcile = useCallback(
    () => runOperation("reconciling"),
    [runOperation],
  );
  const cancel = useCallback(
    () => runOperation("cancelling"),
    [runOperation],
  );

  const resume = useCallback(async () => {
    if (shared?.disposed) return false;
    const current = attemptRef.current;
    const checkoutUrl = current?.checkoutUrl?.trim();
    if (!checkoutUrl) {
      setErrorMessage(
        "This checkout link is no longer available. Check status before trying again.",
      );
      return false;
    }

    try {
      await Linking.openURL(checkoutUrl);
      if (attemptRef.current?.holdId === current?.holdId) {
        setErrorMessage(null);
      }
      return true;
    } catch (error: unknown) {
      if (attemptRef.current?.holdId === current?.holdId) {
        setErrorMessage(
          getCommerceCheckoutErrorMessage(
            error,
            "Unable to reopen this checkout. Check your connection and try again.",
          ),
        );
      }
      return false;
    }
  }, [shared]);

  useEffect(() => {
    if (!activeAttempt?.holdId) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(
        getCommerceCheckoutRemainingSeconds(activeAttempt.expiresAt),
      );
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [activeAttempt?.expiresAt, activeAttempt?.holdId]);

  useEffect(() => {
    if (!activeAttempt?.holdId) return;
    if (!isActive) return;
    if (shared?.disposed) return;
    if (
      shared &&
      shared.ownerToken &&
      shared.ownerToken !== tokenRef.current
    ) {
      return;
    }
    if (shared) shared.ownerToken = tokenRef.current;

    setState((current) => (current === "idle" ? "pending" : current));
    void checkStatus(true);
    const timer = setInterval(
      () => void checkStatus(true),
      Math.max(250, pollIntervalMs),
    );

    return () => {
      clearInterval(timer);
      if (shared?.ownerToken === tokenRef.current) {
        shared.ownerToken = null;
      }
    };
  }, [activeAttempt?.holdId, checkStatus, isActive, pollIntervalMs, shared]);

  const visibleAttempt = activeAttempt;
  const visibleOperation = visibleAttempt ? operation : null;
  const visibleErrorMessage = visibleAttempt ? errorMessage : null;
  const visibleRemainingSeconds = visibleAttempt ? remainingSeconds : null;
  const visibleState = visibleAttempt ? state : "idle";

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        isActive &&
        !shared?.disposed &&
        (!shared ||
          !shared.ownerToken ||
          shared.ownerToken === tokenRef.current)
      ) {
        void checkStatus(true);
      }
    });

    return () => subscription.remove();
  }, [checkStatus, isActive, shared]);

  const start = useCallback((next: CommerceCheckoutAttempt) => {
    if (shared?.disposed) return;
    const current = attemptRef.current;
    const isSameHold = current?.holdId === next.holdId;
    if (!isSameHold) {
      generationRef.current += 1;
      terminalHandledRef.current = null;
      if (shared) {
        shared.terminalHandledKey = null;
        shared.callbacks = {
          onCancelled: (attempt) => onCancelledRef.current?.(attempt),
          onSucceeded: (attempt) => onSucceededRef.current?.(attempt),
          onTerminal: (attempt, state) =>
            onTerminalRef.current?.(attempt, state),
        };
      }
    }
    attemptVersionRef.current += 1;

    const merged = mergeCommerceCheckoutAttempt(current, next);
    setCurrentAttempt(merged);
    setState(merged.state);
    setErrorMessage(null);
  }, [onCancelledRef, onSucceededRef, onTerminalRef, setCurrentAttempt, shared]);

  const clear = useCallback(() => {
    generationRef.current += 1;
    attemptVersionRef.current += 1;
    terminalHandledRef.current = null;
    setCurrentAttempt(null);
    setState("idle");
    setOperation(null);
    setErrorMessage(null);
    setRemainingSeconds(null);
    if (shared) {
      shared.callbacks = null;
      shared.terminalHandledKey = null;
    }
  }, [setCurrentAttempt, shared]);

  return {
    attempt: visibleAttempt,
    cancel,
    checkStatus,
    clear,
    errorMessage: visibleErrorMessage,
    isBusy: visibleOperation !== null,
    operation: visibleOperation,
    reconcile,
    remainingSeconds: visibleRemainingSeconds,
    resume,
    start,
    state: visibleState,
  };
}
