import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type SeedCredential = {
  email: string;
  label: string;
  password: string;
  role: string;
};

type Fixture = {
  inactivePlanId: string;
  planId: string;
};

const seedManifestPath = resolve(
  process.cwd(),
  ".artifacts",
  "dynamic-seed-manifest.json",
);
const fixturePath = resolve(
  process.cwd(),
  ".artifacts",
  "e2e-qa",
  "coach-plan-fixture.json",
);
const mobileBaseUrl =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://localhost:8081";

test.skip(
  !process.env.FITTRACK_REAL_DATA_E2E,
  "Run through pnpm test:ui:real-data so the scoped fixture is applied and cleaned.",
);
test.describe.configure({ mode: "serial" });

async function readSeedCredential(role: "admin" | "coach" | "member") {
  const manifest = JSON.parse(await readFile(seedManifestPath, "utf8")) as {
    credentials: SeedCredential[];
  };
  const credential = manifest.credentials.find(
    (candidate) => candidate.role.toLowerCase() === role,
  );
  if (!credential) throw new Error(`No ${role} credential exists in the dynamic seed manifest.`);
  return credential;
}

async function readFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${name}.png`) });
}

async function loginWeb(page: Page, role: "admin" | "coach" | "member") {
  const credential = await readSeedCredential(role);
  await page.goto(role === "member" ? "/member-login" : "/login");
  await page.getByLabel("Email Address").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(?:home|dashboard|schedule|analytics)(?:\?|$)/, {
    timeout: 20_000,
  });
}

async function loginMobile(page: Page) {
  const credential = await readSeedCredential("member");
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 20_000 });
}

test("member web keeps coach plans read-only and renders completed, scheduled, skipped, and empty days", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Web member surface only.");
  const fixture = await readFixture();
  const planMutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/fitness/plans") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) {
      planMutations.push(`${request.method()} ${request.url()}`);
    }
  });

  await loginWeb(page, "member");
  await page.goto("/workout");
  await expect(
    page.getByRole("heading", { name: /E2E-QA Coach Plan/ }).first(),
  ).toBeVisible();
  await expect(page.getByText("Coach plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Preset" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use Personal Plan" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View weekly plan" })).toBeVisible();
  await capture(page, testInfo, "member-web-coach-plan-active");

  await page.getByRole("button", { name: "View weekly plan" }).click();
  await expect(page.getByText("This week")).toBeVisible();
  await expect(page.getByRole("button", { name: /sun completed/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /mon scheduled/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /tue skipped/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /wed no workout planned/i })).toBeVisible();
  await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
  await capture(page, testInfo, "member-web-coach-plan-calendar");

  await page.getByRole("button", { name: /tue skipped/i }).click();
  await expect(page.getByText("SKIPPED", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E-QA Skipped legs")).toBeVisible();
  await capture(page, testInfo, "member-web-coach-plan-skipped-detail");

  await page.getByRole("button", { name: "Back to coach plan week" }).click();
  await page.getByRole("button", { name: /wed no workout planned/i }).click();
  await expect(page.getByText("No workout planned for this day.")).toBeVisible();
  expect(planMutations).toEqual([]);
  expect(fixture.planId).toBeTruthy();
});

test("member web exposes the scoped coach-plan error state without a mutation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Web member surface only.");
  const fixture = await readFixture();
  await loginWeb(page, "member");
  await page.route(`**/fitness/plans/${fixture.planId}`, async (route) => {
    await route.fulfill({
      body: JSON.stringify({ detail: "Fixture request failed." }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto("/workout");
  await expect(page.getByRole("button", { name: "View weekly plan" })).toBeVisible();
  await page.getByRole("button", { name: "View weekly plan" }).click();
  await expect(page.getByText("This coach plan is unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await capture(page, testInfo, "member-web-coach-plan-error");
  await page.unroute(`**/fitness/plans/${fixture.planId}`);
});

test("coach schedule normalizes forced Gym Operations query parameters and retains only coach controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Web coach surface only.");
  await loginWeb(page, "coach");
  await page.goto("/schedule?tab=appointments&schedule_view=venues");
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RECURRING PLAN" })).toBeVisible();
  await expect(page.getByText("Month Calendar", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Venue Bookings", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Appointments", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-ui="gym-operations-create-venue-booking"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/schedule$/);
  await capture(page, testInfo, "coach-sessions-normalized");

  await page.getByRole("button", { name: "RECURRING PLAN" }).click();
  await expect(page.getByText("Recurring coaching plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Actual Session Dates (max 5 per gym week)")).toHaveCount(0);
  await capture(page, testInfo, "coach-sessions-recurring-modal");
});

test("admin keeps the existing Gym Operations schedule controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Web admin regression only.");
  await loginWeb(page, "admin");
  await page.goto("/schedule");
  await expect(page.getByText("Schedule", { exact: true })).toBeVisible();
  await expect(page.getByText("Coaches", { exact: true })).toBeVisible();
  await expect(page.getByText("Appointments", { exact: true })).toBeVisible();
  await expect(page.getByText("Month Calendar", { exact: true })).toBeVisible();
  await expect(page.getByText("Venue Bookings", { exact: true })).toBeVisible();
  await capture(page, testInfo, "admin-gym-operations-regression");
});

test("member mobile labels coach plans correctly and opens the read-only calendar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile web surface only.");
  const fixture = await readFixture();
  await loginMobile(page);
  await page.goto(`${mobileBaseUrl}/workout-plans`);
  const activeCard = page.locator(`[data-testid="workout-plan-card-${fixture.planId}"]`);
  const inactiveCard = page.locator(`[data-testid="workout-plan-card-${fixture.inactivePlanId}"]`);
  await expect(activeCard).toBeVisible({ timeout: 20_000 });
  await expect(activeCard.getByText("COACH ASSIGNED")).toBeVisible();
  await expect(activeCard.getByRole("button", { name: "View weekly plan" })).toBeVisible();
  await expect(activeCard.getByRole("button", { name: /edit|delete/i })).toHaveCount(0);
  await expect(inactiveCard.getByRole("button", { name: "Use Coach Plan" })).toBeVisible();
  await expect(inactiveCard.getByRole("button", { name: "Use Personal Plan" })).toHaveCount(0);
  await capture(page, testInfo, "member-mobile-coach-plan-cards");

  await activeCard.getByRole("button", { name: "View weekly plan" }).click();
  await expect(page.getByText("READ-ONLY COACH PLAN")).toBeVisible();
  await expect(page.getByRole("button", { name: /sun completed/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /mon scheduled/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /tue skipped/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /wed no workout planned/i })).toBeVisible();
  await capture(page, testInfo, "member-mobile-coach-plan-calendar");

  await page.getByRole("button", { name: /wed no workout planned/i }).click();
  await expect(page.getByText("No workout planned for this day.")).toBeVisible();
  await capture(page, testInfo, "member-mobile-coach-plan-empty-detail");
});

test("Manual camera control remains usable at narrow mobile widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile web surface only.");
  await loginMobile(page);
  await page.goto(`${mobileBaseUrl}/workout`);
  await expect(
    page.getByRole("button", { name: "Start Today's Workout" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Start Today's Workout" }).click();
  await expect(page.getByRole("button", { name: "Track This Set With Camera" })).toBeVisible({ timeout: 20_000 });

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 820 });
    await page.getByRole("button", { name: "Track This Set With Camera" }).click();
    const manualButton = page.getByRole("button", {
      name: "Return to manual workout entry",
    });
    await expect(manualButton).toBeVisible();
    const bounds = await manualButton.locator("..").boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(96);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await capture(page, testInfo, `member-mobile-camera-manual-${width}`);
    await manualButton.click();
    await expect(page.getByText("Today's workout")).toBeVisible();
  }
});
