import { expect, test, type Route } from "@playwright/test";

const ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const FIXED_NOW = "2026-09-11T04:00:00.000Z";
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n% deterministic analytics export\n%%EOF\n",
);

function responseHeaders(route: Route) {
  const origin = route.request().headers().origin;
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Authorization,Content-Type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    ...(origin ? { "access-control-allow-origin": origin } : {}),
    "cache-control": "no-store",
  };
}

async function fulfillData(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    headers: responseHeaders(route),
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

test("analytics export PDF uses accurate terminology and sends no exporter identity", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const unhandled: string[] = [];
  const pageErrors: string[] = [];
  const exportPayloads: Array<Record<string, unknown>> = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));
  await page.addInitScript(
    ({ adminId }) => {
      localStorage.setItem(
        "fittrack_access_token",
        "analytics-export-fixture-token",
      );
      localStorage.setItem(
        "fittrack_refresh_token",
        "analytics-export-fixture-refresh",
      );
      localStorage.setItem(
        `fittrack_prefs_${adminId}`,
        JSON.stringify({
          animationLevel: "none",
          fontKey: "standard",
          themeKey: "night",
        }),
      );
    },
    { adminId: ADMIN_ID },
  );

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/\/+$/, "") || "/";
    const label = `${method} ${path}`;

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: responseHeaders(route) });
      return;
    }

    if (method === "POST" && path === "/v1/analytics/export/pdf") {
      exportPayloads.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: {
          ...responseHeaders(route),
          "content-disposition":
            'attachment; filename="fittrack-analytics-2026-09-11.pdf"',
        },
        contentType: "application/pdf",
        body: PDF_BYTES,
      });
      return;
    }

    if (method !== "GET") {
      unhandled.push(label);
      await route.abort();
      return;
    }

    switch (path) {
      case "/v1/users/me":
        await fulfillData(route, {
          id: ADMIN_ID,
          email: "admin-analytics@fittrack.test",
          email_verified: true,
          has_accepted_privacy: true,
          membership_card: null,
          profile: {
            activity_level: "active",
            first_name: "Ada",
            fitness_goal: "maintenance",
            last_name: "Analytics Admin",
          },
          role: "ADMIN",
          status: "active",
        });
        return;
      case "/v1/notifications/unread-count":
        await fulfillData(route, { count: 0, unread_count: 0 });
        return;
      case "/v1/notifications/my":
      case "/v1/admin/users":
      case "/v1/admin/deletion-requests":
        await fulfillData(route, []);
        return;
      case "/v1/analytics/snapshot":
        await fulfillData(route, {
          daily_insights: {
            active_members: 2,
            recent_activities: 3,
            sessions_today: 1,
          },
          generated_at: FIXED_NOW,
          performance_kpis: {
            check_ins: 42,
            coaching_sessions: 7,
            new_members: 3,
            total_coaching_appointments: 6,
            total_revenue: "32500.00",
            total_venue_bookings: 9,
          },
          recent_activities: [],
          system_alerts: [],
        });
        return;
      case "/v1/analytics/overview":
        await fulfillData(route, {
          completed_coaching_sessions: 7,
          end_date: "2026-09-11",
          new_members: 3,
          revenue: { totals: { total_revenue: "32500.00" } },
          start_date: "2026-04-01",
          total_check_ins: 42,
        });
        return;
      case "/v1/analytics/revenue":
        await fulfillData(route, {
          end_date: "2026-09-11",
          period: "monthly",
          series: [],
          start_date: "2026-04-01",
          top_revenue_sources: [],
          totals: {
            booking_revenue: "0.00",
            cash_membership_revenue: "0.00",
            coaching_gym_revenue: "0.00",
            coaching_payments_collected: "0.00",
            gym_membership_revenue: "0.00",
            membership_card_revenue: "0.00",
            membership_revenue: "32500.00",
            paymongo_membership_revenue: "0.00",
            product_revenue: "0.00",
            total_revenue: "32500.00",
          },
        });
        return;
      case "/v1/analytics/attendance":
      case "/v1/analytics/attendance/drilldown":
        await fulfillData(route, {
          end_date: "2026-09-11",
          peak_hours: [],
          period: "monthly",
          series: [],
          start_date: "2026-04-01",
          total_check_ins: 42,
        });
        return;
      case "/v1/analytics/members":
        await fulfillData(route, {
          active_members: 2,
          end_date: "2026-09-11",
          new_members: 3,
          start_date: "2026-04-01",
        });
        return;
      case "/v1/analytics/coaches":
        await fulfillData(route, {
          coaches: [],
          end_date: "2026-09-11",
          start_date: "2026-04-01",
        });
        return;
      case "/v1/business-analytics/insights":
        await route.fulfill({
          status: 200,
          headers: responseHeaders(route),
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            meta: { limit: 20, page: 1, total: 0, total_pages: 0 },
          }),
        });
        return;
      default:
        unhandled.push(label);
        await route.abort();
    }
  });

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Data Analytics" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page
    .getByRole("button", { name: "EXPORT PDF", exact: true })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: "Export Analytics PDF" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Operations Snapshot", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Current operating totals and selected-window activity trends.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(dialog.getByText("Daily Insights", { exact: true })).toHaveCount(
    0,
  );
  await expect(dialog.locator("input[type=checkbox]:checked")).toHaveCount(7);

  await dialog.screenshot({
    path: testInfo.outputPath(
      `analytics-export-modal-${testInfo.project.name}.png`,
    ),
  });

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "EXPORT PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "fittrack-analytics-2026-09-11.pdf",
  );
  await expect.poll(() => exportPayloads.length).toBe(1);

  const payload = exportPayloads[0];
  expect(payload.selected_sections).toEqual([
    "kpis",
    "daily",
    "revenue",
    "attendance",
    "inventory",
    "alerts",
    "activities",
  ]);
  expect(payload).not.toHaveProperty("exported_by");
  expect(payload).not.toHaveProperty("exportedBy");
  expect(payload).not.toHaveProperty("exporter");
  expect(unhandled).toEqual([]);
  expect(pageErrors).toEqual([]);
});
