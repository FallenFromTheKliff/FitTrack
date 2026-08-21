import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";

const execAsync = promisify(exec);
const fixturePath = resolve(
  process.cwd(),
  ".artifacts",
  "venue-maintenance-e2e-fixture.json",
);
const apiDirectory = resolve(process.cwd(), "apps", "api");
const mobileBaseUrl = "http://127.0.0.1:8081";

type FixtureManifest = {
  admin: { email: string; password: string };
  bookingCancelId: string;
  bookingRescheduleId: string;
  member: { email: string; password: string };
  paymentCancelId: string;
  paymentRescheduleId: string;
  replacementVenueId: string;
  replacementVenueName: string;
  sourceVenueId: string;
  sourceVenueName: string;
};

type FixtureInspection = {
  audit: Array<{ action: string; after: unknown; entityId: string }>;
  bookings: Array<{
    amenityId: string;
    cancellationReason: string | null;
    id: string;
    status: string;
    totalAmount: string;
  }>;
  notifications: Array<{ title: string; type: string }>;
  payments: Array<{
    amount: string;
    id: string;
    payableId: string;
    status: string;
  }>;
  sourceVenueStatus: string | null;
};

let fixture: FixtureManifest;

async function runFixture(command: "apply" | "cleanup" | "inspect") {
  const { stdout } = await execAsync(
    `${process.platform === "win32" ? "pnpm.cmd" : "pnpm"} run db:fixture:venue-maintenance:${command}`,
    { cwd: apiDirectory, maxBuffer: 1024 * 1024 },
  );
  const jsonLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith("{"));
  return jsonLine ? (JSON.parse(jsonLine) as unknown) : null;
}

async function inspectFixture() {
  return (await runFixture("inspect")) as FixtureInspection;
}

async function loginWeb(page: Page, credential: FixtureManifest["admin"]) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname !== "/login", {
    timeout: 60_000,
  });
}

async function loginWebMember(page: Page) {
  await page.goto("/member-login");
  await page.getByLabel("Email Address").fill(fixture.member.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(fixture.member.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname !== "/member-login", {
    timeout: 60_000,
  });
}

async function loginMobileMember(page: Page) {
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(fixture.member.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(fixture.member.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 60_000 });
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`${name}.png`),
  });
}

function tomorrowYmd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function openFacilitiesVenue(page: Page) {
  await page.getByRole("link", { name: "Facilities", exact: true }).click();
  await page.waitForURL(/\/facilities(?:\?|$)/);
  await page
    .getByRole("button", { name: "Venues", exact: true })
    .first()
    .click();
  await page.getByLabel("Search venues").fill(fixture.sourceVenueName);
  await expect(
    page.getByText(fixture.sourceVenueName, { exact: true }),
  ).toBeVisible();
}

async function openVenueActions(page: Page) {
  await page
    .getByRole("button", {
      name: `More actions for ${fixture.sourceVenueName}`,
    })
    .click();
}

async function openMemberVenuePicker(page: Page) {
  await page.goto("/bookings");
  await page
    .getByRole("button", { name: /make a reservation/i })
    .first()
    .click();
  const reservation = page
    .getByRole("dialog")
    .filter({ hasText: "Make a Reservation" });
  await reservation.getByRole("button", { name: /Reservation venue:/ }).click();
  return page.getByRole("dialog").filter({ hasText: "Select a Venue" });
}

test.beforeAll(async () => {
  await runFixture("apply");
  fixture = JSON.parse(await readFile(fixturePath, "utf8")) as FixtureManifest;
});

test.afterAll(async () => {
  await runFixture("cleanup");
});

test("paid maintenance booking can be marked, rescheduled, cancelled, hidden, and restored", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await loginWeb(page, fixture.admin);

  await openFacilitiesVenue(page);
  await openVenueActions(page);
  await page.getByRole("button", { name: "Mark maintenance" }).click();
  let confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Mark venue for maintenance" });
  await expect(
    confirm.getByText("2 upcoming active bookings require manual resolution."),
  ).toBeVisible();
  await expect(
    confirm.getByText(/Existing bookings will not be automatically cancelled/),
  ).toBeVisible();
  await expect(confirm.getByText(/^E2E ·/)).toHaveCount(2);
  await shot(page, testInfo, "facilities-mark-maintenance-affected-list");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).not.toBeVisible();

  await openVenueActions(page);
  await page.getByRole("button", { name: "Mark maintenance" }).click();
  confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Mark venue for maintenance" });
  await confirm.getByRole("button", { name: "MARK MAINTENANCE" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(
    page.getByText("Unavailable - Maintenance", { exact: true }),
  ).toBeVisible();
  expect((await inspectFixture()).sourceVenueStatus).toBe("maintenance");

  await page.getByRole("link", { name: /Gym Operations|Schedule/ }).click();
  await page.waitForURL(/\/schedule(?:\?|$)/);
  await page.getByRole("tab", { name: "Venue Bookings" }).click();
  const sourceFilter = page.getByLabel(/Venue filter:/);
  await sourceFilter.click();
  await page
    .getByRole("menuitem", { name: fixture.sourceVenueName, exact: true })
    .click();
  const bookingActions = page.locator(
    '[data-ui="gym-operations-review-venue-booking"]',
  );
  await expect(bookingActions).toHaveCount(2);

  await bookingActions.first().click();
  let review = page
    .getByRole("dialog")
    .filter({ hasText: "Review venue booking" });
  await expect(
    review.getByText(/affected by venue maintenance/i),
  ).toBeVisible();
  await review.getByRole("button", { name: "RESCHEDULE" }).click();
  const replacementVenue = review.getByLabel("Maintenance replacement venue");
  await replacementVenue.click();
  await page
    .getByRole("menuitem", { name: "Select replacement venue" })
    .click();
  await review
    .getByRole("button", { name: "Review maintenance resolution" })
    .click();
  await expect(
    review.getByText("Choose an available replacement venue.", { exact: true }),
  ).toBeVisible();
  await replacementVenue.click();
  await page
    .getByRole("menuitem", { name: fixture.replacementVenueName, exact: true })
    .click();
  await review.getByLabel(/Maintenance replacement date:/).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Select ${tomorrowYmd()}` })
    .click();
  await expect(
    review.getByLabel("Maintenance replacement start time"),
  ).not.toHaveText(/Loading/);
  await expect
    .poll(async () =>
      review
        .getByLabel("Maintenance replacement start time")
        .getAttribute("aria-label"),
    )
    .not.toBeNull();
  await review
    .getByRole("button", { name: "Review maintenance resolution" })
    .click();
  let resolutionConfirm = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm maintenance reschedule" });
  await expect(
    resolutionConfirm.getByText(
      /existing paid amount and booking identity will be preserved/i,
    ),
  ).toBeVisible();
  await resolutionConfirm
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(resolutionConfirm).not.toBeVisible();
  await review
    .getByRole("button", { name: "Review maintenance resolution" })
    .click();
  resolutionConfirm = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm maintenance reschedule" });
  await resolutionConfirm
    .getByRole("button", { name: "RESCHEDULE BOOKING" })
    .click();
  await expect(review).not.toBeVisible();

  let state = await inspectFixture();
  const rescheduled = state.bookings.find(
    (booking) => booking.amenityId === fixture.replacementVenueId,
  );
  expect(rescheduled).toBeDefined();
  const rescheduledBookingId = rescheduled!.id;
  const cancelledBookingId =
    rescheduledBookingId === fixture.bookingRescheduleId
      ? fixture.bookingCancelId
      : fixture.bookingRescheduleId;
  const rescheduledPaymentId =
    rescheduledBookingId === fixture.bookingRescheduleId
      ? fixture.paymentRescheduleId
      : fixture.paymentCancelId;
  const cancelledPaymentId =
    cancelledBookingId === fixture.bookingCancelId
      ? fixture.paymentCancelId
      : fixture.paymentRescheduleId;
  expect(rescheduled).toMatchObject({
    amenityId: fixture.replacementVenueId,
    status: "confirmed",
    totalAmount: "700",
  });
  expect(
    state.payments.find((payment) => payment.id === rescheduledPaymentId),
  ).toMatchObject({
    amount: "700",
    payableId: rescheduledBookingId,
    status: "completed",
  });
  expect(state.audit).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "BOOKING_RESCHEDULED",
        entityId: rescheduledBookingId,
      }),
    ]),
  );

  await page
    .getByRole("button", { name: "OK", exact: true })
    .click()
    .catch(() => undefined);
  await sourceFilter.click();
  await page
    .getByRole("menuitem", { name: fixture.sourceVenueName, exact: true })
    .click();
  const remainingAction = page.locator(
    '[data-ui="gym-operations-review-venue-booking"]',
  );
  await expect(remainingAction).toHaveCount(1);
  await remainingAction.click();
  review = page.getByRole("dialog").filter({ hasText: "Review venue booking" });
  await review
    .getByRole("button", { name: "CANCEL DUE TO MAINTENANCE" })
    .click();
  await expect(
    review.getByText(
      /recorded separately from a member cancellation or no-show/i,
    ),
  ).toBeVisible();
  await review
    .getByRole("button", { name: "Review maintenance resolution" })
    .click();
  resolutionConfirm = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm maintenance cancellation" });
  await expect(
    resolutionConfirm.getByText(
      /payment record and booking history will be preserved/i,
    ),
  ).toBeVisible();
  await resolutionConfirm
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(resolutionConfirm).not.toBeVisible();
  await review
    .getByRole("button", { name: "Review maintenance resolution" })
    .click();
  resolutionConfirm = page
    .getByRole("dialog")
    .filter({ hasText: "Confirm maintenance cancellation" });
  await resolutionConfirm
    .getByRole("button", { name: "CANCEL FOR MAINTENANCE" })
    .click();
  await expect(review).not.toBeVisible();
  await shot(page, testInfo, "gym-operations-maintenance-resolved");

  state = await inspectFixture();
  const cancelled = state.bookings.find(
    (booking) => booking.id === cancelledBookingId,
  );
  expect(cancelled).toMatchObject({
    cancellationReason: "VENUE_MAINTENANCE",
    status: "cancelled",
    totalAmount: "700",
  });
  expect(
    state.payments.find((payment) => payment.id === cancelledPaymentId),
  ).toMatchObject({
    amount: "700",
    payableId: cancelledBookingId,
    status: "completed",
  });
  expect(state.audit).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "BOOKING_CANCELLED_MAINTENANCE",
        entityId: cancelledBookingId,
      }),
    ]),
  );

  const memberContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const memberPage = await memberContext.newPage();
  await loginWebMember(memberPage);
  let picker = await openMemberVenuePicker(memberPage);
  await picker.getByLabel("Search venues").fill(fixture.sourceVenueName);
  await expect(
    picker.getByText("No reservable venues match this search.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    picker.getByText(fixture.sourceVenueName, { exact: true }),
  ).toHaveCount(0);
  await shot(memberPage, testInfo, "member-web-maintenance-venue-unavailable");

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await loginMobileMember(mobilePage);
  await mobilePage.goto(`${mobileBaseUrl}/bookings`);
  await mobilePage
    .getByRole("button", { name: "Open quick actions menu" })
    .click();
  await mobilePage
    .getByRole("button", { name: /make reservation/i })
    .first()
    .click();
  const mobileReservation = mobilePage
    .getByRole("dialog")
    .filter({ hasText: "Make a Reservation" });
  await mobileReservation
    .getByRole("button", { name: "Choose a venue" })
    .click();
  const mobilePicker = mobilePage
    .getByRole("dialog")
    .filter({ hasText: "Select a Venue" });
  await mobilePicker
    .getByPlaceholder("Search venues")
    .fill(fixture.sourceVenueName);
  await expect(
    mobilePicker.getByText("No reservable venues match this search.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    mobilePicker.getByText(fixture.sourceVenueName, { exact: true }),
  ).toHaveCount(0);
  await shot(
    mobilePage,
    testInfo,
    "member-mobile-maintenance-venue-unavailable",
  );
  await mobileContext.close();

  await openFacilitiesVenue(page);
  await openVenueActions(page);
  await page.getByRole("button", { name: "Mark available" }).click();
  confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Mark venue available" });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await openVenueActions(page);
  await page.getByRole("button", { name: "Mark available" }).click();
  confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Mark venue available" });
  await confirm.getByRole("button", { name: "MARK AVAILABLE" }).click();
  await expect(
    page.getByText("Available", { exact: true }).first(),
  ).toBeVisible();
  expect((await inspectFixture()).sourceVenueStatus).toBe("available");

  await memberPage.reload();
  picker = await openMemberVenuePicker(memberPage);
  await picker.getByLabel("Search venues").fill(fixture.sourceVenueName);
  await expect(
    picker.getByText(fixture.sourceVenueName, { exact: true }),
  ).toBeVisible();
  await shot(memberPage, testInfo, "member-web-venue-restored");
  await memberContext.close();
});
