import assert from "node:assert/strict";
import test from "node:test";

test("completed checkout history guard keeps browser Back on the terminal FitTrack page", async () => {
  const modulePath = "./commerce-checkout.ts";
  const {
    installCompletedCheckoutHistoryGuard,
    resolveCompletedCheckoutReturnAction,
    selectLatestCheckoutAttempt,
  } = await import(modulePath);
  const calls: Array<["push" | "replace", string]> = [];
  let popstate: (() => void) | undefined;
  const target = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "popstate" && typeof listener === "function") {
        popstate = listener as () => void;
      }
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "popstate" && popstate === listener) popstate = undefined;
    },
    history: {
      pushState: (_state: unknown, _unused: string, url?: string | URL | null) => {
        calls.push(["push", String(url)]);
      },
      replaceState: (_state: unknown, _unused: string, url?: string | URL | null) => {
        calls.push(["replace", String(url)]);
      },
    },
    location: {
      hash: "",
      pathname: "/payments/success",
      search: "?hold_id=hold-1",
    },
  };

  const cleanup = installCompletedCheckoutHistoryGuard(
    target as Parameters<typeof installCompletedCheckoutHistoryGuard>[0],
  );

  assert.deepEqual(calls, [
    ["replace", "/payments/success?hold_id=hold-1"],
    ["push", "/payments/success?hold_id=hold-1"],
  ]);
  assert.ok(popstate);
  (popstate as () => void)();
  assert.deepEqual(calls.at(-1), ["push", "/payments/success?hold_id=hold-1"]);

  cleanup();
  assert.equal(popstate, undefined);

  assert.deepEqual(
    selectLatestCheckoutAttempt(
      { state: "succeeded", bookingId: "booking-1" },
      { state: "pending", bookingId: null },
    ),
    { state: "succeeded", bookingId: "booking-1" },
  );
  assert.deepEqual(
    selectLatestCheckoutAttempt(
      { state: "pending", bookingId: null },
      { state: "succeeded", bookingId: "booking-1" },
    ),
    { state: "succeeded", bookingId: "booking-1" },
  );

  const portalAction = { href: "/dashboard", label: "Return to Web Portal" };
  assert.deepEqual(
    resolveCompletedCheckoutReturnAction(portalAction, "succeeded", {
      bookingId: null,
      kind: "venue",
    }),
    { href: "/bookings", label: "Return to Bookings" },
  );
  assert.deepEqual(
    resolveCompletedCheckoutReturnAction(portalAction, "succeeded", {
      bookingId: "booking-1",
      kind: "coaching_single",
    }),
    { href: "/bookings", label: "Return to Bookings" },
  );
  assert.strictEqual(
    resolveCompletedCheckoutReturnAction(portalAction, "succeeded", {
      bookingId: null,
      kind: "membership_card",
    }),
    portalAction,
  );
  assert.strictEqual(
    resolveCompletedCheckoutReturnAction(portalAction, "pending", {
      bookingId: "booking-1",
      kind: "venue",
    }),
    portalAction,
  );
});
