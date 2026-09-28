import { expect, test, type Page, type Route } from "@playwright/test";

import {
  assertFixtureClosed,
  installMemberResponsiveFixtures,
  newFixtureState,
  type FixtureState,
  MOBILE_RESPONSIVE_BASE_URL,
} from "./mobile-responsive-fixtures";

const HOLD_ID = "checkout-hold-recovery-1";
const CHECKOUT_URL = `https://checkout.example/${HOLD_ID}`;
const APPOINTMENT_COACH_ID = "55555555-5555-4555-8555-555555555555";

type CheckoutState = "pending" | "succeeded" | "expired" | "failed";

type Flow = {
  availabilityFailures: number;
  cancelState: CheckoutState;
  createCount: number;
  expiresAt: string;
  getStatusFailures: number;
  getStatusCount: number;
  statusState: CheckoutState;
  mutations: Array<{ method: string; path: string }>;
  openedUrls: string[];
  reconcileFailures: number;
  reconcileGate?: Promise<void>;
  reconcileState: CheckoutState;
};

function createFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    availabilityFailures: 0,
    cancelState: "failed",
    createCount: 0,
    expiresAt: "2026-09-08T04:15:00.000Z",
    getStatusFailures: 0,
    getStatusCount: 0,
    statusState: "pending",
    mutations: [],
    openedUrls: [],
    reconcileFailures: 0,
    reconcileState: "pending",
    ...overrides,
  };
}

function coachRecord() {
  return {
    average_rating: "4.8",
    availability_slots: [],
    bio: "A focused coaching plan for steady progress.",
    booked_dates: [],
    certification: "Certified Personal Trainer",
    display_name: "Alexandra Recovery Coach",
    hourly_rate: "600",
    id: APPOINTMENT_COACH_ID,
    is_available_for_booking: true,
    monthly_offer_active: false,
    monthly_rate: null,
    monthly_session_count: null,
    monthly_session_duration_minutes: null,
    rating_count: 10,
    schedule_type: "full_time",
    specialties: ["Strength"],
    user: { id: APPOINTMENT_COACH_ID, profile: { first_name: "Alexandra", last_name: "Recovery" } },
  };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin;
  return {
    ...(origin
      ? {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": origin,
        }
      : {}),
    "access-control-allow-headers":
      route.request().headers()["access-control-request-headers"] ??
      "Authorization, Content-Type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

async function handlePreflight(route: Route) {
  if (route.request().method() !== "OPTIONS") return false;
  await route.fulfill({ headers: corsHeaders(route), status: 204 });
  return true;
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    headers: corsHeaders(route),
    status,
  });
}

async function failClosed(route: Route, state: FixtureState) {
  const request = route.request();
  const url = new URL(request.url());
  state.unhandled.push(`${request.method()} ${url.pathname}${url.search}`);
  await route.abort("blockedbyclient");
}

function checkoutAttempt(
  flow: Flow,
  kind: "one_time" | "venue",
  state: CheckoutState,
  includeCheckoutUrl: boolean,
) {
  return {
    appointment_id: kind === "one_time" ? "appointment-recovery-1" : null,
    booking_id: kind === "venue" ? "booking-recovery-1" : null,
    ...(includeCheckoutUrl ? { checkout_url: CHECKOUT_URL } : {}),
    expires_at: flow.expiresAt,
    failure_reason: state === "failed" ? "Checkout cancelled by member." : null,
    hold_id: HOLD_ID,
    kind,
    membership_card_id: null,
    payment_id: state === "succeeded" ? "payment-recovery-1" : null,
    recurring_plan_id: null,
    state,
    status: state,
    subscription_id: null,
  };
}

async function installCheckoutFixtures(
  page: Page,
  surface: "appointment" | "reservation",
  flow: Flow,
) {
  const state = newFixtureState();
  await installMemberResponsiveFixtures(page, state);

  await page.addInitScript(() => {
    const openedUrls: string[] = [];
    const windowWithCheckout = window as Window & {
      __fittrackCheckoutUrls?: string[];
    };
    windowWithCheckout.__fittrackCheckoutUrls = openedUrls;
    window.open = ((url?: string | URL) => {
      if (url) openedUrls.push(String(url));
      return null;
    }) as typeof window.open;
  });
  page.on("popup", (popup) => void popup.close().catch(() => undefined));

  await page.route("**/v1/coaching/coaches**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (await handlePreflight(route)) return;
    if (request.method() !== "GET") {
      await failClosed(route, state);
      return;
    }
    if (url.pathname === "/v1/coaching/coaches") {
      await fulfill(route, [coachRecord()]);
      return;
    }
    const availabilityMatch = url.pathname.match(
      /^\/v1\/coaching\/coaches\/([^/]+)\/availability$/,
    );
    if (availabilityMatch) {
      await fulfill(route, [
        {
          available: true,
          conflict_reasons: [],
          duration_minutes: Number(url.searchParams.get("duration_minutes") ?? "60"),
          end_at: "2026-09-08T14:00:00+08:00",
          start_at: "2026-09-08T13:00:00+08:00",
        },
      ]);
      return;
    }
    const detailMatch = url.pathname.match(/^\/v1\/coaching\/coaches\/([^/]+)$/);
    if (detailMatch && detailMatch[1] === APPOINTMENT_COACH_ID) {
      await fulfill(route, coachRecord());
      return;
    }
    await failClosed(route, state);
  });

  await page.route("**/v1/bookings/amenities/availability**", async (route) => {
    const request = route.request();
    if (await handlePreflight(route)) return;
    if (request.method() !== "GET") {
      await failClosed(route, state);
      return;
    }
    if (flow.availabilityFailures > 0) {
      flow.availabilityFailures -= 1;
      await route.fulfill({
        body: JSON.stringify({
          message: "Availability service is temporarily unavailable.",
        }),
        contentType: "application/json",
        headers: corsHeaders(route),
        status: 500,
      });
      return;
    }
    await fulfill(route, [
      {
        available: true,
        conflict_reasons: [],
        ends_at: "2026-09-08T17:00:00+08:00",
        starts_at: "2026-09-08T16:00:00+08:00",
      },
    ]);
  });

  const handleCreate = async (route: Route, kind: "one_time" | "venue") => {
    if (await handlePreflight(route)) return;
    if (route.request().method() !== "POST") {
      await failClosed(route, state);
      return;
    }
    flow.createCount += 1;
    flow.mutations.push({ method: "POST", path: new URL(route.request().url()).pathname });
    await fulfill(route, checkoutAttempt(flow, kind, "pending", true));
  };

  await page.route("**/v1/coaching/appointments", (route) =>
    handleCreate(route, "one_time"),
  );
  await page.route("**/v1/bookings/amenity", (route) =>
    handleCreate(route, "venue"),
  );

  await page.route("**/v1/payments/checkout-holds/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (await handlePreflight(route)) return;
    const pathMatch = url.pathname.match(
      /^\/v1\/payments\/checkout-holds\/([^/]+)(?:\/(cancel|reconcile))?$/,
    );
    if (!pathMatch || pathMatch[1] !== HOLD_ID) {
      await failClosed(route, state);
      return;
    }

    const action = pathMatch[2];
    if (!action && request.method() === "GET") {
      flow.getStatusCount += 1;
      if (flow.getStatusFailures > 0) {
        flow.getStatusFailures -= 1;
        await route.fulfill({
          body: JSON.stringify({ message: "Status service is temporarily unavailable." }),
          contentType: "application/json",
          headers: corsHeaders(route),
          status: 503,
        });
        return;
      }
      await fulfill(
        route,
        checkoutAttempt(
          flow,
          surface === "appointment" ? "one_time" : "venue",
          flow.statusState,
          false,
        ),
      );
      return;
    }

    if (action === "reconcile" && request.method() === "POST") {
      flow.mutations.push({ method: "POST", path: url.pathname });
      if (flow.reconcileGate) {
        await flow.reconcileGate;
      }
      if (flow.reconcileFailures > 0) {
        flow.reconcileFailures -= 1;
        await route.fulfill({
          body: JSON.stringify({
            message: "Status service is temporarily unavailable.",
          }),
          contentType: "application/json",
          headers: corsHeaders(route),
          status: 503,
        });
        return;
      }
      await fulfill(
        route,
        checkoutAttempt(
          flow,
          surface === "appointment" ? "one_time" : "venue",
          flow.reconcileState,
          false,
        ),
      );
      return;
    }

    if (action === "cancel" && request.method() === "POST") {
      flow.mutations.push({ method: "POST", path: url.pathname });
      await fulfill(
        route,
        checkoutAttempt(
          flow,
          surface === "appointment" ? "one_time" : "venue",
          flow.cancelState,
          false,
        ),
      );
      return;
    }

    await failClosed(route, state);
  });

  return { state };
}

async function openTrainer(page: Page) {
  await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Book a Trainer", exact: true }).click();
  const modal = page.getByTestId("appointment-modal-card");
  await expect(modal).toBeVisible();
  return modal;
}

async function startAppointmentCheckout(page: Page, flow: Flow) {
  const modal = await openTrainer(page);
  await page.getByRole("button", { name: "Alexandra Recovery Coach", exact: true }).click();
  await page.getByRole("button", { name: "Choose date & time", exact: true }).click();
  await page.getByRole("button", { name: /^Select appointment time slot/ }).click();
  await page.getByRole("button", { name: /^0?1:00 PM,/ }).click();
  await page.getByRole("button", { name: "Review & pay", exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "Book and pay in full?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Book & Pay in Full", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "PayMongo checkout opened" })).toBeVisible();
  await page.getByRole("button", { name: "Got It", exact: true }).click();
  await expect(page.getByTestId("checkout-recovery-modal")).toBeVisible();
  expect(flow.createCount).toBe(1);
  return modal;
}

async function startReservationCheckout(page: Page, flow: Flow) {
  await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Make Reservation", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Choose a venue", exact: true }).click();
  const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
  await picker.getByRole("button").filter({ hasText: /PHP/ }).first().click();
  await modal.getByRole("button", { name: /Start time:/ }).click();
  await page.getByRole("dialog").filter({ hasText: "Venue start time" }).getByRole("button", { name: /available$/ }).first().click();
  await modal.getByRole("button", { name: /End time:/ }).click();
  await page.getByRole("dialog").filter({ hasText: "Venue end time" }).getByRole("button", { name: /available$/ }).first().click();
  await modal.getByRole("button", { name: /Pay in full/i, exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "Review and pay in full?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Pay in full", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "PayMongo checkout opened" })).toBeVisible();
  await page.getByRole("button", { name: "Got It", exact: true }).click();
  await expect(page.getByTestId("checkout-recovery-modal")).toBeVisible();
  expect(flow.createCount).toBe(1);
  return modal;
}

async function assertNoFixtureLeaks(
  state: FixtureState,
  allowedConsoleErrors: RegExp[] = [],
) {
  expect(state.unhandled).toEqual([]);
  expect(state.requestFailures).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  const unexpectedConsoleErrors = state.consoleErrors.filter(
    (message) => !allowedConsoleErrors.some((pattern) => pattern.test(message)),
  );
  expect(unexpectedConsoleErrors).toEqual([]);
  assertFixtureClosed({ ...state, consoleErrors: unexpectedConsoleErrors });
}

test.describe.configure({ mode: "serial" });

test("venue availability retry recovers canonical slots before payment review", async ({ page }) => {
  const flow = createFlow({ availabilityFailures: 3 });
  const { state } = await installCheckoutFixtures(page, "reservation", flow);
  await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Make Reservation", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Choose a venue", exact: true }).click();
  const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
  await picker.getByRole("button").filter({ hasText: /PHP/ }).first().click();
  await expect(modal.getByRole("button", { name: "Retry availability", exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Start time:/ })).toBeDisabled();

  await modal.getByRole("button", { name: "Retry availability", exact: true }).click();
  await expect(modal.getByRole("button", { name: /Start time:/ })).toBeEnabled();
  await modal.getByRole("button", { name: /Start time:/ }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Venue start time" })
    .getByRole("button", { name: /available$/ })
    .first()
    .click();
  await modal.getByRole("button", { name: /End time:/ }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Venue end time" })
    .getByRole("button", { name: /available$/ })
    .first()
    .click();
  await expect(modal.getByRole("button", { name: /Pay in full/i, exact: true })).toBeEnabled();
  await modal.getByRole("button", { name: /Pay in full/i, exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Review and pay in full?" })).toBeVisible();
  expect(flow.createCount).toBe(0);
  await assertNoFixtureLeaks(state, [/500/]);
});

test("trainer recovery modal can be dismissed and reopened without creating another checkout", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const recoveryModal = page.getByTestId("checkout-recovery-modal");
  await recoveryModal.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await expect(recoveryModal).not.toBeVisible();
  await expect(page.getByTestId("appointment-modal-card")).toBeVisible();
  await page.getByRole("button", { name: "Alexandra Recovery Coach", exact: true }).click();
  await page.getByRole("button", { name: "Choose date & time", exact: true }).click();
  await expect(recoveryModal).toBeVisible();
  const statusTitle = recoveryModal.getByText(
    /^(?:Payment pending|Checking payment)$/,
  );
  await expect(statusTitle).toHaveCount(1);
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state);
});

test("automatic pending polls stay quiet until a terminal status arrives", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const modal = page.getByTestId("checkout-recovery-modal");

  await expect(modal.getByText("Payment pending", { exact: true })).toBeVisible();
  const initialStatusCount = flow.getStatusCount;
  await page.clock.runFor(5_000);
  await expect.poll(() => flow.getStatusCount).toBeGreaterThanOrEqual(initialStatusCount + 2);
  await expect(modal.getByText("Payment pending", { exact: true })).toBeVisible();
  await expect(modal.getByText("Checking payment", { exact: true })).toHaveCount(0);
  await expect(modal.getByRole("alert")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Check status", exact: true })).toBeEnabled();

  flow.statusState = "succeeded";
  await page.clock.runFor(2_500);
  await expect(page.getByText("Session confirmed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-recovery-modal")).not.toBeVisible();
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state);
});

test("pending trainer recovery survives closing the form and opening a venue form", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const recoveryModal = page.getByTestId("checkout-recovery-modal");
  await recoveryModal.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Make Reservation", exact: true }).click();
  await expect(recoveryModal).toBeVisible();
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state);
});

test("trainer terminal notice stays above the venue form after handoff", async ({ page }) => {
  const flow = createFlow({ reconcileState: "succeeded" });
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const recoveryModal = page.getByTestId("checkout-recovery-modal");
  await recoveryModal.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Make Reservation", exact: true }).click();
  await expect(recoveryModal).toBeVisible();
  await recoveryModal.getByRole("button", { name: "Check status", exact: true }).click();

  const terminalNotice = page.getByText("Session confirmed", { exact: true });
  await expect(terminalNotice).toBeVisible();
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(terminalNotice).not.toBeVisible();
  await expect(
    page.getByRole("dialog").filter({ hasText: "Make a Reservation" }),
  ).toBeVisible();
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state);
});

test("venue recovery modal can be dismissed and reopened without creating another checkout", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "reservation", flow);
  await startReservationCheckout(page, flow);
  const recoveryModal = page.getByTestId("checkout-recovery-modal");
  await recoveryModal.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await expect(recoveryModal).not.toBeVisible();
  const modal = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Choose a venue", exact: true }).click();
  const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
  await picker.getByRole("button").filter({ hasText: /PHP/ }).first().click();
  await modal.getByRole("button", { name: /Start time:/ }).click();
  await page.getByRole("dialog").filter({ hasText: "Venue start time" }).getByRole("button", { name: /available$/ }).first().click();
  await modal.getByRole("button", { name: /End time:/ }).click();
  await page.getByRole("dialog").filter({ hasText: "Venue end time" }).getByRole("button", { name: /available$/ }).first().click();
  await modal.getByRole("button", { name: /Pay in full/i, exact: true }).click();
  await expect(recoveryModal).toBeVisible();
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state);
});

test("trainer checkout can cancel a held payment and unlock a new booking", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const modal = page.getByTestId("checkout-recovery-modal");
  await modal.getByRole("button", { name: "Cancel checkout", exact: true }).click();
  await expect(page.getByText("Checkout cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText(/No coaching booking was confirmed/)).toBeVisible();
  await expect(page.getByText(/payment failed/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("checkout-recovery-modal")).not.toBeVisible();
  await page.getByRole("button", { name: "Alexandra Recovery Coach", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeEnabled();
  expect(flow.createCount).toBe(1);
  expect(flow.mutations).toEqual([
    { method: "POST", path: "/v1/coaching/appointments" },
    { method: "POST", path: `/v1/payments/checkout-holds/${HOLD_ID}/cancel` },
  ]);
  await assertNoFixtureLeaks(state);
});

test("trainer checkout resumes the same URL and accepts a paid reconcile", async ({ page }) => {
  const flow = createFlow({ reconcileState: "succeeded" });
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const modal = page.getByTestId("checkout-recovery-modal");
  await modal.getByRole("button", { name: "Resume payment", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __fittrackCheckoutUrls?: string[] })
            .__fittrackCheckoutUrls
            ?.at(-1),
      ),
    )
    .toBe(CHECKOUT_URL);
  await modal.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page.getByText("Session confirmed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-recovery-modal")).not.toBeVisible();
  expect(flow.createCount).toBe(1);
  const openedUrls = await page.evaluate(
    () =>
      (window as Window & { __fittrackCheckoutUrls?: string[] })
        .__fittrackCheckoutUrls ?? [],
  );
  expect(openedUrls.filter((url) => url === CHECKOUT_URL).length).toBeGreaterThanOrEqual(2);
  expect(flow.mutations).toEqual([
    { method: "POST", path: "/v1/coaching/appointments" },
    { method: "POST", path: `/v1/payments/checkout-holds/${HOLD_ID}/reconcile` },
  ]);
  await assertNoFixtureLeaks(state);
});

test("trainer checkout keeps its lock through status errors and local deadline", async ({ page }) => {
  const flow = createFlow({
    expiresAt: "2026-09-08T04:00:03.000Z",
  });
  const { state } = await installCheckoutFixtures(page, "appointment", flow);
  await startAppointmentCheckout(page, flow);
  const modal = page.getByTestId("checkout-recovery-modal");
  await expect(modal).toContainText("Payment pending");
  await expect.poll(() => flow.getStatusCount).toBeGreaterThan(0);
  let releaseReconcile!: () => void;
  flow.reconcileGate = new Promise<void>((resolve) => {
    releaseReconcile = resolve;
  });
  flow.reconcileFailures = 1;
  const checkStatusClick = modal.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(modal.getByText("Checking payment", { exact: true })).toBeVisible();
  releaseReconcile();
  await checkStatusClick;
  await expect(modal.getByRole("alert")).toContainText("Status service is temporarily unavailable");
  await expect(modal.getByRole("button", { name: "Retry status", exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Retry status", exact: true }).click();
  await expect(modal).toContainText("Payment pending");
  await page.clock.setFixedTime(Date.parse("2026-09-08T04:00:04.000Z"));
  await page.clock.runFor(1_000);
  await expect(modal.getByText("Checking payment", { exact: true })).toHaveCount(0);
  await expect(modal).toContainText("Payment window ended");
  await expect(modal.getByRole("button", { name: "Cancel checkout", exact: true })).toBeEnabled();
  expect(flow.createCount).toBe(1);
  await assertNoFixtureLeaks(state, [/503 \(Service Unavailable\)/]);
});

test("venue checkout exposes the same recovery modal and server cancellation", async ({ page }) => {
  const flow = createFlow();
  const { state } = await installCheckoutFixtures(page, "reservation", flow);
  await startReservationCheckout(page, flow);
  const modal = page.getByTestId("checkout-recovery-modal");
  await expect(modal).toContainText("Payment pending");
  await modal.getByRole("button", { name: "Cancel checkout", exact: true }).click();
  await expect(page.getByText("Checkout cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText(/No reservation was confirmed/)).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("checkout-recovery-modal")).not.toBeVisible();
  expect(flow.createCount).toBe(1);
  expect(flow.mutations).toEqual([
    { method: "POST", path: "/v1/bookings/amenity" },
    { method: "POST", path: `/v1/payments/checkout-holds/${HOLD_ID}/cancel` },
  ]);
  await assertNoFixtureLeaks(state);
});
