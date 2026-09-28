import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  installMemberResponsiveFixtures,
  MOBILE_RESPONSIVE_BASE_URL,
  newFixtureState,
} from "./mobile-responsive-fixtures";
import { stabilizeVisualPage } from "./visual-stabilizer";

const ALEXANDRA_ID = "11111111-1111-4111-8111-111111111111";
const BLAIR_ID = "22222222-2222-4222-8222-222222222222";
const CASEY_ID = "33333333-3333-4333-8333-333333333333";
const MONTHLY_CHECKOUT_HOLD_ID = "monthly-coaching-checkout-hold";
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_TYPE =
  "RECURRING_COACHING_ACTIVE_ENTITLEMENT";
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_KIND = "active_entitlement";
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_DETAIL =
  "This member already has an active or paused recurring coaching entitlement with the selected coach.";
const GENERIC_MONTHLY_CONFLICT_DETAIL =
  "A different monthly enrollment conflict occurred.";

function coach(id: string, name: string, rate: string, specialties: string[], rating: string, count: number, monthly: boolean) {
  return {
    average_rating: rating,
    availability_slots: [],
    bio: `${name} supports consistent training with a clear, practical plan.`,
    booked_dates: [],
    certification: "Certified Personal Trainer",
    display_name: name,
    hourly_rate: rate,
    id,
    is_available_for_booking: true,
    monthly_offer_active: monthly,
    monthly_rate: monthly ? "4800" : null,
    monthly_session_count: monthly ? 8 : null,
    monthly_session_duration_minutes: monthly ? 60 : null,
    rating_count: count,
    schedule_type: "full_time",
    specialties,
    user: { id, profile: { first_name: name, last_name: "" } },
  };
}

const coaches = [
  coach(ALEXANDRA_ID, "Alexandra Coach", "600", ["Strength", "Mobility"], "4.8", 10, true),
  coach(BLAIR_ID, "Blair Coach", "900", ["Yoga"], "3.5", 2, false),
  coach(CASEY_ID, "Casey Santiago With A Very Long Coach Name", "750", ["Functional Strength and Mobility Coaching"], "4.5", 3, true),
];

function memberWithoutGymMembership() {
  return {
    email: "coaching-only-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: ALEXANDRA_ID,
    phone_no: "+639171234567",
    profile: {
      activity_level: "moderate",
      date_of_birth: "1994-05-20",
      first_name: "Coaching",
      gender: "female",
      height_cm: 165,
      last_name: "Only Member",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

async function setup(
  page: Page,
  options: {
    coachListMode?: "success" | "empty" | "error";
    emptyToday?: boolean;
    holdAlexandraSlots?: Promise<void>;
    holdCoachList?: Promise<void>;
    monthlyEnrollmentError?: "active_entitlement" | "generic_conflict";
    withoutGymMembership?: boolean;
  } = {},
) {
  const state = newFixtureState();
  await installMemberResponsiveFixtures(page, state);
  if (options.withoutGymMembership) {
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open;
    });
    await page.route(
      (url) => {
        const path = new URL(url).pathname;
        return path === "/v1/users/me" || path === "/v1/membership/my-subscription";
      },
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== "GET") {
          state.unhandled.push(`${request.method()} ${url.pathname}${url.search}`);
          await route.abort("blockedbyclient");
          return;
        }
        const data = url.pathname === "/v1/users/me"
          ? memberWithoutGymMembership()
          : null;
        await route.fulfill({
          body: JSON.stringify({ data }),
          contentType: "application/json",
          status: 200,
        });
      },
    );
  }
  await page.route(
    (url) => /^\/v1\/coaching\/coaches(?:\/|$)/.test(new URL(url).pathname),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const requestLabel = `${request.method()} ${path}${url.search}`;
      if (request.method() !== "GET") {
        state.unhandled.push(requestLabel);
        await route.abort("blockedbyclient");
        return;
      }
      if (path === "/v1/coaching/coaches") {
        if (options.holdCoachList) await options.holdCoachList;
        if (options.coachListMode === "error") {
          await route.fulfill({
            body: JSON.stringify({ message: "Unable to load coaches." }),
            contentType: "application/json",
            status: 500,
          });
          return;
        }
        await route.fulfill({
          body: JSON.stringify({ data: options.coachListMode === "empty" ? [] : coaches }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      const availability = path.match(/^\/v1\/coaching\/coaches\/([^/]+)\/availability$/);
      if (availability) {
        if (availability[1] === ALEXANDRA_ID && options.holdAlexandraSlots) {
          await options.holdAlexandraSlots;
        }
        const duration = Number(url.searchParams.get("duration_minutes") ?? "60");
        const date = url.searchParams.get("date") ?? "2026-09-08";
        const endMinutes = 14 * 60 + (Number.isFinite(duration) ? duration : 60);
        const endHour = Math.floor(endMinutes / 60);
        const endMinute = endMinutes % 60;
        const slots = availability[1] === ALEXANDRA_ID && options.holdAlexandraSlots
          ? []
          : options.emptyToday && date === "2026-09-08"
          ? []
          : [{
              available: true,
              conflict_reasons: [],
              duration_minutes: Number.isFinite(duration) ? duration : 60,
              end_at: `${date}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00+08:00`,
              start_at: `${date}T14:00:00+08:00`,
            }];
        await route.fulfill({
          body: JSON.stringify({
            data: slots,
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      const detail = path.match(/^\/v1\/coaching\/coaches\/([^/]+)$/);
      const selected = detail ? coaches.find((item) => item.id === detail[1]) : undefined;
      if (selected) {
        await route.fulfill({
          body: JSON.stringify({ data: selected }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      state.unhandled.push(requestLabel);
      await route.abort("blockedbyclient");
    },
  );

  await page.route(
    "**/v1/bookings/recurring-coaching-plans/enroll",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== "POST") {
        state.unhandled.push(`${request.method()} ${url.pathname}${url.search}`);
        await route.abort("blockedbyclient");
        return;
      }
      let body: unknown;
      try {
        body = request.postDataJSON() ?? {};
      } catch {
        body = {};
      }
      state.mutations.push({ body, method: request.method(), path: url.pathname });
      if (options.monthlyEnrollmentError) {
        const activeEntitlement =
          options.monthlyEnrollmentError === "active_entitlement";
        await route.fulfill({
          body: JSON.stringify({
            conflict_kind: activeEntitlement
              ? ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_KIND
              : "other_conflict",
            detail: activeEntitlement
              ? ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_DETAIL
              : GENERIC_MONTHLY_CONFLICT_DETAIL,
            status: 409,
            title: activeEntitlement
              ? "Recurring Coaching Enrollment Already Exists"
              : "Monthly enrollment conflict",
            type: activeEntitlement
              ? ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_TYPE
              : "CONFLICT",
          }),
          contentType: "application/json",
          status: 409,
        });
        return;
      }
      await route.fulfill({
        body: JSON.stringify({
          data: {
            checkout_url: "https://checkout.example/monthly-coaching",
            expires_at: "2026-09-08T04:15:00.000Z",
            hold_id: MONTHLY_CHECKOUT_HOLD_ID,
            kind: "monthly",
            recurring_plan_id: "recurring-plan-checkout-1",
            state: "pending",
            status: "pending",
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.route(
    `**/v1/payments/checkout-holds/${MONTHLY_CHECKOUT_HOLD_ID}`,
    async (route) => {
      if (route.request().method() !== "GET") {
        state.unhandled.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        );
        await route.abort("blockedbyclient");
        return;
      }
      await route.fulfill({
        body: JSON.stringify({
          data: {
            checkout_url: "https://checkout.example/monthly-coaching",
            expires_at: "2026-09-08T04:15:00.000Z",
            hold_id: MONTHLY_CHECKOUT_HOLD_ID,
            kind: "monthly",
            recurring_plan_id: "recurring-plan-checkout-1",
            state: "pending",
            status: "pending",
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  return state;
}

async function openTrainer(page: Page) {
  await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: /Book a Trainer/i }).click();
  const card = page.getByTestId("appointment-modal-card");
  await expect(card).toBeVisible();
  return card;
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await stabilizeVisualPage(page);
  await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
}

test("Book a Trainer renders an inline expandable coach list", async ({ page }, testInfo) => {
  const state = await setup(page);
  await openTrainer(page);
  await screenshot(page, testInfo, "duration-options.png");
  const alexandra = page.getByRole("button", { name: "Alexandra Coach", exact: true });
  const blair = page.getByRole("button", { name: "Blair Coach", exact: true });
  await expect(alexandra).toBeVisible();
  await alexandra.click();
  await expect(alexandra).toHaveAttribute("aria-expanded", "true");
  const alexandraDetails = page.getByTestId(`coach-details-${ALEXANDRA_ID}`);
  await expect(alexandraDetails).toBeVisible();
  await alexandraDetails.scrollIntoViewIfNeeded();
  await screenshot(page, testInfo, "coach-expanded.png");
  await alexandra.click();
  await expect(alexandra).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId(`coach-details-${"11111111-1111-4111-8111-111111111111"}`)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeEnabled();
  await blair.click();
  await expect(blair).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId(`coach-details-${"22222222-2222-4222-8222-222222222222"}`)).toBeVisible();
  await expect(page.getByTestId(`coach-details-${"11111111-1111-4111-8111-111111111111"}`)).not.toBeVisible();
  await page.getByPlaceholder("Search coaches or specialties").fill("zzz");
  await expect(page.getByText("Selected coach", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blair Coach", exact: true })).toHaveCount(1);
  await page.getByPlaceholder("Search coaches or specialties").fill("");
  await expect(page.getByRole("button", { name: "Alexandra Coach", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blair Coach", exact: true })).toBeVisible();
  const casey = page.getByRole("button", { name: "Casey Santiago With A Very Long Coach Name", exact: true });
  await casey.click();
  await page.getByTestId(`coach-details-${CASEY_ID}`).scrollIntoViewIfNeeded();
  await screenshot(page, testInfo, "coach-long-name.png");
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer filters and resets inline coach selection", async ({ page }) => {
  const state = await setup(page);
  await openTrainer(page);
  await page.getByRole("button", { name: "Show coach filters", exact: true }).click();
  await page.getByRole("button", { name: "Mobility", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blair Coach", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "4+ stars", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mobility", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "4+ stars", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide coach filters", exact: true }).getByText("2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide coach filters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mobility", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Show coach filters", exact: true }).click();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blair Coach", exact: true })).toBeVisible();
  const search = page.getByPlaceholder("Search coaches or specialties");
  await search.fill("no matching coach");
  await expect(page.getByText("No coaches match your search or filters.", { exact: true })).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Open quick actions menu", exact: true }).click();
  await page.getByRole("button", { name: /Book a Trainer/i }).click();
  await expect(page.getByPlaceholder("Search coaches or specialties")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Show coach filters", exact: true })).toBeVisible();
  await expect(page.getByTestId(`coach-details-${ALEXANDRA_ID}`)).not.toBeVisible();
  await expect(page.getByTestId(`coach-details-${BLAIR_ID}`)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeDisabled();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer handles deferred empty coach loading", async ({ page }) => {
  let releaseCoachList!: () => void;
  const coachListReady = new Promise<void>((resolve) => {
    releaseCoachList = resolve;
  });
  const state = await setup(page, {
    coachListMode: "empty",
    holdCoachList: coachListReady,
  });
  await openTrainer(page);
  await expect(page.getByText("Loading available coaches...", { exact: true })).toBeVisible();
  releaseCoachList();
  await expect(page.getByText("No coaches are available to book right now.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeDisabled();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer retries a failed coach list", async ({ page }) => {
  const options: Parameters<typeof setup>[1] = { coachListMode: "error" };
  const state = await setup(page, options);
  await openTrainer(page);
  await expect(page.getByText("Unable to load coaches.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  options.coachListMode = "success";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("button", { name: "Alexandra Coach", exact: true })).toBeVisible();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer ignores stale availability after changing coaches", async ({ page }) => {
  let releaseAlexandra!: () => void;
  const alexandraSlotsReady = new Promise<void>((resolve) => {
    releaseAlexandra = resolve;
  });
  const state = await setup(page, { holdAlexandraSlots: alexandraSlotsReady });
  await openTrainer(page);
  const alexandraResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/v1/coaching/coaches/${ALEXANDRA_ID}/availability`),
  );
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await expect.poll(() => state.observedRequests.some((request) => request.includes(`/coaching/coaches/${ALEXANDRA_ID}/availability`))).toBeTruthy();
  await page.getByRole("button", { name: "Blair Coach", exact: true }).click();
  await expect(page.getByTestId(`coach-details-${BLAIR_ID}`).getByText(/1 time available/)).toBeVisible();
  releaseAlexandra();
  await alexandraResponse;
  await expect(page.getByTestId(`coach-details-${BLAIR_ID}`)).toBeVisible();
  await expect(page.getByTestId(`coach-details-${ALEXANDRA_ID}`)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeEnabled();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer preserves single-session pricing and clears stale time", async ({ page }, testInfo) => {
  const state = await setup(page);
  await openTrainer(page);
  await page.getByRole("button", { name: "Select 30-minute session duration", exact: true }).click();
  await page.getByRole("button", { name: "Blair Coach", exact: true }).click();
  await page.getByRole("button", { name: "Choose date & time", exact: true }).click();
  await page.getByRole("button", { name: /^Select appointment time slot/ }).click();
  await page.getByRole("button", { name: /^0?2:00 PM,/ }).click();
  await expect(page.getByTestId("appointment-modal-card")).toContainText("PHP 900 / hour");
  await expect(page.getByTestId("appointment-modal-card")).toContainText("30 minutes");
  await expect(page.getByText("PHP 450", { exact: true })).toHaveCount(2);
  await screenshot(page, testInfo, "schedule.png");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const control of [
    page.getByTestId("appointment-modal-card"),
    page.getByRole("button", { name: "Back", exact: true }),
    page.getByRole("button", { name: "Review & pay", exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth) + 1,
  );
  await page.getByTestId("appointment-modal-body").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await screenshot(page, testInfo, "schedule-payment.png");
  await page.getByRole("button", { name: "Review & pay", exact: true }).click();
  await expect(page.getByText("Book and pay in full?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId(`coach-details-${BLAIR_ID}`)).toBeVisible();
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await page.getByRole("button", { name: "Choose date & time", exact: true }).click();
  await expect(page.getByRole("button", { name: /Current selection none/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review & pay", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /^Select appointment time slot/ }).click();
  await page.getByRole("button", { name: /^0?2:00 PM,/ }).click();
  await expect(page.getByText("PHP 300", { exact: true })).toHaveCount(2);
  expect(state.observedRequests.some((request) => request.includes(`/coaching/coaches/${ALEXANDRA_ID}/availability`) && request.includes("duration_minutes=30"))).toBeTruthy();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer can move from no times today to a future date", async ({ page }) => {
  const state = await setup(page, { emptyToday: true });
  await openTrainer(page);
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await expect(page.getByText(/No 60-minute slots/i)).toBeVisible();
  await page.getByRole("button", { name: "Choose date & time", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review & pay", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /^Select appointment date/ }).click();
  await page.getByRole("button", { name: "9", exact: true }).click();
  await page.getByRole("button", { name: /^Select appointment time slot/ }).click();
  await page.getByRole("button", { name: /^0?2:00 PM,/ }).click();
  await expect(page.getByRole("button", { name: "Review & pay", exact: true })).toBeEnabled();
  await expect(page.getByTestId("appointment-modal-card")).not.toContainText(/canonical|live profiles|allocation/i);
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer exposes monthly offers and confirmation details", async ({ page }, testInfo) => {
  const state = await setup(page);
  await openTrainer(page);
  await page.getByRole("button", { name: "Select booking mode: Monthly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blair Coach", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  const alexandraDetails = page.getByTestId(`coach-details-${ALEXANDRA_ID}`);
  await expect(alexandraDetails).toContainText("PHP 4,800");
  await expect(alexandraDetails).toContainText("8 sessions");
  const startDate = page.getByRole("button", { name: /^Monthly coaching start date/ });
  await expect(startDate).toBeVisible();
  await startDate.click();
  await page.getByRole("button", { name: "9", exact: true }).click();
  await expect(page.getByRole("button", { name: /Monthly coaching start date.*Wed, Sep 9, 2026/ })).toBeVisible();
  await alexandraDetails.scrollIntoViewIfNeeded();
  await startDate.scrollIntoViewIfNeeded();
  await screenshot(page, testInfo, "monthly.png");
  await page.getByRole("button", { name: "Confirm & Pay", exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "Confirm monthly booking?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Alexandra Coach");
  await expect(confirmation).toContainText("PHP 4,800");
  await expect(confirmation).toContainText("8 sessions");
  await expect(confirmation).toContainText("Wed, Sep 9, 2026");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Select booking mode: Single Session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeDisabled();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.mutations).toEqual([]);
});

test("Book a Trainer monthly checkout does not require a gym membership", async ({ page }) => {
  const state = await setup(page, { withoutGymMembership: true });
  await openTrainer(page);
  await page.getByRole("button", { name: "Select booking mode: Monthly", exact: true }).click();
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();

  const alexandraDetails = page.getByTestId(`coach-details-${ALEXANDRA_ID}`);
  await expect(alexandraDetails).toContainText("PHP 4,800");
  const startDate = page.getByRole("button", { name: /^Monthly coaching start date/ });
  await startDate.click();
  await page.getByRole("button", { name: "9", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Monthly coaching start date.*Wed, Sep 9, 2026/ }),
  ).toBeVisible();

  await expect(
    page.getByText(
      /active membership is required|checking.*membership|checking active membership/i,
    ),
  ).toHaveCount(0);
  const confirmAndPay = page.getByRole("button", {
    name: "Confirm & Pay",
    exact: true,
  });
  await expect(confirmAndPay).toBeEnabled();
  await confirmAndPay.click();

  const confirmation = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm monthly booking?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Alexandra Coach");
  await expect(confirmation).toContainText("PHP 4,800");

  const enrollRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname ===
        "/v1/bookings/recurring-coaching-plans/enroll",
  );
  await confirmation
    .getByRole("button", { name: "Confirm & Pay", exact: true })
    .click();
  const request = await enrollRequest;
  expect(request.postDataJSON()).toEqual({
    coach_id: ALEXANDRA_ID,
    return_target: "expo_web",
    return_url: new URL("/bookings", MOBILE_RESPONSIVE_BASE_URL).toString(),
    start_date: "2026-09-09",
  });
  expect(request.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(
    page.getByRole("dialog").filter({ hasText: "PayMongo checkout opened" }),
  ).toBeVisible();
  expect(state.mutations).toEqual([
    {
      body: {
        coach_id: ALEXANDRA_ID,
        return_target: "expo_web",
        return_url: new URL("/bookings", MOBILE_RESPONSIVE_BASE_URL).toString(),
        start_date: "2026-09-09",
      },
      method: "POST",
      path: "/v1/bookings/recurring-coaching-plans/enroll",
    },
  ]);
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.requestFailures).toEqual([]);
});

test("Book a Trainer shows a visible notice for an existing monthly coach", async ({ page }, testInfo) => {
  const state = await setup(page, {
    monthlyEnrollmentError: "active_entitlement",
  });
  await openTrainer(page);
  await page.getByRole("button", { name: "Select booking mode: Monthly", exact: true }).click();
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await page.getByRole("button", { name: /^Monthly coaching start date/ }).click();
  await page.getByRole("button", { name: "9", exact: true }).click();

  await page.getByRole("button", { name: "Confirm & Pay", exact: true }).click();
  const confirmation = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm monthly booking?" });
  await expect(confirmation).toBeVisible();
  const enrollmentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/v1/bookings/recurring-coaching-plans/enroll",
  );
  await confirmation
    .getByRole("button", { name: "Confirm & Pay", exact: true })
    .click();
  expect((await enrollmentResponse).status()).toBe(409);

  const notice = page
    .getByRole("dialog")
    .filter({ hasText: "Monthly coaching already booked" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "You already have a monthly coaching booking for this period.",
  );
  await expect(notice).toContainText(
    "You can only have one monthly coach at a time.",
  );
  await expect(notice).toContainText("You can still book single sessions.");
  await expect(notice.getByRole("button", { name: "Got It", exact: true })).toBeVisible();
  await expect(
    page.getByRole("dialog").filter({ hasText: "PayMongo checkout opened" }),
  ).toHaveCount(0);
  expect(state.mutations).toHaveLength(1);

  await screenshot(page, testInfo, "monthly-conflict-notice.png");
  await notice.getByRole("button", { name: "Got It", exact: true }).click();
  await expect(notice).not.toBeVisible();
  await expect(page.getByTestId(`coach-details-${ALEXANDRA_ID}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Monthly coaching start date/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select booking mode: Single Session", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Choose date & time", exact: true })).toBeDisabled();
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.requestFailures).toEqual([]);
});

test("Book a Trainer keeps unrelated monthly conflicts on the generic error path", async ({ page }) => {
  const state = await setup(page, {
    monthlyEnrollmentError: "generic_conflict",
  });
  await openTrainer(page);
  await page.getByRole("button", { name: "Select booking mode: Monthly", exact: true }).click();
  await page.getByRole("button", { name: "Alexandra Coach", exact: true }).click();
  await page.getByRole("button", { name: /^Monthly coaching start date/ }).click();
  await page.getByRole("button", { name: "9", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Pay", exact: true }).click();

  const confirmation = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm monthly booking?" });
  const enrollmentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/v1/bookings/recurring-coaching-plans/enroll",
  );
  await confirmation
    .getByRole("button", { name: "Confirm & Pay", exact: true })
    .click();
  expect((await enrollmentResponse).status()).toBe(409);

  await expect(page.getByText(GENERIC_MONTHLY_CONFLICT_DETAIL, { exact: true })).toBeVisible();
  await expect(page.getByText("Monthly coaching already booked", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Got It", exact: true })).toHaveCount(0);
  expect(state.mutations).toHaveLength(1);
  expect(state.unhandled).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.requestFailures).toEqual([]);
});
