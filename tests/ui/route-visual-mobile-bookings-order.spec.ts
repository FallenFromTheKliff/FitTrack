import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL = "http://127.0.0.1:8081";
const FIXED_NOW = Date.parse("2026-09-08T08:00:00.000Z");
const TODAY = "2026-09-08";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const COACH_ID = "55555555-5555-4555-8555-555555555555";
const UNAVAILABLE_BOOKING_ID = "venue-booking-maintenance";
const API_PAGE_SIZE = 100;

type FixtureOptions = {
  failAppointmentsPage2?: boolean;
  failBookingsPage2?: boolean;
  includeUnavailableVenue?: boolean;
  mode?: "full" | "pastOnly";
};

type FixtureState = {
  consoleErrors: string[];
  failures: string[];
  mutations: Array<{ method: string; path: string }>;
  observedRequests: string[];
  paginationRequests: Array<{
    limit: number;
    page: number;
    path: string;
  }>;
  unhandled: string[];
};

type VenueFixture = {
  id: string;
  name: string;
  startAt: string;
  status: "cancelled" | "completed" | "confirmed";
  venueId: string;
};

type AppointmentFixture = {
  coachName: string;
  id: string;
  scheduledAt: string;
  status: "completed" | "confirmed";
};

function newFixtureState(): FixtureState {
  return {
    consoleErrors: [],
    failures: [],
    mutations: [],
    observedRequests: [],
    paginationRequests: [],
    unhandled: [],
  };
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

async function fulfillPaginated(
  route: Route,
  records: unknown[],
  meta: { limit: number; page: number; total: number; total_pages: number },
  status = 200,
) {
  await route.fulfill({
    body: JSON.stringify({ data: records, meta }),
    contentType: "application/json",
    status,
  });
}

function memberProfile() {
  return {
    email: "booking-order-member@fittrack.test",
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
      first_name: "Booking",
      gender: "female",
      height_cm: 165,
      last_name: "Order",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

function dateFromOffset(offset: number) {
  const date = new Date(Date.UTC(2026, 8, 9 + offset));
  return date.toISOString().slice(0, 10);
}

function manilaIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

function endAt(startAt: string) {
  return new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString();
}

function buildFutureVenues(): VenueFixture[] {
  return Array.from({ length: 100 }, (_, index) => {
    const date = dateFromOffset(Math.floor(index / 4));
    const hour = 8 + (index % 4) * 3;
    const startAt = manilaIso(date, `${String(hour).padStart(2, "0")}:00`);
    return {
      id: `venue-booking-future-${String(index).padStart(3, "0")}`,
      name: `Future Venue ${String(index).padStart(3, "0")}`,
      startAt,
      status: "confirmed",
      venueId: `venue-id-future-${String(index).padStart(3, "0")}`,
    };
  });
}

function buildVenueFixtures(
  mode: FixtureOptions["mode"] = "full",
  includeUnavailableVenue = false,
) {
  const today: VenueFixture[] = [
    {
      id: "venue-booking-today-early",
      name: "Today Early Venue",
      startAt: manilaIso(TODAY, "08:15"),
      status: "confirmed",
      venueId: "venue-id-today-early",
    },
    {
      id: "venue-booking-today-mid",
      name: "Today Mid Venue",
      startAt: manilaIso(TODAY, "14:45"),
      status: "confirmed",
      venueId: "venue-id-today-mid",
    },
    {
      id: "venue-booking-today-tie-a",
      name: "Today Tie A Venue",
      startAt: manilaIso(TODAY, "11:00"),
      status: "confirmed",
      venueId: "venue-id-today-tie-a",
    },
    {
      id: "venue-booking-today-tie-b",
      name: "Today Tie B Venue",
      startAt: manilaIso(TODAY, "11:00"),
      status: "confirmed",
      venueId: "venue-id-today-tie-b",
    },
    {
      id: "venue-booking-today-late",
      name: "Today Late Venue",
      startAt: manilaIso(TODAY, "20:30"),
      status: "confirmed",
      venueId: "venue-id-today-late",
    },
  ];
  const history: VenueFixture[] = [
    {
      id: "venue-booking-history-evening",
      name: "History Evening Venue",
      startAt: manilaIso("2026-09-07", "18:00"),
      status: "completed",
      venueId: "venue-id-history-evening",
    },
    {
      id: "venue-booking-history-mid",
      name: "History Mid Venue",
      startAt: manilaIso("2026-09-07", "13:00"),
      status: "completed",
      venueId: "venue-id-history-mid",
    },
    {
      id: "venue-booking-history-morning",
      name: "History Morning Venue",
      startAt: manilaIso("2026-09-07", "09:00"),
      status: "completed",
      venueId: "venue-id-history-morning",
    },
    {
      id: "venue-booking-history-early",
      name: "History Early Venue",
      startAt: manilaIso("2026-09-06", "10:00"),
      status: "completed",
      venueId: "venue-id-history-early",
    },
    {
      id: "venue-booking-history-old",
      name: "History Old Venue",
      startAt: manilaIso("2026-09-05", "17:00"),
      status: "completed",
      venueId: "venue-id-history-old",
    },
  ];
  const unavailableVenue: VenueFixture = {
    id: UNAVAILABLE_BOOKING_ID,
    name: "Maintenance Court",
    startAt: manilaIso(TODAY, "10:00"),
    status: "confirmed",
    venueId: "venue-id-maintenance-court",
  };
  const records =
    mode === "pastOnly"
      ? history
      : [
          ...(includeUnavailableVenue ? [unavailableVenue] : []),
          ...today,
          ...buildFutureVenues(),
          ...history,
        ];
  return records.sort((left, right) => {
    const byTimestamp = right.startAt.localeCompare(left.startAt);
    return byTimestamp || right.id.localeCompare(left.id);
  });
}

function buildFutureAppointments(): AppointmentFixture[] {
  return Array.from({ length: 100 }, (_, index) => {
    const date = dateFromOffset(Math.floor(index / 4));
    const hour = 8 + (index % 4) * 3;
    return {
      coachName: `Future Coach ${String(index).padStart(3, "0")}`,
      id: `appointment-future-${String(index).padStart(3, "0")}`,
      scheduledAt: manilaIso(date, `${String(hour).padStart(2, "0")}:00`),
      status: "confirmed",
    };
  });
}

function buildAppointmentFixtures(mode: FixtureOptions["mode"] = "full") {
  const today: AppointmentFixture[] = [
    {
      coachName: "Appointment Early Coach",
      id: "appointment-today-early",
      scheduledAt: manilaIso(TODAY, "07:00"),
      status: "confirmed",
    },
    {
      coachName: "Appointment Mid Coach",
      id: "appointment-today-mid",
      scheduledAt: manilaIso(TODAY, "13:30"),
      status: "confirmed",
    },
    {
      coachName: "Appointment Tie A Coach",
      id: "appointment-today-tie-a",
      scheduledAt: manilaIso(TODAY, "11:00"),
      status: "confirmed",
    },
    {
      coachName: "Appointment Tie B Coach",
      id: "appointment-today-tie-b",
      scheduledAt: manilaIso(TODAY, "11:00"),
      status: "confirmed",
    },
    {
      coachName: "Appointment Late Coach",
      id: "appointment-today-late",
      scheduledAt: manilaIso(TODAY, "22:00"),
      status: "confirmed",
    },
  ];
  const history: AppointmentFixture[] = [
    {
      coachName: "Appointment History Evening",
      id: "appointment-history-evening",
      scheduledAt: manilaIso("2026-09-07", "18:00"),
      status: "completed",
    },
    {
      coachName: "Appointment History Mid",
      id: "appointment-history-mid",
      scheduledAt: manilaIso("2026-09-07", "13:00"),
      status: "completed",
    },
    {
      coachName: "Appointment History Morning",
      id: "appointment-history-morning",
      scheduledAt: manilaIso("2026-09-07", "09:00"),
      status: "completed",
    },
    {
      coachName: "Appointment History Early",
      id: "appointment-history-early",
      scheduledAt: manilaIso("2026-09-06", "10:00"),
      status: "completed",
    },
    {
      coachName: "Appointment History Old",
      id: "appointment-history-old",
      scheduledAt: manilaIso("2026-09-05", "17:00"),
      status: "completed",
    },
  ];
  const records = mode === "pastOnly" ? [] : [...today, ...buildFutureAppointments(), ...history];
  return records.sort((left, right) => {
    const byTimestamp = right.scheduledAt.localeCompare(left.scheduledAt);
    return byTimestamp || right.id.localeCompare(left.id);
  });
}

function venueApiRecord(
  record: VenueFixture,
  cancelledBookingIds?: Set<string>,
) {
  return {
    amenity: {
      capacity: 12,
      hourly_rate: "1200",
      id: record.venueId,
      name: record.name,
    },
    amenity_id: record.venueId,
    created_at: record.startAt,
    ends_at: endAt(record.startAt),
    id: record.id,
    notes: `Fixture reservation ${record.name}`,
    starts_at: record.startAt,
    status: cancelledBookingIds?.has(record.id) ? "cancelled" : record.status,
    total_amount: "1200",
    user: {
      email: "booking-order-member@fittrack.test",
      id: MEMBER_ID,
      profile: { firstName: "Booking", lastName: "Order" },
    },
    user_id: MEMBER_ID,
  };
}

function venueApiList(records: VenueFixture[]) {
  return records.map((record) => ({
    capacity: 12,
    description: `Fixture venue ${record.name}`,
    display_order: 1,
    hourly_rate: "1200",
    icon_key: "gym-area",
    id: record.venueId,
    is_active: true,
    is_mapped: true,
    is_reservable: true,
    minimum_hours: 1,
    name: record.name,
    type: "other",
  }));
}

function appointmentApiRecord(record: AppointmentFixture) {
  return {
    active_payment_id: `payment-${record.id}`,
    active_payment_provider: "paymongo",
    active_payment_status: "completed",
    coach: {
      display_name: record.coachName,
      hourly_rate: "1200",
    },
    coach_id: COACH_ID,
    duration_minutes: 60,
    id: record.id,
    member_notes: `Fixture appointment ${record.coachName}`,
    scheduled_at: record.scheduledAt,
    status: record.status,
    total_amount: "1200",
  };
}

function pageSlice<T>(records: T[], url: URL) {
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? String(API_PAGE_SIZE));
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : API_PAGE_SIZE;
  const start = (safePage - 1) * safeLimit;
  return {
    data: records.slice(start, start + safeLimit),
    limit: safeLimit,
    page: safePage,
    total: records.length,
    total_pages: Math.ceil(records.length / safeLimit),
  };
}

async function installBookingFixtures(
  page: Page,
  state: FixtureState,
  options: FixtureOptions = {},
) {
  const mode = options.mode ?? "full";
  const venueRecords = buildVenueFixtures(mode, options.includeUnavailableVenue);
  const appointmentRecords = buildAppointmentFixtures(mode);
  const cancelledBookingIds = new Set<string>();
  const venuePages = () =>
    venueRecords.map((record) => venueApiRecord(record, cancelledBookingIds));
  const appointmentPages = appointmentRecords.map(appointmentApiRecord);

  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));

  await page.addInitScript((fixedBaseMs) => {
    const nativeDateNow = Date.now.bind(Date);
    const nativeStartMs = nativeDateNow();
    window.localStorage.setItem("fittrack_access_token", "booking-order-access-token");
    window.localStorage.setItem("fittrack_refresh_token", "booking-order-refresh-token");
    Date.now = () => fixedBaseMs + (nativeDateNow() - nativeStartMs);
  }, FIXED_NOW);

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    state.observedRequests.push(`${method} ${path}${url.search}`);

    if (method !== "GET") {
      const cancellationMatch = path.match(
        /^\/v1\/bookings\/amenity\/([^/]+)\/cancel$/,
      );
      if (method === "PATCH" && cancellationMatch) {
        cancelledBookingIds.add(cancellationMatch[1]);
        state.mutations.push({ method, path });
        await fulfill(route, { message: "Reservation cancelled." });
        return;
      }
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
      const pageData = pageSlice([], url);
      await fulfillPaginated(route, [], pageData);
      return;
    }
    if (path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (path === "/v1/membership/my-subscription") {
      await fulfill(route, {
        id: "membership-booking-order-fixture",
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
      const currentVenueRecords = options.includeUnavailableVenue
        ? venueRecords.filter((record) => record.id !== UNAVAILABLE_BOOKING_ID)
        : venueRecords;
      await fulfill(route, venueApiList(currentVenueRecords));
      return;
    }
    if (path === "/v1/bookings/amenity/my") {
      const pageData = pageSlice(venuePages(), url);
      state.paginationRequests.push({ path, page: pageData.page, limit: pageData.limit });
      if (options.failBookingsPage2 && pageData.page === 2) {
        const failure = `GET ${path}${url.search}`;
        state.failures.push(failure);
        await fulfill(route, { message: "Later reservations page failed." }, 503);
        return;
      }
      await fulfillPaginated(route, pageData.data, pageData);
      return;
    }
    if (path === "/v1/coaching/appointments/my") {
      const pageData = pageSlice(appointmentPages, url);
      state.paginationRequests.push({ path, page: pageData.page, limit: pageData.limit });
      if (options.failAppointmentsPage2 && pageData.page === 2) {
        const failure = `GET ${path}${url.search}`;
        state.failures.push(failure);
        await fulfill(route, { message: "Later appointments page failed." }, 503);
        return;
      }
      await fulfillPaginated(route, pageData.data, pageData);
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function enterBookings(page: Page, state: FixtureState) {
  await page.goto(`${MOBILE_BASE_URL}/bookings`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/bookings(?:\?|$)/);
  await expect(page.getByText("Bookings", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: "Search bookings" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("bookings-scroll")).toBeVisible({ timeout: 20_000 });
  await stabilizeVisualPage(page);
  expect(state.unhandled, "booking fixture requests before interaction").toEqual([]);
}

async function tapHeaderMenu(page: Page) {
  const helpButton = page.getByRole("button", {
    name: "Open page help",
    exact: true,
  });
  await expect(helpButton, "header help control").toHaveCount(1);
  const header = helpButton.locator("xpath=../..");
  await expect(header, "header container from help control").toHaveCount(1);
  const directHeaderPressables = header.locator(
    ":scope > button, :scope > [role='button'], :scope > [tabindex='0']",
  );
  await expect(directHeaderPressables, "direct header pressables").toHaveCount(1);
  const menuButton = directHeaderPressables.first();
  const menuIcon = menuButton.locator(
    'svg:has(> path[d="M4 5h16"]):has(> path[d="M4 12h16"]):has(> path[d="M4 19h16"])',
  );
  await expect(menuIcon, "header hamburger icon").toHaveCount(1);
  const box = await menuButton.boundingBox();
  expect(box, "header hamburger bounds").not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(box.width, "header hamburger width").toBeGreaterThan(0);
  expect(box.height, "header hamburger height").toBeGreaterThan(0);
  expect(box.x, "header hamburger left bound").toBeGreaterThanOrEqual(0);
  expect(box.y, "header hamburger top bound").toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, "header hamburger right bound").toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(box.y + box.height, "header hamburger bottom bound").toBeLessThanOrEqual(viewport?.height ?? 0);
  const hitTarget = await menuButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const point = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return Boolean(point && (point === element || element.contains(point)));
  });
  expect(hitTarget, "header hamburger hit target").toBe(true);
  await menuButton.tap();
}

async function readScrollMetrics(scroll: ReturnType<Page["getByTestId"]>) {
  return scroll.evaluate((element) => {
    const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
    const scrollable = nodes.find((node) => node.scrollHeight > node.clientHeight + 4);
    const target = scrollable ?? element;
    return {
      clientHeight: target.clientHeight,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
    };
  });
}

async function swipeBookingsContent(page: Page, scroll: ReturnType<Page["getByTestId"]>) {
  const box = await scroll.boundingBox();
  expect(box, "bookings scroll bounds").not.toBeNull();
  if (!box) return;
  const startX = box.x + box.width / 2;
  const startY = box.y + Math.min(260, Math.max(80, box.height - 40));
  const endY = Math.max(box.y + 24, startY - 360);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    const progress = step / 12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: startX, y: startY + (endY - startY) * progress }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

async function ensureBookingsScrolled(page: Page) {
  const scroll = page.getByTestId("bookings-scroll");
  const initialMetrics = await readScrollMetrics(scroll);
  expect(initialMetrics.scrollHeight, "booking content should be scrollable").toBeGreaterThan(
    initialMetrics.clientHeight + 4,
  );
  if (initialMetrics.scrollTop <= 4) await swipeBookingsContent(page, scroll);
  await expect
    .poll(async () => (await readScrollMetrics(scroll)).scrollTop)
    .toBeGreaterThan(4);
  await expect
    .poll(async () => {
      const before = await readScrollMetrics(scroll);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      const after = await readScrollMetrics(scroll);
      return Math.abs(after.scrollTop - before.scrollTop) < 0.5;
    })
    .toBe(true);
  return scroll;
}

async function openBookingFilters(page: Page) {
  const open = page.getByRole("button", { name: "Open booking filters", exact: true });
  if (await open.isVisible().catch(() => false)) {
    await open.click();
  }
  await expect(page.getByText("Status", { exact: true })).toBeVisible();
}

async function selectSection(page: Page, label: "Appointments" | "Reservations") {
  const section = page.getByRole("tab", { name: `View: ${label}`, exact: true });
  await expect(section).toBeVisible();
  await section.tap();
}

async function selectStatus(page: Page, label: "All" | "Completed") {
  const status = page.getByRole("button", { name: `Status: ${label}`, exact: true });
  await expect(status).toBeVisible();
  await status.tap();
}

async function chooseCalendarDate(page: Page, day: string) {
  await expect(page.getByText("September 2026", { exact: true })).toBeVisible();
  const dayButton = page.getByRole("button", { name: day, exact: true }).last();
  await expect(dayButton).toBeVisible();
  await dayButton.tap();
  await expect(page.getByText("September 2026", { exact: true })).toBeHidden();
}

async function chooseDateFilter(page: Page, which: "end" | "start", day: string) {
  const label = which === "start" ? "Start date: All Dates" : "End date: Due Date";
  await page.getByRole("button", { name: label, exact: true }).tap();
  await chooseCalendarDate(page, day);
}

async function goToPage(page: Page, targetPage: number, totalPages: number) {
  for (let pageNumber = 1; pageNumber < targetPage; pageNumber += 1) {
    const next = page.getByRole("button", { name: "Next page", exact: true });
    await expect(next).toBeEnabled();
    await next.scrollIntoViewIfNeeded();
    await next.tap();
    await expect(page.getByText(`${pageNumber + 1} / ${totalPages}`, { exact: true })).toBeVisible();
  }
}

async function assertRenderedOrder(page: Page, labels: string[]) {
  const body = await page.locator("body").innerText();
  let previousIndex = -1;
  for (const label of labels) {
    const index = body.indexOf(label);
    expect(index, `rendered booking label ${label}`).toBeGreaterThan(-1);
    expect(index, `${label} should follow the prior rendered row`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

function assertLoadedPages(state: FixtureState, path: string) {
  const pages = state.paginationRequests
    .filter((request) => request.path === path)
    .map((request) => request.page);
  expect(pages, `${path} should load API pages 1 and 2`).toEqual(expect.arrayContaining([1, 2]));
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: FixtureState,
  name: string,
) {
  const audit = await auditConventionalLayout(page);
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "bookings-order");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );
  const evidence = {
    audit,
    failures: state.failures,
    mutations: state.mutations,
    observedRequests: state.observedRequests,
    route: await page.url(),
    unhandled: state.unhandled,
  };
  await writeFile(
    resolve(evidenceRoot, `${safeName}.layout.json`),
    JSON.stringify(evidence, null, 2),
  );
  await testInfo.attach(`${name}-layout.json`, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    fullPage: true,
    path: resolve(evidenceRoot, `${safeName}.png`),
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

function assertFixtureClosed(
  state: FixtureState,
  expectedMutations: Array<{ method: string; path: string }> = [],
) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.mutations, "unexpected booking mutations").toEqual(
    expectedMutations,
  );
  const unexpectedConsoleErrors = state.consoleErrors.filter(
    (message) => !/503 \(Service Unavailable\)/i.test(message),
  );
  expect(unexpectedConsoleErrors, "unexpected booking route console errors").toEqual([]);
}

test.describe("timeline data", () => {
  test("loads every venue page and renders today, future, and history in timeline order", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    test.setTimeout(90_000);
    const state = newFixtureState();
    await installBookingFixtures(page, state);
    await enterBookings(page, state);

    await expect(page.getByText("Today Early Venue", { exact: true })).toBeVisible();
    await expect(page.getByText("Today Late Venue", { exact: true })).toBeVisible();
    assertLoadedPages(state, "/v1/bookings/amenity/my");
    await assertRenderedOrder(page, [
      "Today Early Venue",
      "Today Tie A Venue",
      "Today Tie B Venue",
      "Today Mid Venue",
      "Today Late Venue",
      "Future Venue 000",
    ]);

    await goToPage(page, 11, 11);
    await expect(page.getByText("History Evening Venue", { exact: true })).toBeVisible();
    await expect(page.getByText("History Old Venue", { exact: true })).toBeVisible();
    await assertRenderedOrder(page, [
      "History Evening Venue",
      "History Mid Venue",
      "History Morning Venue",
      "History Early Venue",
      "History Old Venue",
    ]);
    assertFixtureClosed(state);
  });

  test("loads the complete appointment section and orders current, future, and history rows", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    test.setTimeout(90_000);
    const state = newFixtureState();
    await installBookingFixtures(page, state);
    await enterBookings(page, state);

    await openBookingFilters(page);
    await selectSection(page, "Appointments");
    await expect(page.getByText("Appointment Early Coach", { exact: true })).toBeVisible();
    await expect(page.getByText("Appointment Late Coach", { exact: true })).toBeVisible();
    assertLoadedPages(state, "/v1/coaching/appointments/my");
    await assertRenderedOrder(page, [
      "Appointment Early Coach",
      "Appointment Tie A Coach",
      "Appointment Tie B Coach",
      "Appointment Mid Coach",
      "Appointment Late Coach",
      "Future Coach 000",
    ]);

    await goToPage(page, 11, 11);
    await expect(page.getByText("Appointment History Evening", { exact: true })).toBeVisible();
    await expect(page.getByText("Appointment History Old", { exact: true })).toBeVisible();
    await assertRenderedOrder(page, [
      "Appointment History Evening",
      "Appointment History Mid",
      "Appointment History Morning",
      "Appointment History Early",
      "Appointment History Old",
    ]);
    assertFixtureClosed(state);
  });

  test("keeps only-past reservations visible and reports an empty appointment section", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installBookingFixtures(page, state, { mode: "pastOnly" });
    await enterBookings(page, state);

    await expect(page.getByText("History Evening Venue", { exact: true })).toBeVisible();
    await expect(page.getByText("Today Early Venue", { exact: true })).toHaveCount(0);
    await openBookingFilters(page);
    await selectSection(page, "Appointments");
    await expect(page.getByText("No appointments found", { exact: true })).toBeVisible();
    await expect(page.getByText("Appointment Early Coach", { exact: true })).toHaveCount(0);
    assertFixtureClosed(state);
  });

  test("fails the complete list when a later venue or appointment page fails", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installBookingFixtures(page, state, {
      failAppointmentsPage2: true,
      failBookingsPage2: true,
    });
    await enterBookings(page, state);

    await expect(page.getByText("Reservations unavailable", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Today Early Venue", { exact: true })).toHaveCount(0);
    assertLoadedPages(state, "/v1/bookings/amenity/my");

    await openBookingFilters(page);
    await selectSection(page, "Appointments");
    await expect(page.getByText("Appointments unavailable", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Appointment Early Coach", { exact: true })).toHaveCount(0);
    assertLoadedPages(state, "/v1/coaching/appointments/my");
    assertFixtureClosed(state);
  });
});

test("keeps an unavailable venue booking resolvable and cancellable", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const state = newFixtureState();
  await installBookingFixtures(page, state, { includeUnavailableVenue: true });
  await enterBookings(page, state);

  const bookingCard = page.getByRole("button", {
    name: /Maintenance Court/,
  });
  await expect(bookingCard).toBeVisible();
  await bookingCard.tap();

  const details = page
    .getByRole("dialog")
    .filter({ hasText: "Reservation Details" });
  await expect(details).toBeVisible();
  await expect(details).toContainText("Maintenance Court");
  const cancelButton = details.getByRole("button", {
    name: "Cancel Reservation",
    exact: true,
  });
  await expect(cancelButton).toBeEnabled();
  await cancelButton.tap();

  const confirmation = page
    .getByRole("dialog")
    .filter({ hasText: "Cancel reservation?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Maintenance Court");

  const cancelRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname ===
        `/v1/bookings/amenity/${UNAVAILABLE_BOOKING_ID}/cancel`,
  );
  await confirmation
    .getByRole("button", { name: "Confirm Cancel", exact: true })
    .tap();
  const request = await cancelRequest;
  expect(new URL(request.url()).pathname).toBe(
    `/v1/bookings/amenity/${UNAVAILABLE_BOOKING_ID}/cancel`,
  );

  await expect(details).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Maintenance Court.*Cancelled/ }),
  ).toBeVisible();

  const audit = await captureEvidence(
    page,
    testInfo,
    state,
    "unavailable-venue-cancelled",
  );
  assertCleanLayout(audit);
  assertFixtureClosed(state, [
    {
      method: "PATCH",
      path: `/v1/bookings/amenity/${UNAVAILABLE_BOOKING_ID}/cancel`,
    },
  ]);
});

test.describe("pagination lifecycle", () => {
  test("resets page and scroll after navigating to Settings and returning to Bookings", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installBookingFixtures(page, state);
    await enterBookings(page, state);

    await goToPage(page, 2, 11);
    const scroll = await ensureBookingsScrolled(page);
    await expect(page.getByText("2 / 11", { exact: true })).toBeVisible();
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Bookings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Bookings", exact: true }).tap();
    await expect(page).toHaveURL(/\/bookings(?:\?|$)/);
    await expect(page.getByText("1 / 11", { exact: true })).toBeVisible();
    await expect(page.getByText("Today Early Venue", { exact: true })).toBeVisible();
    await expect
      .poll(async () => (await readScrollMetrics(scroll)).scrollTop)
      .toBeLessThan(4);
    assertFixtureClosed(state);
  });

  test("resets page and scroll for search, status, date filters, and clear", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installBookingFixtures(page, state);
    await enterBookings(page, state);

    await goToPage(page, 2, 11);
    const scroll = await ensureBookingsScrolled(page);
    await openBookingFilters(page);

    await selectStatus(page, "Completed");
    await expect(page.getByText("History Evening Venue", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page", exact: true })).toHaveCount(0);
    await expect
      .poll(async () => (await readScrollMetrics(scroll)).scrollTop)
      .toBeLessThan(4);

    await selectStatus(page, "All");
    await expect(page.getByText("1 / 11", { exact: true })).toBeVisible();
    await chooseDateFilter(page, "start", "8");
    await chooseDateFilter(page, "end", "9");
    await expect(page.getByText("Today Early Venue", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page", exact: true })).toHaveCount(0);
    await expect
      .poll(async () => (await readScrollMetrics(scroll)).scrollTop)
      .toBeLessThan(4);

    await page.getByRole("button", { name: "Reset start date filter", exact: true }).tap();
    await page.getByRole("button", { name: "Reset end date filter", exact: true }).tap();
    await expect(page.getByText("1 / 11", { exact: true })).toBeVisible();

    const search = page.getByRole("textbox", { name: "Search bookings", exact: true });
    await search.fill("Future Venue 050");
    await expect(page.getByText("Future Venue 050", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page", exact: true })).toHaveCount(0);
    await expect
      .poll(async () => (await readScrollMetrics(scroll)).scrollTop)
      .toBeLessThan(4);
    await page.getByRole("button", { name: "Clear search bookings", exact: true }).tap();
    await expect(page.getByText("1 / 11", { exact: true })).toBeVisible();
    await expect(page.getByText("Today Early Venue", { exact: true })).toBeVisible();
    assertFixtureClosed(state);
  });

  test("booking timeline stays readable at 320px and canonical 390px widths", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installBookingFixtures(page, state);
    await enterBookings(page, state);
    await expect(page.getByText("Today Early Venue", { exact: true })).toBeVisible();
    await expect(page.getByText("Today Late Venue", { exact: true })).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, `responsive-${testInfo.project.name}`);
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });
});
