import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

type SeedCredential = {
  email: string;
  label: string;
  password: string;
  role: string;
};

const LUCA_EMAIL = "seed.member.premium@fittrack.com";
const mobileBaseUrl =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://localhost:8081";
const seedManifestPath = resolve(
  process.cwd(),
  ".artifacts",
  "dynamic-seed-manifest.json",
);

async function readLucaCredential() {
  const manifest = JSON.parse(await readFile(seedManifestPath, "utf8")) as {
    credentials: SeedCredential[];
  };
  const credential = manifest.credentials.find(
    (candidate) =>
      candidate.email === LUCA_EMAIL && candidate.role === "member",
  );
  if (!credential) {
    throw new Error(
      "The realistic seed manifest does not contain Luca's member account.",
    );
  }
  return credential;
}

async function loginAsLuca(page: Page) {
  const credential = await readLucaCredential();
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 20_000 });
}

async function cardStyles(card: Locator) {
  return card.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
    };
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`${name}.png`),
  });
}

test.describe.configure({ mode: "serial" });

test("Luca's real mobile plan uses the coach contract and preserves distinct active styling", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(
    testInfo.project.name !== "mobile-chrome",
    "Mobile web surface only.",
  );
  await loginAsLuca(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${mobileBaseUrl}/workout-plans`);

  const coachCard = page
    .locator('[data-testid^="workout-plan-card-"]')
    .filter({ hasText: "Active PPL Rest Split" });
  const personalCard = page
    .locator('[data-testid^="workout-plan-card-"]')
    .filter({ hasText: "Upper Lower Backup Split" });

  await expect(coachCard).toBeVisible({ timeout: 20_000 });
  await expect(personalCard).toBeVisible();
  await expect(
    coachCard.getByText("COACH ASSIGNED", { exact: true }),
  ).toBeVisible();
  await expect(
    coachCard.getByRole("button", { name: "View weekly plan" }),
  ).toBeVisible();
  await expect(
    coachCard.getByRole("button", { name: /use personal plan|edit|delete/i }),
  ).toHaveCount(0);
  await expect(
    personalCard.getByText("PERSONAL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your coach has shared a plan", { exact: true }),
  ).toHaveCount(0);

  const establishCoachActiveButton = coachCard.getByRole("button", {
    name: "Use Coach Plan",
  });
  if (await establishCoachActiveButton.isVisible().catch(() => false)) {
    await establishCoachActiveButton.click();
    await expect(coachCard.getByText("ACTIVE", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  }

  const activeCoachStyle = await cardStyles(coachCard);
  expect(activeCoachStyle.borderColor).toContain("245, 158, 11");
  expect(
    Number.parseFloat(activeCoachStyle.borderWidth),
  ).toBeGreaterThanOrEqual(2);
  const activeCoachBounds = await coachCard.boundingBox();
  expect(activeCoachBounds?.height ?? Infinity).toBeLessThanOrEqual(96);
  const inactivePersonalBounds = await personalCard.boundingBox();
  expect(inactivePersonalBounds?.height ?? Infinity).toBeLessThanOrEqual(96);
  await capture(page, testInfo, "luca-active-coach-plan-gold");

  await coachCard.getByRole("button", { name: "View weekly plan" }).click();
  const mobileViewer = page.getByTestId("coach-plan-weekly-viewer");
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date());
  await expect(
    mobileViewer.getByRole("button", { name: "Show this week" }),
  ).toBeVisible();
  await expect(
    mobileViewer.getByRole("button", { name: "Show this month" }),
  ).toBeVisible();
  await expect(
    mobileViewer.getByText(monthLabel, { exact: true }),
  ).toBeVisible();

  await mobileViewer.getByRole("button", { name: "Show this month" }).click();
  const mobileMonthGrid = page.getByTestId("coach-plan-month-grid");
  await expect(mobileMonthGrid).toBeVisible();
  await expect(
    mobileMonthGrid.locator('[data-testid^="coach-plan-month-day-"]'),
  ).toHaveCount(42);
  const scheduledMonthDay = page.getByTestId("coach-plan-month-day-2026-08-02");
  const emptyMonthDay = page.getByTestId("coach-plan-month-day-2026-08-05");
  expect((await cardStyles(scheduledMonthDay)).borderColor).toContain(
    "245, 158, 11",
  );
  expect((await cardStyles(emptyMonthDay)).borderColor).toContain(
    "102, 102, 102",
  );
  await capture(page, testInfo, "luca-coach-plan-mobile-month");
  await mobileViewer.getByRole("button", { name: "Show this week" }).click();

  const mobileWeekStrip = page.getByTestId("coach-plan-week-strip");
  await expect(mobileWeekStrip).toBeVisible();
  const stripMetrics = await mobileWeekStrip.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(stripMetrics.scrollWidth).toBeGreaterThan(stripMetrics.clientWidth);
  await capture(page, testInfo, "luca-coach-plan-mobile-week-strip");

  await mobileViewer
    .getByRole("button", { name: /scheduled/i })
    .first()
    .click();
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(
    mobileViewer.getByText(/SCHEDULED.*NOT COMPLETED/i),
  ).toBeVisible();
  const mobileScroll = page.getByTestId("coach-plan-viewer-scroll");
  const scrollMetrics = await mobileScroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return {
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    };
  });
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(
    scrollMetrics.clientHeight,
  );
  expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
  await capture(page, testInfo, "luca-coach-plan-mobile-day-scrolled");
  await page.getByRole("button", { name: "Back to coach plan week" }).click();
  await page.getByRole("button", { name: "Close coach plan viewer" }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await coachCard.getByRole("button", { name: "View weekly plan" }).click();
  const viewer = page.getByTestId("coach-plan-weekly-viewer");
  await expect(
    page.getByText("READ-ONLY COACH PLAN", { exact: true }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Show this week" }),
  ).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Scheduled / not completed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No workout planned", { exact: true }),
  ).toBeVisible();
  const viewerBounds = await viewer.boundingBox();
  expect(viewerBounds?.width ?? Infinity).toBeLessThanOrEqual(922);
  expect(viewerBounds?.height ?? Infinity).toBeLessThanOrEqual(776);
  await expect(page.getByTestId("coach-plan-week-grid")).toBeVisible();
  await capture(page, testInfo, "luca-coach-plan-calendar-contained");

  const scheduledDay = viewer
    .getByRole("button", { name: /scheduled/i })
    .first();
  await scheduledDay.click();
  await expect(viewer.getByText(/SCHEDULED.*NOT COMPLETED/i)).toBeVisible();
  await capture(page, testInfo, "luca-coach-plan-day-contained");
  await page.getByRole("button", { name: "Close coach plan viewer" }).click();
  await page.setViewportSize({ width: 390, height: 844 });

  try {
    await personalCard
      .getByRole("button", { name: "Use Personal Plan" })
      .click();
    await expect(
      page.getByText("Switch from coach plan?", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Use personal plan", exact: true })
      .click();
    await expect(personalCard.getByText("ACTIVE", { exact: true })).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(page.getByText(/is now your active plan\./i)).toHaveCount(0);
    const activePersonalStyle = await cardStyles(personalCard);
    expect(activePersonalStyle.borderColor).toContain("232, 119, 34");
    expect(Number.parseFloat(activePersonalStyle.borderWidth)).toBe(1);
    const activePersonalBounds = await personalCard.boundingBox();
    const inactiveCoachBounds = await coachCard.boundingBox();
    expect(activePersonalBounds?.height ?? Infinity).toBeLessThanOrEqual(96);
    expect(inactiveCoachBounds?.height ?? Infinity).toBeLessThanOrEqual(96);
    await capture(page, testInfo, "luca-active-personal-plan-brand");

    await personalCard.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Edit plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Goal", { exact: true })).toHaveCount(0);
    const exerciseCatalog = page.getByTestId(
      "workout-plan-exercise-catalog",
    );
    await expect(exerciseCatalog).toBeVisible();
    const exerciseCatalogMetrics = await exerciseCatalog.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        scrollbarWidth: style.scrollbarWidth,
      };
    });
    expect(exerciseCatalogMetrics.clientHeight).toBeLessThanOrEqual(210);
    expect(exerciseCatalogMetrics.scrollHeight).toBeGreaterThan(
      exerciseCatalogMetrics.clientHeight,
    );
    expect(exerciseCatalogMetrics.scrollbarWidth).toBe("none");
    await exerciseCatalog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect
      .poll(() => exerciseCatalog.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const selectedTrainingDays = page.getByRole("button", {
      name: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) selected$/,
    });
    expect(await selectedTrainingDays.count()).toBeGreaterThan(0);
    await capture(page, testInfo, "luca-personal-plan-editor-no-goal");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      page.getByText("Workout plan updated.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(personalCard).toBeVisible();
    await capture(page, testInfo, "luca-personal-plan-save-success");

    await page.setViewportSize({ width: 320, height: 720 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await capture(page, testInfo, "luca-personal-plan-compact-320");
    await page.setViewportSize({ width: 390, height: 844 });
  } finally {
    const restoreCoachButton = coachCard.getByRole("button", {
      name: "Use Coach Plan",
    });
    if (await restoreCoachButton.isVisible().catch(() => false)) {
      await restoreCoachButton.click();
      await expect(coachCard.getByText("ACTIVE", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    }
  }

  const restoredCoachStyle = await cardStyles(coachCard);
  expect(restoredCoachStyle.borderColor).toContain("245, 158, 11");
  expect(
    Number.parseFloat(restoredCoachStyle.borderWidth),
  ).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/is now your active plan\./i)).toHaveCount(0);
});
