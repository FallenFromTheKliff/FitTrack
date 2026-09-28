import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };
const FOCUSES = [
  "overview",
  "revenue",
  "attendance",
  "membership",
  "coaching",
  "inventory",
] as const;
const ANALYSIS_DEPTHS = ["brief", "detailed", "deep"] as const;

type InsightSection = (typeof FOCUSES)[number];
type InsightDepth = (typeof ANALYSIS_DEPTHS)[number];

function isInsightSection(value: unknown): value is InsightSection {
  return (
    typeof value === "string" &&
    (FOCUSES as readonly string[]).includes(value)
  );
}

function isInsightDepth(value: unknown): value is InsightDepth {
  return (
    typeof value === "string" &&
    (ANALYSIS_DEPTHS as readonly string[]).includes(value)
  );
}

async function loginAdmin(page: Page) {
  const artifactRoot = resolve(process.cwd(), ".artifacts");
  let manifest: { credentials: Credential[] } | null = null;

  for (const fileName of [
    "dynamic-seed-manifest.json",
    "test-data-manifest.json",
  ]) {
    try {
      manifest = JSON.parse(
        await readFile(resolve(artifactRoot, fileName), "utf8"),
      ) as { credentials: Credential[] };
      break;
    } catch {
      // Try the next supported local seed manifest.
    }
  }

  if (!manifest) throw new Error("Missing seeded credential manifest.");
  const credential = manifest.credentials.find(({ role }) => role === "admin");
  if (!credential) throw new Error("Missing seeded admin credential.");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email Address").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

function insightRecord(body: Record<string, unknown>) {
  const requestedSections = Array.isArray(body.selected_sections)
    ? body.selected_sections.filter(isInsightSection)
    : [];
  const focus = isInsightSection(body.focus)
    ? body.focus
    : (requestedSections[0] ?? "overview");
  const selectedSections = requestedSections.length
    ? requestedSections
    : [focus];
  const analysisDepth = isInsightDepth(body.analysis_depth)
    ? body.analysis_depth
    : "brief";

  return {
    id: `11111111-1111-4111-8111-${FOCUSES.indexOf(focus).toString().padStart(12, "0")}`,
    requested_by: "admin-runtime",
    requester: null,
    focus,
    analysis_depth: analysisDepth,
    selected_sections: selectedSections,
    period: body.period ?? "monthly",
    start_date: body.start_date ?? "2026-08-01",
    end_date: body.end_date ?? "2026-08-31",
    summary: `Backend fallback summary for ${focus}: check-ins increased against the prior period, so staffing should follow demand.`,
    highlights: [
      `Highlight one for ${focus}; evidence changes an operating decision.`,
      `Highlight two for ${focus}; concentration affects capacity.`,
      `Highlight three for ${focus}; the comparison changes priority.`,
      "Hidden fourth highlight; the panel should prioritize only three.",
    ],
    risks: [
      `Priority risk for ${focus}; the measured change could constrain service.`,
    ],
    opportunities: [
      "Evidence-backed opportunity; the implication is measurable.",
    ],
    anomaly_flags: [
      `Anomaly for ${focus}; the variance warrants a bounded correction.`,
    ],
    recommended_actions: [
      "Operations · next 7 days — align coverage to demand. Success: wait time stays below 3 minutes.",
      "Membership · next 7 days — complete cohort onboarding. Success: 100% receive a touchpoint.",
      "Finance · next 3 days — attribute the period change. Success: 100% of the change is sourced.",
      "Hidden · later — this fourth action must not render. Success: hidden.",
    ],
    model_used: "grounded-fallback",
    token_count: null,
    latency_ms: 35,
    created_at: "2026-08-25T05:00:00.000Z",
  };
}

test("analytics renders backend fallback decisions for selected sections and depth", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const postedBodies: Array<Record<string, unknown>> = [];
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginAdmin(page);
  await page.route("**/business-analytics/insights**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { page: 1, limit: 1, total: 0, total_pages: 0 },
        }),
      });
      return;
    }

    if (request.method() !== "POST") {
      await route.abort("blockedbyclient");
      return;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.postDataJSON();
    } catch {
      await route.abort("blockedbyclient");
      return;
    }

    if (
      !parsedBody ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      await route.abort("blockedbyclient");
      return;
    }

    const body = parsedBody as Record<string, unknown>;

    const selectedSections = body.selected_sections;
    if (
      !Array.isArray(selectedSections) ||
      selectedSections.length === 0 ||
      selectedSections.some((section) => !isInsightSection(section)) ||
      !isInsightDepth(body.analysis_depth)
    ) {
      await route.abort("blockedbyclient");
      return;
    }

    postedBodies.push(body);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: insightRecord(body) }),
    });
  });

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Latest AI Insight", { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  });
  const insightSections = page.getByRole("group", { name: "Insight sections" });
  await expect(insightSections).toBeVisible();
  const sectionTrigger = page.getByRole("button", {
    name: "Select insight sections",
  });
  const generate = page.getByRole("button", { name: "GENERATE AI INSIGHTS" });

  await expect(sectionTrigger).toContainText("Overview");
  await sectionTrigger.click();
  const revenueSection = page.getByRole("menuitemcheckbox", {
    name: "Include Revenue insight section",
  });
  const attendanceSection = page.getByRole("menuitemcheckbox", {
    name: "Include Attendance insight section",
  });
  await expect(revenueSection).toBeVisible();
  await revenueSection.click();
  await expect(revenueSection).toBeVisible();
  await expect(attendanceSection).toBeVisible();
  await attendanceSection.click();
  await expect(attendanceSection).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(attendanceSection).toBeHidden();
  await expect(sectionTrigger).toContainText("3 sections selected");

  const depthTrigger = page.getByRole("button", {
    name: "Analysis depth: Brief",
  });
  await expect(depthTrigger).toBeVisible();
  await depthTrigger.click();
  const deepOption = page.getByRole("menuitem", { name: "Deep", exact: true });
  await expect(deepOption).toBeVisible();
  await deepOption.click();
  const selectedDepthTrigger = page.getByRole("button", {
    name: "Analysis depth: Deep",
  });
  await expect(selectedDepthTrigger).toBeVisible();
  await expect(selectedDepthTrigger).toHaveAttribute("data-value", "Deep");
  await expect(
    page.getByText(
      "A deeper cross-section readout for planning decisions.",
      { exact: true },
    ),
  ).toBeVisible();

  const expectedSections = ["overview", "revenue", "attendance"];
  await generate.click();
  await expect.poll(() => postedBodies.length).toBe(1);
  expect(postedBodies[0].selected_sections).toEqual(expectedSections);
  expect(postedBodies[0].analysis_depth).toBe("deep");
  expect(postedBodies[0]).not.toHaveProperty("focus");
  await expect(
    page.getByText(
      "Backend fallback summary for overview: check-ins increased against the prior period, so staffing should follow demand.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Depth · Deep", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sections · Overview, Revenue, Attendance", {
      exact: true,
    }),
  ).toBeVisible();

  await expect(page.getByText("Top highlights", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Priority risks & anomalies", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Priority risk for overview/)).toBeVisible();
  await expect(page.getByText(/Anomaly for overview/)).toBeVisible();
  await expect(
    page.getByText("Hidden fourth highlight", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByText("Hidden · later", { exact: false })).toHaveCount(
    0,
  );
  expect(postedBodies).toHaveLength(1);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `analytics-insights-${testInfo.project.name}.png`,
    ),
  });
});

test("PDF export can skip, generate, and then reuse a matching saved insight", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  let generatedInsight: ReturnType<typeof insightRecord> | null = null;
  let generateRequests = 0;
  const pdfPayloads: Array<Record<string, unknown>> = [];

  await loginAdmin(page);
  await page.route("**/business-analytics/insights**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      generateRequests += 1;
      generatedInsight = insightRecord(body);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: generatedInsight }),
      });
      return;
    }

    if (request.method() !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }

    if (generatedInsight && url.pathname.endsWith(`/${generatedInsight.id}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: generatedInsight }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: generatedInsight ? [generatedInsight] : [],
        meta: {
          page: 1,
          limit: 1,
          total: generatedInsight ? 1 : 0,
          total_pages: generatedInsight ? 1 : 0,
        },
      }),
    });
  });
  await page.route("**/analytics/export/pdf", async (route) => {
    pdfPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      headers: {
        "content-disposition": 'attachment; filename="fittrack-test.pdf"',
        "content-type": "application/pdf",
      },
      body: Buffer.from("%PDF-1.4\n%%EOF"),
    });
  });

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Latest AI Insight", { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  });

  const openPdfPicker = async () => {
    await page
      .getByRole("button", { name: "EXPORT PDF", exact: true })
      .first()
      .click();
    const picker = page.getByRole("dialog", { name: "Export Analytics PDF" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "CONTINUE" }).click();
  };

  await openPdfPicker();
  const choice = page.getByRole("dialog", { name: "No matching AI insight" });
  await expect(choice).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `analytics-pdf-insight-choice-${testInfo.project.name}.png`,
    ),
  });
  await choice.getByRole("button", { name: "NO, CONTINUE WITHOUT AI" }).click();
  const skipConfirmation = page.getByRole("dialog", {
    name: "Confirm export without AI insight",
  });
  await expect(skipConfirmation).toBeVisible();
  await skipConfirmation
    .getByRole("button", { name: "EXPORT WITHOUT AI INSIGHT" })
    .click();
  await expect.poll(() => pdfPayloads.length).toBe(1);
  expect(pdfPayloads[0].selected_sections).not.toContain("recommendations");
  expect(pdfPayloads[0]).not.toHaveProperty("insight_run_id");
  expect(generateRequests).toBe(0);

  await openPdfPicker();
  await expect(choice).toBeVisible();
  await choice.getByRole("button", { name: "YES, GENERATE INSIGHT" }).click();
  const generateConfirmation = page.getByRole("dialog", {
    name: "Confirm insight generation",
  });
  await expect(generateConfirmation).toBeVisible();
  await generateConfirmation
    .getByRole("button", { name: "GENERATE & EXPORT" })
    .click();
  await expect.poll(() => pdfPayloads.length).toBe(2);
  expect(generateRequests).toBe(1);
  expect(pdfPayloads[1].selected_sections).toContain("recommendations");
  expect(pdfPayloads[1].insight_run_id).toBe(generatedInsight?.id);

  await openPdfPicker();
  const reuseConfirmation = page.getByRole("dialog", {
    name: "Confirm PDF export",
  });
  await expect(reuseConfirmation).toContainText(
    "No new AI request will be made",
  );
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `analytics-pdf-reuse-confirmation-${testInfo.project.name}.png`,
    ),
  });
  await reuseConfirmation
    .getByRole("button", { name: "EXPORT WITH SAVED INSIGHT" })
    .click();
  await expect.poll(() => pdfPayloads.length).toBe(3);
  expect(generateRequests).toBe(1);
  expect(pdfPayloads[2].insight_run_id).toBe(generatedInsight?.id);
});
