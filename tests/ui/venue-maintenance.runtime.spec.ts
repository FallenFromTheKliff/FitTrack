import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credential = { email: string; password: string; role: string };
const manifestPath = resolve(process.cwd(), ".artifacts", "dynamic-seed-manifest.json");
const mobileBaseUrl = "http://127.0.0.1:8081";

async function account(role: "admin" | "member") {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    credentials: Credential[];
  };
  const credential = manifest.credentials.find((item) => item.role === role);
  if (!credential) throw new Error(`Missing ${role} test account.`);
  return credential;
}

async function loginMobileMember(page: Page) {
  const credential = await account("member");
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 30_000 });
}

async function loginWeb(page: Page, role: "admin" | "member") {
  const credential = await account(role);
  await page.goto(role === "member" ? "/member-login" : "/login");
  await page.getByLabel("Email Address").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    (url) => !["/login", "/member-login"].includes(url.pathname),
    { timeout: 60_000 },
  );
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`${name}.png`),
  });
}

test("mobile venue picker is populated, searchable, selectable, and excludes maintenance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginMobileMember(page);
  await page.goto(`${mobileBaseUrl}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu" }).click();
  await page.getByRole("button", { name: /make reservation/i }).first().click();
  const reservation = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(reservation).toBeVisible();
  await reservation.getByRole("button", { name: "Choose a venue" }).click();
  const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
  const rows = picker.getByRole("button").filter({ hasText: /PHP/ });
  await expect(rows.first()).toBeVisible();
  expect((await rows.first().boundingBox())?.height ?? 0).toBeGreaterThan(0);
  await expect(picker.getByText("dwadawdaw", { exact: true })).toHaveCount(0);
  const firstVenueName = (await rows.first().innerText()).split("\n")[0]!.trim();
  const search = picker.getByPlaceholder("Search venues");
  await search.fill("no venue can match this search");
  await expect(picker.getByText("No reservable venues match this search.", { exact: true })).toBeVisible();
  await search.fill(firstVenueName);
  const recovered = picker.getByRole("button").filter({ hasText: firstVenueName }).first();
  await expect(recovered).toBeVisible();
  await recovered.click();
  await expect(picker).not.toBeVisible();
  await expect(reservation.getByRole("button", { name: `Selected venue ${firstVenueName}` })).toBeVisible();
  await reservation.getByRole("button", { name: /pay in full/i }).click();
  await expect(reservation.getByRole("alert").filter({ hasText: "Start and end time are required" })).toBeVisible();
  await shot(page, testInfo, "mobile-venue-selected-inline-error");

  await reservation.getByRole("button", { name: /Start time:/ }).click();
  const startPicker = page.getByRole("dialog").filter({ hasText: "Venue start time" });
  await startPicker.getByRole("button", { name: /available$/ }).first().click();
  await reservation.getByRole("button", { name: /End time:/ }).click();
  const endPicker = page.getByRole("dialog").filter({ hasText: "Venue end time" });
  await endPicker.getByRole("button", { name: /available$/ }).first().click();
  await reservation.getByRole("button", { name: /pay in full/i }).click();
  const paymentConfirmation = page.getByRole("dialog").filter({ hasText: "Review and pay in full?" });
  await expect(paymentConfirmation.getByText(/Pay .* through PayMongo/)).toBeVisible();
  await paymentConfirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(paymentConfirmation).not.toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await reservation.getByRole("button", { name: `Selected venue ${firstVenueName}` }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Select a Venue" }).getByRole("button").filter({ hasText: /PHP/ }).first()).toBeVisible();
  await shot(page, testInfo, "mobile-desktop-venue-picker-populated");
});

test("web member reservation hides maintenance and preserves inline validation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome");
  test.setTimeout(120_000);
  await loginWeb(page, "member");
  await page.getByRole("link", { name: "Bookings", exact: true }).click();
  await page.waitForURL(/\/bookings(?:\?|$)/);
  await page.getByRole("button", { name: /make a reservation/i }).first().click();
  const modal = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Reservation venue:/ }).click();
  const picker = page.getByRole("dialog").filter({ hasText: "Select a Venue" });
  await expect(picker.getByText("dwadawdaw", { exact: true })).toHaveCount(0);
  const rows = picker.locator("button").filter({ hasText: /PHP/ });
  await expect(rows.first()).toBeVisible();
  const firstVenueName = (await rows.first().innerText()).split("\n")[0]!.trim();
  await picker.getByLabel("Search venues").fill("impossible venue search");
  await expect(picker.getByText("No reservable venues match this search.", { exact: true })).toBeVisible();
  await picker.getByLabel("Search venues").fill(firstVenueName);
  await picker.locator("button").filter({ hasText: firstVenueName }).first().click();
  await expect(picker).not.toBeVisible();
  await modal.getByRole("button", { name: "Review Checkout" }).click();
  await expect(modal.getByText(/Choose a live venue start time|No future venue start time/)).toBeVisible();
  await shot(page, testInfo, "web-member-venue-selected-inline-error");

  await modal.getByRole("button", { name: /^Date:/ }).click();
  const calendar = page.getByRole("dialog").filter({ hasText: "August 2026" });
  await calendar.getByRole("button", { name: "Select 2026-08-15" }).click();
  await modal.getByRole("button", { name: /^Start Time:/ }).click();
  const startPicker = page.getByRole("dialog").filter({ hasText: "Start Time" });
  await startPicker.locator(".bookings-time-picker-grid button:not([disabled])").first().click();
  await modal.getByRole("button", { name: /^End Time:/ }).click();
  const endPicker = page.getByRole("dialog").filter({ hasText: "End Time" });
  await endPicker.locator(".bookings-time-picker-grid button:not([disabled])").first().click();
  await modal.getByLabel("Venue reservation notes").fill("Discard this draft on cancel");
  await modal.getByRole("button", { name: "Review Checkout" }).click();
  const checkoutConfirmation = page.getByRole("dialog").filter({ hasText: "Review venue checkout" });
  await expect(checkoutConfirmation.getByText(/confirmed only after full payment succeeds/i)).toBeVisible();
  await checkoutConfirmation.getByRole("button", { name: "Back", exact: true }).click();
  await expect(checkoutConfirmation).not.toBeVisible();
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(modal).not.toBeVisible();

  await page.getByRole("button", { name: /make a reservation/i }).first().click();
  const reopenedModal = page.getByRole("dialog").filter({ hasText: "Make a Reservation" });
  await expect(reopenedModal.getByRole("button", { name: "Reservation venue: Select venue" })).toBeVisible();
  await expect(reopenedModal.getByRole("button", { name: "Start Time: Select Time" })).toBeVisible();
  await expect(reopenedModal.getByRole("button", { name: "End Time: Select Time" })).toBeVisible();
  await expect(reopenedModal.getByLabel("Venue reservation notes")).toHaveValue("");
  await reopenedModal.getByRole("button", { name: "Review Checkout" }).click();
  await expect(reopenedModal.getByText("Choose a reservable venue.", { exact: true })).toBeVisible();
  await expect(reopenedModal.getByText("Choose a start time before the end time.", { exact: true })).toBeVisible();
  await shot(page, testInfo, "web-member-reset-after-cancel");
});

test("Facilities and Gym Operations expose maintenance as unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome");
  test.setTimeout(150_000);
  await loginWeb(page, "admin");
  await page.getByRole("link", { name: "Facilities", exact: true }).click();
  await page.waitForURL(/\/facilities(?:\?|$)/);
  await page.getByRole("button", { name: "Venues", exact: true }).first().click();
  await page.getByLabel("Search venues").fill("dwadawdaw");
  await expect(page.getByText("dwadawdaw", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable - Maintenance", { exact: true })).toBeVisible();
  await expect(page.getByText("Maintenance blocks booking", { exact: true })).toBeVisible();
  await shot(page, testInfo, "facilities-maintenance-unavailable");

  await page.getByRole("link", { name: /Gym Operations|Schedule/ }).click();
  await page.waitForURL(/\/schedule(?:\?|$)/);
  await page.getByRole("tab", { name: "Venue Bookings" }).click();
  await page.getByRole("button", { name: "NEW VENUE BOOKING" }).click();
  const modal = page.getByRole("dialog").filter({ hasText: "Create venue booking" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Manual venue booking venue").click();
  const maintenanceOption = page.getByRole("menuitem", {
    name: /dwadawdaw.*under maintenance.*cannot be booked/i,
  });
  await expect(maintenanceOption).toBeVisible();
  await expect(maintenanceOption).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(maintenanceOption).not.toBeVisible();
  await expect(modal).toBeVisible();
  await shot(page, testInfo, "gym-operations-dropdown-escape-layering");
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();

  await page.getByRole("button", { name: "NEW VENUE BOOKING" }).click();
  const reopenedModal = page.getByRole("dialog").filter({ hasText: "Create venue booking" });
  await expect(reopenedModal).toBeVisible();
  await reopenedModal.getByLabel("Manual venue booking venue").click();
  await page.getByRole("menuitem", { name: "Basketball Court", exact: true }).first().click();
  await reopenedModal.getByRole("button", { name: "CREATE BOOKING", exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "Confirm venue booking" });
  if (await confirmation.isVisible().catch(() => false)) {
    await expect(confirmation.getByText(/full cash payment/i)).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirmation).not.toBeVisible();
  } else {
    await expect(reopenedModal.getByText(/Select a live start time|Select a live end time|future start time/)).toBeVisible();
  }
  await shot(page, testInfo, "gym-operations-maintenance-disabled-inline-errors");
});
