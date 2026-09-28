import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

const TODAY = "2026-08-28";
const CHECK_IN = `${TODAY}T09:15:00.000Z`;

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
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

function pagination(data: unknown[], total = data.length, totalPages = total ? 1 : 0) {
  return {
    data,
    meta: { limit: 6, page: 1, total, total_pages: totalPages },
  };
}

function attendanceRecord(index: number) {
  return {
    access_source: index % 2 ? "daily_pass" : "membership_plan",
    check_in_at: CHECK_IN,
    check_in_method: "qr",
    check_out_at: index % 3 === 0 ? null : `${TODAY}T10:15:00.000Z`,
    id: `attendance-${index}`,
    scanned_by: { name: "Sera Admin" },
    user: {
      email: `member-${index}@fittrack.test`,
      profile: { first_name: `Member`, last_name: `${index}` },
    },
    user_id: `member-${index}`,
  };
}

async function installFixtures(page: Page, requests: string[], exports: Record<string, unknown>[]) {
  await page.route("**/analytics/snapshot**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          daily_insights: { active_members: 1, recent_activities: 1, sessions_today: 0 },
          generated_at: CHECK_IN,
          performance_kpis: {
            active_members: 1,
            app_feedback_submissions: 0,
            check_ins: 1,
            coaching_sessions: 0,
            new_members: 1,
            total_coaching_appointments: 0,
            total_revenue: 0,
            total_venue_bookings: 0,
          },
          recent_activities: [
            {
              actor_name: "Sera Admin",
              description: "Attendance check-in recorded.",
              entity_id: "attendance-1",
              entity_label: "Attendance",
              id: "recent-attendance-1",
              kind: "attendance",
              occurred_at: CHECK_IN,
              status: "completed",
              title: "Attendance check-in",
            },
          ],
          system_alerts: [],
        },
      }),
    });
  });

  await page.route("**/payments**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        pagination([
          {
            amount: "1250.50",
            created_at: CHECK_IN,
            currency: "PHP",
            gateway_event_id: null,
            id: "payment-1",
            idempotency_key: "gym-actions-test-payment",
            payable_id: "member-1",
            payable_type: "membership",
            payment_stage: "completed",
            provider: "cash",
            provider_ref: null,
            rejection_reason: null,
            screenshot_url: null,
            status: "completed",
            updated_at: CHECK_IN,
            user_id: "member-1",
            verified_at: CHECK_IN,
            verified_by: "admin-1",
            membership_kind: "gym_membership",
            membership_plan_name: "Monthly Membership",
            user: {
              id: "member-1",
              profile: { first_name: "Member", last_name: "One" },
              role: "member",
              status: "active",
            },
          },
        ]),
      ),
    });
  });

  await page.route("**/audit**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        pagination([
          {
            action: "UPDATE",
            actor: {
              id: "admin-1",
              profile: { first_name: "Sera", last_name: "Admin" },
              role: "admin",
              status: "active",
            },
            after: null,
            before: null,
            created_at: CHECK_IN,
            entity: "Payment",
            entity_id: "payment-1",
            id: "audit-1",
            ip_address: null,
            user_id: "admin-1",
          },
        ]),
      ),
    });
  });

  for (const path of ["**/inventory/sales**", "**/staff/appointments**"]) {
    await page.route(path, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pagination([])),
      });
    });
  }

  await page.route("**/bookings/amenity**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/attendance**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedLimit = Number(url.searchParams.get("limit") ?? "6");
    const records = Array.from({ length: 7 }, (_, index) => attendanceRecord(index + 1));
    // Keep the fixture paginated even when an export asks for a larger page so
    // the all-pages path proves it follows attendance pagination.
    const fixturePageSize = Math.min(requestedLimit, 6);
    const data = records.slice(
      (requestedPage - 1) * fixturePageSize,
      requestedPage * fixturePageSize,
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        meta: {
          limit: fixturePageSize,
          page: requestedPage,
          total: records.length,
          total_pages: Math.ceil(records.length / fixturePageSize),
        },
      }),
    });
  });

  await page.route("**/gym-actions/export/pdf**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    exports.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "access-control-expose-headers": "content-disposition",
        "content-disposition": 'attachment; filename="attendance-export.pdf"',
      },
      body: "%PDF-1.4\n% FitTrack test export\n",
    });
  });
}

async function chooseToday(page: Page, triggerName: RegExp) {
  await page.getByRole("button", { name: triggerName }).click();
  const calendar = page.getByRole("dialog").last();
  await expect(calendar).toBeVisible();
  await calendar.getByRole("button", { name: "Today", exact: true }).click();
  await expect(calendar).toBeHidden();
}

async function assertNoDownload(page: Page, action: () => Promise<void>) {
  const downloadPromise = page
    .waitForEvent("download", { timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  await action();
  expect(await downloadPromise).toBe(false);
}

async function assertTableViewport(
  page: Page,
  options: { nearDesktopViewportBottom?: boolean } = {},
) {
  const viewport = page.locator('[data-ui="gym-actions-table-viewport"]');
  const footer = page.locator('[data-ui="gym-actions-table-footer"]');
  await expect(viewport).toHaveCount(1);
  await expect(footer).toHaveCount(1);

  const viewportBox = await viewport.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  if (viewportBox && footerBox) {
    expect(footerBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height - 1);
    const sectionBox = await viewport.locator("xpath=ancestor::section[1]").boundingBox();
    expect(sectionBox).not.toBeNull();
    if (sectionBox) {
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
        sectionBox.y + sectionBox.height + 1,
      );
    }

    if (options.nearDesktopViewportBottom) {
      const viewportSize = await page.evaluate(() => ({
        height: window.innerHeight,
        width: window.innerWidth,
      }));
      const footerBottom = footerBox.y + footerBox.height;
      expect(footerBottom).toBeGreaterThanOrEqual(viewportSize.height - 240);
      expect(footerBottom).toBeLessThanOrEqual(viewportSize.height + 2);
      expect(sectionBox?.x ?? 0).toBeGreaterThanOrEqual(0);
      expect((sectionBox?.x ?? 0) + (sectionBox?.width ?? viewportSize.width)).toBeLessThanOrEqual(
        viewportSize.width + 1,
      );
    }
  }

  const rows = page.locator('[data-ui="gym-actions-table-viewport"] tbody tr.fit-table-row');
  if (await rows.count()) {
    const rowBox = await rows.first().boundingBox();
    expect(rowBox).not.toBeNull();
    if (rowBox) expect(rowBox.height).toBeLessThan(200);
  }
}

function assertInclusiveLocalDayBoundary(url: URL) {
  const rawStart = url.searchParams.get("start_date");
  const rawEnd = url.searchParams.get("end_date");
  expect(rawStart).toBeTruthy();
  expect(rawEnd).toBeTruthy();
  if (!rawStart || !rawEnd) return;

  const start = new Date(rawStart);
  const end = new Date(rawEnd);
  expect(start.getTime()).not.toBeNaN();
  expect(end.getTime()).not.toBeNaN();
  expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ]);
  expect(start.getTime()).toBe(
    new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime(),
  );
  expect(end.getTime()).toBe(
    new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999).getTime(),
  );
}

test("Gym Actions composes action filters, FitTrack attendance dates, and scoped PDF export", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Gym Actions contract spec runs once on the desktop web project.",
  );

  const attendanceRequests: string[] = [];
  const exportRequests: Record<string, unknown>[] = [];
  await loginAdmin(page);
  await installFixtures(page, attendanceRequests, exportRequests);
  await page.goto("/gym-actions", { waitUntil: "domcontentloaded" });

  const actionType = page.getByRole("button", {
    name: /Filter recent activity by action type: All action types/i,
  });
  await expect(actionType).toBeVisible();
  await actionType.click();
  await page.getByRole("menuitem", { name: "Attendance", exact: true }).click();
  await expect(page.getByText("Attendance check-in", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByText(/7 attendance records/)).toBeVisible();
  await chooseToday(page, /Filter attendance from date/i);
  await chooseToday(page, /Filter attendance to date/i);
  await expect(page.getByText(/Day:/)).toBeVisible();
  await expect(page.getByText(/Showing 1–6 of 7/)).toBeVisible();

  const latestAttendanceRequest = attendanceRequests.at(-1);
  expect(latestAttendanceRequest).toBeTruthy();
  if (latestAttendanceRequest) {
    const url = new URL(latestAttendanceRequest);
    assertInclusiveLocalDayBoundary(url);
  }

  await assertTableViewport(page, { nearDesktopViewportBottom: true });
  const auditTabs = ["Recent Activity", "Transaction History", "Audit Log"];
  for (const tab of auditTabs) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await assertTableViewport(page, { nearDesktopViewportBottom: true });
  }
  await page.getByRole("button", { name: "Audit Log", exact: true }).click();
  const compactChip = page.locator('[data-ui="gym-actions-compact-chip"] > *').first();
  await expect(compactChip).toBeVisible();
  await expect
    .poll(() => compactChip.evaluate((element) => getComputedStyle(element).borderRadius))
    .toBe("5px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth) + 1,
  );

  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByText(/7 attendance records/)).toBeVisible();

  const exportTrigger = page.getByRole("button", { name: "EXPORT PDF", exact: true });
  await expect(exportTrigger).toBeVisible();
  await exportTrigger.click();
  const exportModal = page.getByRole("dialog", { name: "Export Gym Actions PDF" });
  await expect(exportModal).toBeVisible();
  await expect(exportModal.getByText(/active tab and filters/i)).toBeVisible();

  const scopeGroup = exportModal.getByRole("radiogroup", { name: "Export scope" });
  await expect(scopeGroup.getByRole("radio")).toHaveCount(2);
  const currentScope = scopeGroup.getByRole("radio", { name: "Current page", exact: true });
  const allScope = scopeGroup.getByRole("radio", { name: "All pages", exact: true });
  await expect(currentScope).toBeChecked();
  await expect(allScope).not.toBeChecked();
  await expect(exportModal.getByRole("button", { name: "CANCEL", exact: true })).toBeEnabled();
  await expect(exportModal.getByRole("button", { name: "EXPORT PDF", exact: true })).toBeEnabled();

  await assertNoDownload(page, () =>
    exportModal.getByRole("button", { name: "CANCEL", exact: true }).click(),
  );
  await expect(exportModal).toBeHidden();
  expect(exportRequests).toHaveLength(0);

  await exportTrigger.click();
  await expect(exportModal).toBeVisible();
  await expect(
    exportModal.getByRole("radio", { name: "Current page", exact: true }),
  ).toBeChecked();
  const currentDownloadPromise = page.waitForEvent("download");
  await exportModal.getByRole("button", { name: "EXPORT PDF", exact: true }).click();
  const currentDownload = await currentDownloadPromise;
  expect(currentDownload.suggestedFilename()).toBe("attendance-export.pdf");
  await expect.poll(() => exportRequests.length).toBe(1);
  expect(exportRequests[0]).toMatchObject({
    section: "attendance",
    total_records: 6,
  });
  expect(exportRequests[0]?.filter_summaries).toEqual(
    expect.arrayContaining([expect.stringMatching(/From:/i)]),
  );
  const currentRows = exportRequests[0]?.rows;
  expect(Array.isArray(currentRows)).toBe(true);
  if (Array.isArray(currentRows)) expect(currentRows).toHaveLength(6);
  if (await exportModal.isVisible()) {
    await expect(
      exportModal.getByRole("button", { name: "EXPORT PDF", exact: true }),
    ).toBeEnabled();
    await exportModal.getByRole("button", { name: "CANCEL", exact: true }).click();
    await expect(exportModal).toBeHidden();
  }

  await exportTrigger.click();
  await expect(exportModal).toBeVisible();
  await allScope.check();
  await expect(allScope).toBeChecked();
  const attendanceRequestsBeforeAllExport = attendanceRequests.length;
  const allDownloadPromise = page.waitForEvent("download");
  await exportModal.getByRole("button", { name: "EXPORT PDF", exact: true }).click();
  const allDownload = await allDownloadPromise;
  expect(allDownload.suggestedFilename()).toBe("attendance-export.pdf");
  await expect.poll(() => exportRequests.length).toBe(2);
  expect(exportRequests[1]).toMatchObject({
    section: "attendance",
    total_records: 7,
  });
  expect(exportRequests[1]?.filter_summaries).toEqual(
    expect.arrayContaining([expect.stringMatching(/To:/i)]),
  );
  const allRows = exportRequests[1]?.rows;
  expect(Array.isArray(allRows)).toBe(true);
  if (Array.isArray(allRows)) expect(allRows).toHaveLength(7);
  const allExportAttendancePages = attendanceRequests
    .slice(attendanceRequestsBeforeAllExport)
    .map((requestUrl) => Number(new URL(requestUrl).searchParams.get("page") ?? "1"));
  expect(allExportAttendancePages).toEqual(expect.arrayContaining([1, 2]));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Recent Activity", exact: true }).click();
  await assertTableViewport(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth) + 1,
  );

  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByText(/7 attendance records/)).toBeVisible();
});
