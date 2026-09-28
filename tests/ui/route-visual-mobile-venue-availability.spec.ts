import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const FIXED_NOW = Date.parse("2026-09-08T00:00:00.000Z");
const TODAY = "2026-09-08";
const TOMORROW = "2026-09-09";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const VENUE_A = "11111111-1111-4111-8111-111111111111";
const VENUE_B = "22222222-2222-4222-8222-222222222222";

type AvailabilityMode =
  | "success"
  | "empty"
  | "full"
  | "transient500"
  | "terminal500"
  | "deferred";
type AvailabilityPayload = "success" | "empty" | "full" | "terminal500";
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
type FixtureOptions = {
  overlappingMemberBooking?: boolean;
};

type FixtureState = {
  availabilityAttempts: Map<string, number>;
  availabilityModes: Map<string, AvailabilityMode>;
  bookingRecords: unknown[];
  consoleErrors: string[];
  externalUrls: string[];
  failures: string[];
  mutations: Array<{ method: string; path: string }>;
  pendingAvailability: Map<string, Deferred<AvailabilityPayload>>;
  requestErrors: string[];
  observedRequests: string[];
  unhandled: string[];
};

function overlappingMemberBooking() {
  return {
    amenity: {
      capacity: 10,
      hourly_rate: 600,
      id: VENUE_B,
      name: "Court B",
    },
    amenity_id: VENUE_B,
    ends_at: manilaIso(TODAY, "10:00"),
    id: "booking-overlap-venue-b",
    starts_at: manilaIso(TODAY, "09:00"),
    status: "confirmed",
    total_amount: 600,
    user: {
      email: "venue-availability-member@fittrack.test",
      id: MEMBER_ID,
    },
    user_id: MEMBER_ID,
    venue_amount: 600,
  };
}

function newFixtureState(options: FixtureOptions = {}): FixtureState {
  return {
    availabilityAttempts: new Map(),
    availabilityModes: new Map(),
    bookingRecords: options.overlappingMemberBooking
      ? [overlappingMemberBooking()]
      : [],
    consoleErrors: [],
    externalUrls: [],
    failures: [],
    mutations: [],
    pendingAvailability: new Map(),
    requestErrors: [],
    observedRequests: [],
    unhandled: [],
  };
}

function availabilityKey(venueId: string, date: string) {
  return `${venueId}:${date}`;
}

function setAvailabilityMode(
  state: FixtureState,
  venueId: string,
  date: string,
  mode: AvailabilityMode,
) {
  state.availabilityModes.set(availabilityKey(venueId, date), mode);
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    status,
  });
}

async function fulfillPaginated(route: Route, records: unknown[]) {
  await route.fulfill({
    body: JSON.stringify({
      data: records,
      meta: { limit: 100, page: 1, total: records.length, total_pages: 1 },
    }),
    contentType: "application/json",
    status: 200,
  });
}

async function failAvailability(
  route: Route,
  state: FixtureState,
  key: string,
) {
  const requestUrl = new URL(route.request().url());
  state.failures.push(
    `${route.request().method()} ${requestUrl.pathname}${requestUrl.search} key=${key}`,
  );
  await route.fulfill({
    body: JSON.stringify({
      detail: "An unexpected error occurred.",
      status: 500,
      title: "Internal Server Error",
      type: "INTERNAL_SERVER_ERROR",
    }),
    contentType: "application/json",
    status: 500,
  });
}

function memberProfile() {
  return {
    email: "venue-availability-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: MEMBER_ID,
    membership_card: {
      activated_at: "2026-09-01T00:00:00.000Z",
      purchased_at: "2026-09-01T00:00:00.000Z",
      source: "fixture",
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    },
    phone_no: "+639171234568",
    profile: {
      activity_level: "moderate",
      date_of_birth: "1994-05-20",
      first_name: "Venue",
      fitness_goal: "maintenance",
      gender: "female",
      height_cm: 165,
      last_name: "Availability",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

function venueApiList() {
  return [
    {
      capacity: 12,
      description: "Court A fixture",
      display_order: 1,
      floor_id: "floor-1",
      grid_column: 1,
      grid_height: 2,
      grid_row: 1,
      grid_width: 2,
      hourly_rate: 500,
      icon_key: "basketball",
      id: VENUE_A,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      minimum_hours: 1,
      name: "Court A",
      status: "available",
      type: "basketball_court",
    },
    {
      capacity: 10,
      description: "Court B fixture",
      display_order: 2,
      floor_id: "floor-1",
      grid_column: 3,
      grid_height: 2,
      grid_row: 1,
      grid_width: 2,
      hourly_rate: 600,
      icon_key: "basketball",
      id: VENUE_B,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      minimum_hours: 1,
      name: "Court B",
      status: "available",
      type: "basketball_court",
    },
  ];
}

function manilaIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

function availabilityRecords(date: string, mode: AvailabilityPayload) {
  if (mode === "empty") return [];
  const status = mode === "full" ? "full" : "available";
  return ["09:00", "10:00", "11:00"].map((time) => {
    const start = manilaIso(date, time);
    const end = new Date(new Date(start).getTime() + 60 * 60_000).toISOString();
    return {
      available: status === "available",
      ends_at: end,
      starts_at: start,
      status,
    };
  });
}

async function fulfillAvailability(
  route: Route,
  date: string,
  payload: AvailabilityPayload,
) {
  await fulfill(route, availabilityRecords(date, payload));
}

async function installFixtures(page: Page, state: FixtureState) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText;
    if (reason) {
      state.requestErrors.push(
        `${request.method()} ${new URL(request.url()).pathname}: ${reason}`,
      );
    }
  });
  page.on("popup", (popup) => state.externalUrls.push(popup.url()));
  page.on("request", (request) => {
    if (/paymongo|checkout/i.test(request.url())) {
      state.externalUrls.push(request.url());
    }
  });

  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.addInitScript(() => {
    window.localStorage.setItem("fittrack_access_token", "venue-availability-access-token");
    window.localStorage.setItem("fittrack_refresh_token", "venue-availability-refresh-token");
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    state.observedRequests.push(`${method} ${path}${url.search}`);

    if (method !== "GET") {
      state.mutations.push({ method, path });
      state.unhandled.push(`${method} ${path}${url.search}`);
      await route.abort("blockedbyclient");
      return;
    }

    if (path === "/v1/users/me") {
      await fulfill(route, memberProfile());
      return;
    }
    if (path === "/v1/users/deletion-request") {
      await fulfill(route, { status: null });
      return;
    }
    if (path === "/v1/notifications/my") {
      await fulfillPaginated(route, []);
      return;
    }
    if (path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (path === "/v1/membership/my-subscription") {
      await fulfill(route, {
        id: "membership-venue-availability-fixture",
        plan: { name: "Fitness Access" },
        status: "active",
      });
      return;
    }
    if (path === "/v1/bookings/recurring-coaching-plans") {
      await fulfill(route, []);
      return;
    }
    if (path === "/v1/bookings/amenities") {
      await fulfill(route, venueApiList());
      return;
    }
    if (path === "/v1/bookings/amenity/my" || path === "/v1/coaching/appointments/my") {
      await fulfillPaginated(
        route,
        path === "/v1/bookings/amenity/my" ? state.bookingRecords : [],
      );
      return;
    }
    if (path === "/v1/coaching/coaches") {
      await fulfill(route, []);
      return;
    }
    if (path === "/v1/bookings/amenities/availability") {
      const venueId = url.searchParams.get("amenity_id") ?? "";
      const date = url.searchParams.get("date") ?? "";
      const key = availabilityKey(venueId, date);
      const attempt = (state.availabilityAttempts.get(key) ?? 0) + 1;
      state.availabilityAttempts.set(key, attempt);
      state.observedRequests.push(`availability ${key} attempt=${attempt}`);
      const mode = state.availabilityModes.get(key) ?? "success";

      if (mode === "terminal500" || (mode === "transient500" && attempt === 1)) {
        await failAvailability(route, state, key);
        return;
      }
      if (mode === "deferred") {
        const gate = state.pendingAvailability.get(key) ?? makeDeferred<AvailabilityPayload>();
        state.pendingAvailability.set(key, gate);
        const payload = await gate.promise;
        state.pendingAvailability.delete(key);
        if (payload === "terminal500") {
          await failAvailability(route, state, key);
          return;
        }
        await fulfillAvailability(route, date, payload);
        return;
      }
      await fulfillAvailability(
        route,
        date,
        mode === "empty" || mode === "full" ? mode : "success",
      );
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function openReservation(page: Page) {
  await page.goto(`${MOBILE_BASE_URL}/bookings?openReservation=true`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/bookings(?:\?|$)/);
  await expect(page.getByText("Bookings", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  const reservation = page
    .getByRole("dialog")
    .filter({ hasText: "Make a Reservation" });
  await expect(reservation).toBeVisible({ timeout: 20_000 });
  await stabilizeVisualPage(page);
  return reservation;
}

async function selectVenue(
  page: Page,
  reservation: ReturnType<Page["getByRole"]>,
  venueName: string,
) {
  const selected = reservation.getByRole("button", {
    name: venueName === "Court A" ? "Choose a venue" : /Selected venue/,
    exact: venueName === "Court A",
  });
  await selected.click();
  const picker = page
    .getByRole("dialog")
    .filter({ hasText: "Select a Venue" });
  await expect(picker).toBeVisible();
  const row = picker.getByRole("button").filter({ hasText: venueName }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(picker).not.toBeVisible();
  await expect(
    reservation.getByRole("button", {
      name: `Selected venue ${venueName}`,
      exact: true,
    }),
  ).toBeVisible();
}

async function waitForAvailabilityRequest(
  state: FixtureState,
  key: string,
  attempt = 1,
) {
  await expect
    .poll(() => state.availabilityAttempts.get(key) ?? 0, {
      message: `${key} availability request attempt ${attempt}`,
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(attempt);
}

function hint(reservation: ReturnType<Page["getByRole"]>, message: string) {
  return reservation.getByText(message, { exact: true });
}

async function assertPayDisabled(reservation: ReturnType<Page["getByRole"]>) {
  await expect(
    reservation.getByRole("button", { name: "Pay in full", exact: true }),
  ).toBeDisabled();
}

async function selectValidTimes(
  page: Page,
  reservation: ReturnType<Page["getByRole"]>,
  startIndex = 0,
  endIndex = 0,
) {
  const startButton = reservation.getByRole("button", { name: /Start time:/ });
  await expect(startButton).toBeEnabled();
  await startButton.click();
  const startPicker = page
    .getByRole("dialog")
    .filter({ hasText: "Venue start time" });
  await expect(startPicker).toBeVisible();
  await startPicker
    .getByRole("button", { name: /available$/ })
    .nth(startIndex)
    .click();

  const endButton = reservation.getByRole("button", { name: /End time:/ });
  await expect(endButton).toBeEnabled();
  await endButton.click();
  const endPicker = page
    .getByRole("dialog")
    .filter({ hasText: "Venue end time" });
  await expect(endPicker).toBeVisible();
  await endPicker
    .getByRole("button", { name: /available$/ })
    .nth(endIndex)
    .click();
  await expect(
    reservation.getByRole("button", { name: "Pay in full", exact: true }),
  ).toBeEnabled();
}

async function closeReservation(
  page: Page,
  reservation: ReturnType<Page["getByRole"]>,
) {
  await reservation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(reservation).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open quick actions menu", exact: true }),
  ).toBeVisible();
}

async function reopenReservation(page: Page) {
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: "Make Reservation", exact: true }).click();
  const reservation = page
    .getByRole("dialog")
    .filter({ hasText: "Make a Reservation" });
  await expect(reservation).toBeVisible();
  return reservation;
}

type ReservationSurfaceBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
};

type ReservationSurfaceNode = {
  ariaHidden: string | null;
  bounds: ReservationSurfaceBounds;
  className: string;
  disabled: boolean;
  display: string;
  opacity: number;
  role: string | null;
  tagName: string;
  transform: string;
  visibility: string;
};

type ReservationSurfaceEvidence = {
  anchors: Record<string, ReservationSurfaceNode>;
  card: ReservationSurfaceNode;
  dialog: ReservationSurfaceNode;
  layers: ReservationSurfaceNode[];
  reachesDialog: boolean;
  sampleCount: number;
  stableSampleCount: number;
  viewport: { height: number; width: number };
};

function reservationSurfaceNodes(surface: ReservationSurfaceEvidence) {
  return [
    surface.dialog,
    surface.card,
    ...surface.layers,
    ...Object.values(surface.anchors),
  ];
}

function surfaceBoundsStable(
  previous: ReservationSurfaceEvidence,
  current: ReservationSurfaceEvidence,
) {
  const previousNodes = reservationSurfaceNodes(previous);
  const currentNodes = reservationSurfaceNodes(current);
  if (previousNodes.length !== currentNodes.length) return false;
  return previousNodes.every((previousNode, index) => {
    const currentNode = currentNodes[index];
    return (
      Math.abs(previousNode.bounds.x - currentNode.bounds.x) <= 0.5 &&
      Math.abs(previousNode.bounds.y - currentNode.bounds.y) <= 0.5 &&
      Math.abs(previousNode.bounds.width - currentNode.bounds.width) <= 0.5 &&
      Math.abs(previousNode.bounds.height - currentNode.bounds.height) <= 0.5
    );
  });
}

function surfaceIsReady(surface: ReservationSurfaceEvidence) {
  const isDisplayed = (node: ReservationSurfaceNode) =>
    node.display !== "none" &&
    node.visibility !== "hidden" &&
    node.ariaHidden !== "true" &&
    node.opacity > 0 &&
    node.bounds.width > 0 &&
    node.bounds.height > 0;
  const layersReady = [surface.dialog, ...surface.layers].every(
    (node) => isDisplayed(node) && node.opacity >= 0.98,
  );
  const anchorsReady = Object.values(surface.anchors).every((node) => {
    const { bounds } = node;
    return (
      isDisplayed(node) &&
      bounds.left >= -0.5 &&
      bounds.top >= -0.5 &&
      bounds.right <= surface.viewport.width + 0.5 &&
      bounds.bottom <= surface.viewport.height + 0.5
    );
  });
  return surface.reachesDialog && layersReady && anchorsReady;
}

async function settleReservationSurface(page: Page) {
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: "Make a Reservation" })
    .last();
  await expect(dialog, "visible Make a Reservation dialog").toHaveCount(1);
  await expect(dialog, "Make a Reservation dialog visibility").toBeVisible();

  const anchorLocators = [
    {
      locator: dialog.getByText("Make a Reservation", { exact: true }).first(),
      name: "title",
    },
    {
      locator: dialog.getByRole("button", { name: /Start time:/ }).first(),
      name: "start",
    },
    {
      locator: dialog.getByRole("button", { name: /End time:/ }).first(),
      name: "end",
    },
    {
      locator: dialog.getByRole("button", { name: "Cancel", exact: true }).first(),
      name: "cancel",
    },
    {
      locator: dialog
        .getByRole("button", { name: /Pay in full|PayMongo unavailable/ })
        .first(),
      name: "pay",
    },
  ];
  for (const anchor of anchorLocators) {
    await expect(anchor.locator, `${anchor.name} anchor visibility`).toBeVisible();
  }

  const dialogHandle = await dialog.elementHandle();
  const anchorHandles = await Promise.all(
    anchorLocators.map(({ locator }) => locator.elementHandle()),
  );
  if (
    !dialogHandle ||
    anchorHandles.some((handle) => handle === null)
  ) {
    throw new Error("Could not resolve the visible reservation surface anchors.");
  }
  const resolvedAnchorHandles = anchorHandles.filter(
    (handle): handle is NonNullable<typeof handle> => handle !== null,
  );
  const anchorNames = anchorLocators.map(({ name }) => name);

  const readSample = async (): Promise<ReservationSurfaceEvidence> =>
    page.evaluate(
      ({ dialog: dialogElement, anchors, names }) => {
        const inspect = (element: Element) => {
          const computed = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const opacityValue = Number.parseFloat(computed.opacity);
          const disabled =
            element.getAttribute("aria-disabled") === "true" ||
            element.getAttribute("disabled") !== null ||
            (element instanceof HTMLButtonElement && element.disabled);
          return {
            ariaHidden: element.getAttribute("aria-hidden"),
            bounds: {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
              x: rect.x,
              y: rect.y,
            },
            className:
              typeof element.className === "string" ? element.className : "",
            disabled,
            display: computed.display,
            opacity: Number.isFinite(opacityValue) ? opacityValue : 1,
            role: element.getAttribute("role"),
            tagName: element.tagName,
            transform: computed.transform,
            visibility: computed.visibility,
          };
        };

        let card: Element | null = anchors[0] ?? null;
        while (
          card &&
          !anchors.every(
            (anchor) => card === anchor || card.contains(anchor),
          )
        ) {
          card = card.parentElement;
        }
        if (!card) throw new Error("Could not find the reservation card ancestor.");

        const layers: Element[] = [];
        let cursor: Element | null = card;
        while (cursor) {
          layers.push(cursor);
          if (cursor === dialogElement) break;
          cursor = cursor.parentElement;
        }
        const reachesDialog =
          card === dialogElement ||
          card.contains(dialogElement) ||
          dialogElement.contains(card);
        if (!reachesDialog) layers.push(dialogElement);

        const anchorMetrics: Record<string, ReturnType<typeof inspect>> = {};
        names.forEach((name, index) => {
          const anchor = anchors[index];
          if (anchor) anchorMetrics[name] = inspect(anchor);
        });
        return {
          anchors: anchorMetrics,
          card: inspect(card),
          dialog: inspect(dialogElement),
          layers: layers.map(inspect),
          reachesDialog,
          sampleCount: 0,
          stableSampleCount: 0,
          viewport: { height: window.innerHeight, width: window.innerWidth },
        };
      },
      {
        anchors: resolvedAnchorHandles,
        dialog: dialogHandle,
        names: anchorNames,
      },
    );

  let previous: ReservationSurfaceEvidence | null = null;
  let latest: ReservationSurfaceEvidence | null = null;
  let sampleCount = 0;
  let stableSampleCount = 0;
  try {
    await expect
      .poll(
        async () => {
          const current = await readSample();
          sampleCount += 1;
          const stable = previous !== null && surfaceBoundsStable(previous, current);
          if (stable) stableSampleCount += 1;
          latest = {
            ...current,
            sampleCount,
            stableSampleCount,
          };
          previous = latest;
          return surfaceIsReady(latest) && stable;
        },
        {
          intervals: [50, 100, 200, 400],
          message: "reservation card and anchors should settle before capture",
          timeout: 8_000,
        },
      )
      .toBe(true);
  } catch (error) {
    const diagnostic = latest
      ? JSON.stringify(latest)
      : "no surface sample was collected";
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Reservation surface did not settle: ${reason}; ${diagnostic}`,
      { cause: error },
    );
  } finally {
    await dialogHandle.dispose();
    await Promise.all(resolvedAnchorHandles.map((handle) => handle.dispose()));
  }
  if (!latest) throw new Error("Reservation surface settlement returned no sample.");
  return latest;
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: FixtureState,
  name: string,
) {
  const surface = await settleReservationSurface(page);
  const audit = await auditConventionalLayout(page);
  const evidenceRoot = resolve(
    process.cwd(),
    ".artifacts",
    "playwright",
    "venue-availability",
  );
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );
  const screenshotSurface = await settleReservationSurface(page);
  const screenshotPath = resolve(evidenceRoot, `${safeName}.png`);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  const evidence = {
    audit,
    consoleErrors: state.consoleErrors,
    externalUrls: state.externalUrls,
    failures: state.failures,
    mutations: state.mutations,
    observedRequests: state.observedRequests,
    requestErrors: state.requestErrors,
    route: await page.url(),
    reservationSurface: surface,
    screenshotSurface,
    unhandled: state.unhandled,
  };
  const evidencePath = resolve(evidenceRoot, `${safeName}.json`);
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  return audit;
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.squishedText, "squished text").toEqual([]);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

function assertFixtureClosed(state: FixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.mutations, "availability journeys should not write to the API").toEqual([]);
  expect(state.externalUrls, "availability journeys should not open payment URLs").toEqual([]);
  const unexpectedConsoleErrors = state.consoleErrors.filter(
    (message) => !/status of 500 \(Internal Server Error\)/i.test(message),
  );
  expect(unexpectedConsoleErrors, "unexpected console or page errors").toEqual([]);
}

test.describe("mobile venue availability states", () => {
  test("recovers from a transient availability 500 without a stale generic error", async ({ page }, testInfo) => {
    const state = newFixtureState();
    setAvailabilityMode(state, VENUE_A, TODAY, "transient500");
    await installFixtures(page, state);
    const reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const key = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, key, 2);
    await expect(hint(reservation, "An unexpected error occurred.")).toHaveCount(0);
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
    await captureEvidence(page, testInfo, state, "transient-recovered");
    assertFixtureClosed(state);
  });

  test("holds terminal failure, retry loading, and recovered readiness at both mobile widths", async ({ page }, testInfo) => {
    const state = newFixtureState();
    setAvailabilityMode(state, VENUE_A, TODAY, "terminal500");
    await installFixtures(page, state);
    const reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const key = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, key, 3);
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toBeVisible();
    await expect(hint(reservation, "An unexpected error occurred.")).toHaveCount(0);
    await expect(reservation.getByRole("button", { name: "Retry availability", exact: true })).toBeVisible();
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeDisabled();
    await expect(reservation.getByRole("button", { name: /End time:/ })).toBeDisabled();
    await assertPayDisabled(reservation);
    await captureEvidence(page, testInfo, state, "terminal-failure");

    setAvailabilityMode(state, VENUE_A, TODAY, "deferred");
    await reservation.getByRole("button", { name: "Retry availability", exact: true }).click();
    await waitForAvailabilityRequest(state, key, 4);
    await expect(hint(reservation, "Checking available times...")).toBeVisible();
    await expect(reservation.getByRole("button", { name: "Retry availability", exact: true })).toHaveCount(0);
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
    await assertPayDisabled(reservation);
    await captureEvidence(page, testInfo, state, "retry-loading");
    state.pendingAvailability.get(key)?.resolve("success");
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
    await expect(hint(reservation, "An unexpected error occurred.")).toHaveCount(0);
    await selectValidTimes(page, reservation);
    const audit = await captureEvidence(page, testInfo, state, "recovered-readiness");
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });

  test("keeps time controls and payment fail-closed while availability is pending", async ({ page }, testInfo) => {
    const state = newFixtureState();
    setAvailabilityMode(state, VENUE_A, TODAY, "deferred");
    await installFixtures(page, state);
    const reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const key = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, key);
    await expect(hint(reservation, "Checking available times...")).toBeVisible();
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeDisabled();
    await expect(reservation.getByRole("button", { name: /End time:/ })).toBeDisabled();
    await assertPayDisabled(reservation);
    await captureEvidence(page, testInfo, state, "loading");
    state.pendingAvailability.get(key)?.resolve("success");
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await captureEvidence(page, testInfo, state, "loading-recovered");
    assertFixtureClosed(state);
  });

  test("refetches cached availability and blocks stale slots after a reopened failure", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installFixtures(page, state);
    let reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const key = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, key);
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await closeReservation(page, reservation);

    await page.clock.setFixedTime(new Date(FIXED_NOW + 120_000));
    setAvailabilityMode(state, VENUE_A, TODAY, "terminal500");
    reservation = await reopenReservation(page);
    await selectVenue(page, reservation, "Court A");
    await waitForAvailabilityRequest(state, key, 2);
    await expect(hint(reservation, "Checking available times...")).toBeVisible();
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeDisabled();
    await assertPayDisabled(reservation);
    await waitForAvailabilityRequest(state, key, 4);
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toBeVisible();
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeDisabled();
    await captureEvidence(page, testInfo, state, "cached-refetch-failure");

    setAvailabilityMode(state, VENUE_A, TODAY, "success");
    await reservation.getByRole("button", { name: "Retry availability", exact: true }).click();
    await waitForAvailabilityRequest(state, key, 5);
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
    await captureEvidence(page, testInfo, state, "cached-refetch-recovered");
    assertFixtureClosed(state);
  });

  test("keeps late date and venue responses isolated by their query keys", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    setAvailabilityMode(state, VENUE_A, TODAY, "deferred");
    setAvailabilityMode(state, VENUE_B, TODAY, "success");
    setAvailabilityMode(state, VENUE_B, TOMORROW, "deferred");
    await installFixtures(page, state);
    const reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const oldVenueKey = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, oldVenueKey);

    await reservation.getByRole("button", { name: "Selected venue Court A", exact: true }).click();
    const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
    await picker.getByRole("button").filter({ hasText: "Court B" }).first().click();
    const newVenueKey = availabilityKey(VENUE_B, TODAY);
    await waitForAvailabilityRequest(state, newVenueKey);
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();

    await reservation.getByRole("button", { name: /Reservation date:/ }).click();
    const calendar = page.getByRole("dialog").filter({ hasText: "September 2026" });
    await expect(calendar).toBeVisible();
    await calendar.getByRole("button", { name: "9", exact: true }).last().click();
    await expect(calendar).not.toBeVisible();
    const oldDateKey = availabilityKey(VENUE_B, TOMORROW);
    await waitForAvailabilityRequest(state, oldDateKey);
    await expect(hint(reservation, "Checking available times...")).toBeVisible();

    await reservation.getByRole("button", { name: /Reservation date:/ }).click();
    const todayCalendar = page.getByRole("dialog").filter({ hasText: "September 2026" });
    await expect(todayCalendar).toBeVisible();
    await todayCalendar.getByRole("button", { name: "8", exact: true }).last().click();
    await expect(todayCalendar).not.toBeVisible();
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await expect(
      reservation.getByRole("button", { name: /Reservation date:.*Sep 8.*2026/ }),
    ).toBeVisible();
    await expect(reservation.getByRole("button", { name: "Selected venue Court B", exact: true })).toBeVisible();

    setAvailabilityMode(state, VENUE_A, TODAY, "terminal500");
    setAvailabilityMode(state, VENUE_B, TOMORROW, "terminal500");
    expect(state.pendingAvailability.has(oldVenueKey)).toBe(true);
    expect(state.pendingAvailability.has(oldDateKey)).toBe(true);
    state.pendingAvailability.get(oldVenueKey)?.resolve("terminal500");
    state.pendingAvailability.get(oldDateKey)?.resolve("terminal500");
    await expect
      .poll(() => state.failures.filter((failure) => failure.includes(oldVenueKey)).length)
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => state.failures.filter((failure) => failure.includes(oldDateKey)).length)
      .toBeGreaterThanOrEqual(1);
    await expect(hint(reservation, "An unexpected error occurred.")).toHaveCount(0);
    await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
    await expect(hint(reservation, "Checking available times...")).toHaveCount(0);
    await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeEnabled();
    await expect(reservation.getByRole("button", { name: "Selected venue Court B", exact: true })).toBeVisible();
    await expect(
      reservation.getByRole("button", { name: /Reservation date:.*Sep 8.*2026/ }),
    ).toBeVisible();
    await captureEvidence(page, testInfo, state, "late-key-change-recovered");
    assertFixtureClosed(state);
  });

  test("clears member overlap validation after valid date and time changes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState({ overlappingMemberBooking: true });
    await installFixtures(page, state);
    const reservation = await openReservation(page);
    await selectVenue(page, reservation, "Court A");
    const todayKey = availabilityKey(VENUE_A, TODAY);
    await waitForAvailabilityRequest(state, todayKey);
    await expect
      .poll(() =>
        state.observedRequests.filter((request) =>
          request.startsWith("GET /v1/bookings/amenity/my"),
        ).length,
      )
      .toBeGreaterThan(0);

    const overlapMessage = reservation.getByText(
      "You already have a booking in this time window.",
      { exact: true },
    );
    await selectValidTimes(page, reservation);
    await expect(overlapMessage.first()).toBeVisible();
    await reservation.getByRole("button", { name: "Pay in full", exact: true }).click();
    await expect(overlapMessage.first()).toBeVisible();
    await expect(
      page.getByRole("dialog").filter({ hasText: "Review and pay in full?" }),
    ).toHaveCount(0);

    await reservation.getByRole("button", { name: /Reservation date:/ }).click();
    const tomorrowCalendar = page
      .getByRole("dialog")
      .filter({ hasText: "September 2026" });
    await expect(tomorrowCalendar).toBeVisible();
    await tomorrowCalendar
      .getByRole("button", { name: "9", exact: true })
      .last()
      .click();
    await expect(tomorrowCalendar).not.toBeVisible();
    await waitForAvailabilityRequest(state, availabilityKey(VENUE_A, TOMORROW));
    await expect(overlapMessage).toHaveCount(0);

    await reservation.getByRole("button", { name: /Reservation date:/ }).click();
    const todayCalendar = page
      .getByRole("dialog")
      .filter({ hasText: "September 2026" });
    await expect(todayCalendar).toBeVisible();
    await todayCalendar
      .getByRole("button", { name: "8", exact: true })
      .last()
      .click();
    await expect(todayCalendar).not.toBeVisible();
    await expect(
      reservation.getByRole("button", { name: /Reservation date:.*Sep 8.*2026/ }),
    ).toBeVisible();

    await selectValidTimes(page, reservation);
    await expect(overlapMessage.first()).toBeVisible();
    await reservation.getByRole("button", { name: "Pay in full", exact: true }).click();
    await expect(overlapMessage.first()).toBeVisible();
    await expect(
      page.getByRole("dialog").filter({ hasText: "Review and pay in full?" }),
    ).toHaveCount(0);

    await selectValidTimes(page, reservation, 1, 0);
    await expect(overlapMessage).toHaveCount(0);
    await expect(
      reservation.getByRole("button", { name: "Pay in full", exact: true }),
    ).toBeEnabled();
    assertFixtureClosed(state);
  });

  for (const mode of ["empty", "full"] as const) {
    test(`renders a successful ${mode} day as a non-error and blocks payment`, async ({ page }, testInfo) => {
      const state = newFixtureState();
      setAvailabilityMode(state, VENUE_A, TODAY, mode);
      await installFixtures(page, state);
      const reservation = await openReservation(page);
      await selectVenue(page, reservation, "Court A");
      await waitForAvailabilityRequest(state, availabilityKey(VENUE_A, TODAY));
      await expect(
        reservation.getByText(/No future venue slots are available|All venue slots are currently booked/, {
          exact: false,
        }),
      ).toBeVisible();
      await expect(hint(reservation, "Couldn't load available times. Please retry.")).toHaveCount(0);
      await expect(reservation.getByRole("button", { name: /Start time:/ })).toBeDisabled();
      await expect(reservation.getByRole("button", { name: /End time:/ })).toBeDisabled();
      await assertPayDisabled(reservation);
      await captureEvidence(page, testInfo, state, `${mode}-day`);
      assertFixtureClosed(state);
    });
  }
});
