import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

async function readAdminCredential() {
  const artifactRoot = resolve(process.cwd(), ".artifacts");

  for (const fileName of [
    "dynamic-seed-manifest.json",
    "test-data-manifest.json",
  ]) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(artifactRoot, fileName), "utf8"),
      ) as { credentials: Credential[] };
      const credential = manifest.credentials.find(
        ({ role }) => role.toLowerCase() === "admin",
      );
      if (credential) return credential;
    } catch {
      // Try the next supported local seed manifest.
    }
  }

  throw new Error("Missing seeded admin credential manifest.");
}

async function loginAdmin(page: Page) {
  const credential = await readAdminCredential();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email Address").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

async function chooseTimeView(page: Page, panel: Locator, label: string) {
  await panel.getByRole("button", { name: /^Time view:/ }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

async function chooseCalendarDay(
  page: Page,
  trigger: Locator,
  dateYmd: string,
) {
  await trigger.click();
  const calendar = page.getByRole("dialog").last();
  await expect(calendar).toBeVisible();
  await calendar
    .getByRole("button", { name: `Select ${dateYmd}`, exact: true })
    .click();
  await expect(calendar).toBeHidden();
}

type PeriodLabel = "date" | "week" | "month" | "year";

async function expectActionBarContract(panel: Locator, period: PeriodLabel) {
  const directChildren = panel.locator(":scope > *");
  await expect(directChildren).toHaveCount(5);
  await expect(directChildren.nth(0)).toContainText("Analytics timeframe");
  await expect(directChildren.nth(0)).toContainText("Applied timeframe:");
  await expect(directChildren.nth(1)).toContainText(`Start ${period}`);
  await expect(directChildren.nth(2)).toContainText(`End ${period}`);
  await expect(directChildren.nth(3)).toContainText("Time view");
  await expect(
    directChildren.nth(4).getByRole("button", { name: "RESET", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "APPLY RANGE", exact: true }),
  ).toHaveCount(1);
  await expect(
    panel.getByRole("button", { name: "APPLY TIMEFRAME", exact: true }),
  ).toHaveCount(0);
  await expect(panel.locator('[data-ui="analytics-period-start"]')).toHaveCount(1);
  await expect(panel.locator('[data-ui="analytics-period-end"]')).toHaveCount(1);
  await expect(panel.locator('input[type="date"], input[type="month"], input[type="week"]')).toHaveCount(0);
  await expect(panel.locator('input[name="analyticsTimeMode"]')).toHaveCount(1);
  await expect(panel.locator("select")).toHaveCount(0);
}

async function expectPeriodControls(panel: Locator, period: PeriodLabel) {
  await expect(
    panel.getByRole("button", { name: new RegExp(`^Start ${period}:`) }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: new RegExp(`^End ${period}:`) }),
  ).toBeVisible();

  for (const unit of ["date", "week", "month", "year"] as const) {
    if (unit === period) continue;
    await expect(
      panel.getByRole("button", { name: new RegExp(`^Start ${unit}:`) }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: new RegExp(`^End ${unit}:`) }),
    ).toHaveCount(0);
  }
}

async function inspectPeriodDialog(
  page: Page,
  panel: Locator,
  triggerName: RegExp,
  mode: "day" | "week" | "month" | "year",
) {
  await panel.getByRole("button", { name: triggerName }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();

  if (mode === "day") {
    await expect(
      dialog.locator('[data-analytics-period-picker="true"]'),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /^Select \d{4}-\d{2}-\d{2}$/ }).first(),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: /^Select week |^Select (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$|^Select year \d{4}$/,
      }),
    ).toHaveCount(0);
  } else {
    const picker = dialog.locator(
      `[data-analytics-period-picker="true"][data-period-mode="${mode}"]`,
    );
    await expect(picker).toBeVisible();

    if (mode === "week") {
      await expect(
        picker.getByRole("button", { name: /^Select week / }).first(),
      ).toBeVisible();
      await expect(
        picker.getByRole("button", {
          name: /^Select (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$|^Select year \d{4}$/,
        }),
      ).toHaveCount(0);
    } else if (mode === "month") {
      await expect(
        picker.getByRole("button", {
          name: /^Select (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
        }).first(),
      ).toBeVisible();
      await expect(
        picker.getByRole("button", { name: /^Select week |^Select year / }),
      ).toHaveCount(0);
    } else {
      await expect(
        picker.getByRole("button", { name: /^Select year \d{4}$/ }).first(),
      ).toBeVisible();
      await expect(
        picker.getByRole("button", {
          name: /^Select week |^Select (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
        }),
      ).toHaveCount(0);
    }
  }

  await dialog.getByRole("button", { name: /^Close / }).click();
  await expect(dialog).toBeHidden();
}

function overviewRequestMatches(
  requestUrl: string,
  expected: { endDate: string; period: string; startDate: string },
) {
  const url = new URL(requestUrl);
  return (
    url.pathname.endsWith("/analytics/overview") &&
    url.searchParams.get("start_date") === expected.startDate &&
    url.searchParams.get("end_date") === expected.endDate &&
    url.searchParams.get("period") === expected.period
  );
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDisplayDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
}

function addUtcDays(value: Date, days: number) {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getCurrentUtcDate() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function getDefaultCustomStartDate(currentDate: Date) {
  return new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() - 5, 1),
  );
}

function deriveCustomPeriod(startDate: Date, endDate: Date) {
  const inclusiveDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  if (inclusiveDays === 1) return "hourly";
  if (inclusiveDays <= 31) return "daily";
  if (inclusiveDays <= 180) return "weekly";
  if (inclusiveDays <= 1_095) return "monthly";
  return "yearly";
}

function getCurrentWeekWindow(currentDate: Date) {
  const monday = new Date(currentDate.getTime());
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return {
    endDate: formatUtcDate(addUtcDays(monday, 6)),
    startDate: formatUtcDate(monday),
  };
}

function getMonthWindow(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return {
    endDate: formatUtcDate(endDate),
    startDate: formatUtcDate(startDate),
  };
}

async function applyAndWaitForOverview(
  page: Page,
  panel: Locator,
  expected: { endDate: string; period: string; startDate: string },
) {
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      overviewRequestMatches(request.url(), expected),
    { timeout: 30_000 },
  );
  await expect(panel.locator('[data-ui="analytics-range-apply"]')).toBeEnabled();
  await panel.locator('[data-ui="analytics-range-apply"]').click();
  await requestPromise;
}

test("analytics timeframe keeps one stable action bar across period modes", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await loginAdmin(page);
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });

  const panel = page.locator(".analytics-date-range-panel");
  await expect(
    panel.getByText("Analytics timeframe", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  const currentDate = getCurrentUtcDate();
  const currentDateYmd = formatUtcDate(currentDate);
  const customStartDate = addUtcDays(getDefaultCustomStartDate(currentDate), 1);
  const customStartDateYmd = formatUtcDate(customStartDate);
  const targetYear = currentDate.getUTCFullYear();

  // Every mode keeps the same five-slot action bar and exposes both period triggers.
  await expectActionBarContract(panel, "date");
  await expectPeriodControls(panel, "date");
  await expect(
    panel.getByRole("button", { name: /^Time view:/ }),
  ).toHaveAttribute("aria-label", /Custom range/);

  // Custom range retains exact selected dates and derives its attendance period.
  await inspectPeriodDialog(
    page,
    panel,
    /^Start date:/,
    "day",
  );
  await chooseCalendarDay(
    page,
    panel.getByRole("button", { name: /^Start date:/ }),
    customStartDateYmd,
  );
  await applyAndWaitForOverview(page, panel, {
    endDate: currentDateYmd,
    period: deriveCustomPeriod(customStartDate, currentDate),
    startDate: customStartDateYmd,
  });

  // Day mode uses day cells only and keeps Start date / End date visible.
  await chooseTimeView(page, panel, "Day");
  await expectActionBarContract(panel, "date");
  await expectPeriodControls(panel, "date");
  await inspectPeriodDialog(page, panel, /^Start date:/, "day");
  await applyAndWaitForOverview(page, panel, {
    endDate: currentDateYmd,
    period: "hourly",
    startDate: currentDateYmd,
  });

  // Week mode exposes week ranges only and normalizes Monday through Sunday.
  await chooseTimeView(page, panel, "Week");
  await expectActionBarContract(panel, "week");
  await expectPeriodControls(panel, "week");
  await inspectPeriodDialog(page, panel, /^Start week:/, "week");
  const currentWeekWindow = getCurrentWeekWindow(currentDate);
  await applyAndWaitForOverview(page, panel, {
    ...currentWeekWindow,
    period: "daily",
  });

  // Month mode exposes months only and sends the exact first/last day window.
  await chooseTimeView(page, panel, "Month");
  await expectActionBarContract(panel, "month");
  await expectPeriodControls(panel, "month");
  await inspectPeriodDialog(page, panel, /^Start month:/, "month");
  await applyAndWaitForOverview(page, panel, {
    ...getMonthWindow(targetYear, currentDate.getUTCMonth() + 1),
    period: "monthly",
  });

  // Year mode exposes years only and sends the exact January 1 through December 31 window.
  await chooseTimeView(page, panel, "Year");
  await expectActionBarContract(panel, "year");
  await expectPeriodControls(panel, "year");
  await inspectPeriodDialog(page, panel, /^Start year:/, "year");
  await applyAndWaitForOverview(page, panel, {
    endDate: `${targetYear}-12-31`,
    period: "yearly",
    startDate: `${targetYear}-01-01`,
  });

  // The stable grouping remains usable at narrow and wide responsive breakpoints.
  await page.setViewportSize({ height: 900, width: 900 });
  await expectActionBarContract(panel, "year");
  await expectPeriodControls(panel, "year");
  await page.setViewportSize({ height: 900, width: 1440 });
  await expectActionBarContract(panel, "year");
  await expectPeriodControls(panel, "year");

  // Reset restores the default custom-range window without requiring a duplicate request.
  await chooseTimeView(page, panel, "Custom range");
  const resetButton = panel.locator('[data-ui="analytics-range-reset"]');
  await expect(resetButton).toBeEnabled();
  await panel.locator('[data-ui="analytics-range-reset"]').click();
  await expectActionBarContract(panel, "date");
  await expectPeriodControls(panel, "date");
  await expect(
    panel.getByRole("button", { name: /^Time view:/ }),
  ).toHaveAttribute("aria-label", /Custom range/);
  await expect(
    panel.locator('[data-ui="analytics-period-start"]'),
  ).toHaveAttribute(
    "aria-label",
    `Start date: ${formatDisplayDate(getDefaultCustomStartDate(currentDate))}`,
  );
  await expect(
    panel.locator('[data-ui="analytics-period-end"]'),
  ).toHaveAttribute("aria-label", `End date: ${formatDisplayDate(currentDate)}`);
  await expect(resetButton).toBeDisabled();
  await expect(
    panel.locator('[data-ui="analytics-range-apply"]'),
  ).toBeDisabled();
  await expect(panel.getByRole("button", { name: /^Start year:/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^End year:/ })).toHaveCount(0);
  await expect(
    page.locator('[data-analytics-period-picker="true"][data-period-mode="year"]'),
  ).toHaveCount(0);
});
