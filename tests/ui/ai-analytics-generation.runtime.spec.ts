import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

export const FIXED_NOW = "2026-09-08T04:00:00.000Z";
export const ADMIN_ID = "88888888-8888-4888-8888-888888888888";

export type GenerationMode = "pending" | "success" | "fallback" | "failure" | "error";

export type AnalyticsFixture = {
  mode: GenerationMode;
  latestInsight: Record<string, unknown> | null;
  generationRequests: number;
  postedBodies: Array<Record<string, unknown>>;
  releaseGeneration: (() => void) | null;
  unhandled: string[];
  pageErrors: string[];
  consoleErrors: string[];
  observed: string[];
};

const CORS_HEADERS = {
  "access-control-allow-credentials": "true",
  "access-control-allow-origin": "http://127.0.0.1:8080",
  "access-control-allow-headers": "Authorization,Content-Type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "cache-control": "no-store",
};

const zeroTotals = () => ({
  total_revenue: "0.00",
  membership_revenue: "0.00",
  coaching_revenue: "0.00",
  venue_revenue: "0.00",
  other_revenue: "0.00",
  personal_training_revenue: "0.00",
  cash_membership_revenue: "0.00",
  gym_membership_revenue: "0.00",
  membership_card_revenue: "0.00",
  paymongo_membership_revenue: "0.00",
});

const adminProfile = () => ({
  id: ADMIN_ID,
  email: "admin-analytics@fittrack.test",
  email_verified: true,
  has_accepted_privacy: true,
  role: "ADMIN",
  status: "active",
  membership_card: null,
  profile: {
    first_name: "Ada",
    last_name: "Analytics Admin",
    activity_level: "active",
    fitness_goal: "maintenance",
  },
});

const analyticsSnapshot = () => ({
  generated_at: FIXED_NOW,
  daily_insights: {
    active_members: 0,
    recent_activities: 0,
    sessions_today: 0,
  },
  performance_kpis: {
    check_ins: 0,
    coaching_sessions: 0,
    new_members: 0,
    total_coaching_appointments: 0,
    total_venue_bookings: 0,
    total_revenue: "0.00",
  },
  recent_activities: [],
  system_alerts: [],
});

const analyticsOverview = () => ({
  start_date: "2026-08-01",
  end_date: "2026-09-08",
  completed_coaching_sessions: 0,
  new_members: 0,
  total_check_ins: 0,
  revenue: {
    totals: zeroTotals(),
  },
});

const analyticsRevenue = () => ({
  period: "monthly",
  start_date: "2026-08-01",
  end_date: "2026-09-08",
  totals: zeroTotals(),
  series: [],
  top_revenue_sources: [],
});

const analyticsAttendance = () => ({
  period: "monthly",
  start_date: "2026-08-01",
  end_date: "2026-09-08",
  total_check_ins: 0,
  series: [],
  peak_hours: [],
});

const analyticsMembers = () => ({
  start_date: "2026-08-01",
  end_date: "2026-09-08",
  active_members: 0,
  new_members: 0,
});

const analyticsCoaches = () => ({
  start_date: "2026-08-01",
  end_date: "2026-09-08",
  coaches: [],
});

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function insightRecord(
  body: Record<string, unknown>,
  mode: "success" | "fallback",
): Record<string, unknown> {
  const selectedSections = stringArray(body.selected_sections);
  const sections =
    selectedSections.length > 0 ? selectedSections : ["overview"];
  const analysisDepth =
    body.analysis_depth === "detailed" || body.analysis_depth === "deep"
      ? body.analysis_depth
      : "brief";
  const modelUsed = mode === "fallback" ? "grounded-fallback" : "mock-provider";
  const summary =
    mode === "fallback"
      ? "Synthetic dashboard fallback ready"
      : "Synthetic provider insight ready";

  return {
    id: "11111111-1111-4111-8111-000000000001",
    requested_by: ADMIN_ID,
    requester: null,
    focus: sections[0],
    analysis_depth: analysisDepth,
    selected_sections: sections,
    section_analyses: Object.fromEntries(
      sections.map((section) => [
        section,
        {
          summary: "Synthetic section analysis for " + section + ".",
          highlights: [],
          risks: [],
          opportunities: [],
        },
      ]),
    ),
    failed_sections: [],
    period: typeof body.period === "string" ? body.period : "monthly",
    start_date:
      typeof body.start_date === "string" ? body.start_date : "2026-08-01",
    end_date:
      typeof body.end_date === "string" ? body.end_date : "2026-09-08",
    summary,
    highlights: ["Synthetic dashboard evidence."],
    risks: [],
    opportunities: [],
    anomaly_flags: [],
    recommended_actions: [],
    model_used: modelUsed,
    token_count: 12,
    latency_ms: 8,
    created_at: FIXED_NOW,
  };
}

function historyEnvelope(fixture: AnalyticsFixture): Record<string, unknown> {
  const rows = fixture.latestInsight ? [fixture.latestInsight] : [];
  return {
    data: rows,
    meta: {
      page: 1,
      limit: 20,
      total: rows.length,
      total_pages: rows.length > 0 ? 1 : 0,
    },
  };
}

async function fulfillData(
  route: Route,
  data: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

async function fulfillBody(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function generationGate(fixture: AnalyticsFixture): Promise<void> {
  return new Promise<void>((resolve) => {
    fixture.releaseGeneration = () => {
      fixture.releaseGeneration = null;
      resolve();
    };
  });
}

export function createAnalyticsFixture(
  mode: GenerationMode = "pending",
): AnalyticsFixture {
  return {
    mode,
    latestInsight: null,
    generationRequests: 0,
    postedBodies: [],
    releaseGeneration: null,
    unhandled: [],
    pageErrors: [],
    consoleErrors: [],
    observed: [],
  };
}

export async function installAnalyticsFixture(
  page: Page,
  fixture: AnalyticsFixture = createAnalyticsFixture(),
): Promise<AnalyticsFixture> {
  page.on("pageerror", (error) => {
    fixture.pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      fixture.consoleErrors.push(message.text());
    }
  });

  await page.addInitScript(({ adminId }) => {
    localStorage.setItem("fittrack_access_token", "ai-analytics-fixture-token");
    localStorage.setItem(
      "fittrack_refresh_token",
      "ai-analytics-fixture-refresh",
    );
    localStorage.setItem(
      "fittrack_prefs_" + adminId,
      JSON.stringify({
        themeKey: "night",
        fontKey: "standard",
        animationLevel: "none",
      }),
    );
  }, { adminId: ADMIN_ID });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const label = method + " " + path;
    fixture.observed.push(label);

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (method === "POST" && path === "/v1/business-analytics/insights") {
      let body: Record<string, unknown> = {};
      try {
        body = asRecord(request.postDataJSON());
      } catch {
        body = {};
      }
      fixture.generationRequests += 1;
      fixture.postedBodies.push(body);

      if (fixture.mode === "pending") {
        await generationGate(fixture);
      }

      if (fixture.mode === "failure" || fixture.mode === "error") {
        await fulfillBody(
          route,
          { detail: "Synthetic provider request failed." },
          500,
        );
        return;
      }

      const outcome = fixture.mode === "fallback" ? "fallback" : "success";
      fixture.latestInsight = insightRecord(body, outcome);
      await fulfillData(route, fixture.latestInsight, 201);
      return;
    }

    if (method !== "GET") {
      fixture.unhandled.push(label);
      await route.abort();
      return;
    }

    switch (path) {
      case "/v1/users/me":
        await fulfillData(route, adminProfile());
        return;
      case "/v1/notifications/unread-count":
        await fulfillData(route, { count: 0, unread_count: 0 });
        return;
      case "/v1/notifications/my":
        await fulfillData(route, []);
        return;
      case "/v1/admin/users":
        await fulfillData(route, []);
        return;
      case "/v1/admin/deletion-requests":
        await fulfillData(route, []);
        return;
      case "/v1/analytics/snapshot":
        await fulfillData(route, analyticsSnapshot());
        return;
      case "/v1/analytics/overview":
        await fulfillData(route, analyticsOverview());
        return;
      case "/v1/analytics/revenue":
        await fulfillData(route, analyticsRevenue());
        return;
      case "/v1/analytics/attendance":
      case "/v1/analytics/attendance/drilldown":
        await fulfillData(route, analyticsAttendance());
        return;
      case "/v1/analytics/members":
        await fulfillData(route, analyticsMembers());
        return;
      case "/v1/analytics/coaches":
        await fulfillData(route, analyticsCoaches());
        return;
      case "/v1/business-analytics/insights":
        await fulfillBody(route, historyEnvelope(fixture));
        return;
      default:
        if (path.startsWith("/v1/business-analytics/insights/")) {
          if (fixture.latestInsight) {
            await fulfillData(route, fixture.latestInsight);
          } else {
            await fulfillBody(
              route,
              { detail: "Synthetic insight not found." },
              404,
            );
          }
          return;
        }

        fixture.unhandled.push(label);
        await route.abort();
    }
  });

  return fixture;
}

async function waitForSettledDialog(
  page: Page,
  dialog: Locator,
): Promise<void> {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  await expect(dialog).toBeVisible();

  let previousBounds: { x: number; y: number; width: number; height: number } | null =
    null;
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        const state = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const overlay =
            element.closest('[data-fit-modal-overlay="true"]') ??
            element.parentElement;
          const dialogStyle = getComputedStyle(element);
          const overlayStyle = overlay ? getComputedStyle(overlay) : null;
          const finiteAnimationRunning = (target: Element | null) =>
            target
              ? target.getAnimations().some((animation) => {
                  const iterations = animation.effect?.getTiming().iterations;
                  return (
                    animation.playState !== "finished" && iterations !== Infinity
                  );
                })
              : false;

          return {
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            dialogOpacity: Number(dialogStyle.opacity),
            overlayOpacity: overlayStyle
              ? Number(overlayStyle.opacity)
              : Number.NaN,
            overlayIsFixedOrTagged:
              overlayStyle?.position === "fixed" ||
              overlay?.getAttribute("data-fit-modal-overlay") === "true",
            finiteAnimationRunning:
              finiteAnimationRunning(element) ||
              finiteAnimationRunning(overlay),
          };
        });
        const { bounds, viewport } = state;
        const stable =
          previousBounds !== null &&
          Math.abs(previousBounds.x - bounds.x) < 0.5 &&
          Math.abs(previousBounds.y - bounds.y) < 0.5 &&
          Math.abs(previousBounds.width - bounds.width) < 0.5 &&
          Math.abs(previousBounds.height - bounds.height) < 0.5;
        previousBounds = bounds;

        return (
          stable &&
          state.dialogOpacity >= 0.99 &&
          state.overlayOpacity >= 0.99 &&
          state.overlayIsFixedOrTagged &&
          !state.finiteAnimationRunning &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= viewport.width + 0.5 &&
          bounds.y + bounds.height <= viewport.height + 0.5
        );
      },
      { timeout: 5_000, intervals: [50, 100, 200] },
    )
    .toBe(true);
}

test("synthetic admin analytics route renders its dashboard marker", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));
  const fixture = await installAnalyticsFixture(page);

  await page.goto("/analytics");
  await expect(page.getByText("Latest AI Insight", { exact: true })).toBeVisible();
  expect(fixture.unhandled).toEqual([]);
});

test("analytics generation holds a settled non-dismissible modal", async (
  { page },
  testInfo,
) => {
  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));
  const fixture = await installAnalyticsFixture(page);

  await page.goto("/analytics");
  await expect(page.getByText("Latest AI Insight", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Select insight sections" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Include Revenue insight section", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Include Attendance insight section", exact: true }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Analysis depth: Brief" }).click();
  await page.getByRole("menuitem", { name: "Deep", exact: true }).click();

  const generateButton = page.getByRole("button", {
    name: "GENERATE AI INSIGHTS",
    exact: true,
  });
  await generateButton.click();
  await expect.poll(() => fixture.generationRequests).toBe(1);

  const dialog = page.getByRole("dialog", {
    name: "Generating AI insights",
    exact: true,
  });
  await waitForSettledDialog(page, dialog);
  await expect(dialog).toContainText(
    "Analyzing your selected dashboard data. This may take a moment.",
  );
  await expect(dialog).toContainText(/Sections:.*Revenue.*Attendance/i);
  await expect(dialog).toContainText(/Depth:.*Deep/i);
  await expect(dialog.getByRole("progressbar")).toHaveCount(0);

  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
  expect(bounds!.width).toBeLessThanOrEqual(viewport!.width - 24);

  await expect(page.locator(".analytics-shell")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toMatch(/hidden|clip/);

  await page.screenshot({
    path: testInfo.outputPath("pending.png"),
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  const overlay = page.locator('[data-fit-modal-overlay="true"]').last();
  const overlayBounds = await overlay.boundingBox();
  expect(overlayBounds).not.toBeNull();
  await page.mouse.click(overlayBounds!.x + 4, overlayBounds!.y + 4);
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Tab");
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);

  expect(fixture.generationRequests).toBe(1);
  expect(fixture.postedBodies[0]?.selected_sections).toEqual(
    expect.arrayContaining(["revenue", "attendance"]),
  );
  expect(fixture.postedBodies[0]?.analysis_depth).toBe("deep");

  fixture.mode = "success";
  fixture.releaseGeneration?.();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Synthetic provider insight ready", { exact: true }),
  ).toBeVisible();
  await expect(generateButton).toBeEnabled();
  expect(fixture.unhandled).toEqual([]);
});

test("analytics generation recovers from fallback and error outcomes", async ({ page }, testInfo) => {
  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));
  const fixture = await installAnalyticsFixture(page);

  await page.goto("/analytics");
  await expect(page.getByText("Latest AI Insight", { exact: true })).toBeVisible();

  const generateButton = page.getByRole("button", {
    name: "GENERATE AI INSIGHTS",
    exact: true,
  });
  const pendingDialog = page.getByRole("dialog", {
    name: "Generating AI insights",
    exact: true,
  });

  fixture.mode = "fallback";
  await generateButton.click();
  await expect(
    page.getByText("Synthetic dashboard fallback ready", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dashboard data", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  await page.screenshot({
    path: testInfo.outputPath("fallback.png"),
    fullPage: false,
  });

  fixture.mode = "error";
  await generateButton.click();
  await expect(pendingDialog).toBeHidden();
  await expect(generateButton).toBeEnabled();
  await expect(
    page.getByText("Couldn't generate a new analytics insight.", { exact: true }),
  ).toBeVisible();

  fixture.mode = "success";
  await generateButton.click();
  await expect(
    page.getByText("Synthetic provider insight ready", { exact: true }),
  ).toBeVisible();
  await expect(generateButton).toBeEnabled();
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  await page.screenshot({
    path: testInfo.outputPath("recovered-success.png"),
    fullPage: false,
  });

  expect(fixture.generationRequests).toBe(3);
  expect(fixture.unhandled).toEqual([]);
  expect(fixture.pageErrors).toEqual([]);
  expect(
    fixture.consoleErrors.filter((message) => !/500|resource/i.test(message)),
  ).toEqual([]);
});


