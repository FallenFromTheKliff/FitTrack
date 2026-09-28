import { readFile } from "node:fs/promises";

import { expect, test, type Download, type Page } from "@playwright/test";

import {
  FIXED_NOW,
  createAnalyticsFixture,
  installAnalyticsFixture,
} from "./ai-analytics-generation.runtime.spec";

const SAVED_ID = "55555555-5555-4555-8555-555555555555";
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n% synthetic saved insight fixture\n%%EOF\n",
  "ascii",
);

type ExportMode = "pending" | "success" | "error";

type ExportHarness = {
  fixture: Awaited<ReturnType<typeof installAnalyticsFixture>>;
  getExportBodies: () => Array<Record<string, unknown>>;
  getExportCalls: () => number;
  getExportMethods: () => string[];
  getExportPaths: () => string[];
  setMode: (mode: ExportMode) => void;
  releasePending: () => void;
};

function savedInsight(): Record<string, unknown> {
  return {
    id: SAVED_ID,
    requested_by: "88888888-8888-4888-8888-888888888888",
    requester: null,
    focus: "overview",
    analysis_depth: "brief",
    selected_sections: ["overview"],
    period: "monthly",
    start_date: "2026-08-01",
    end_date: "2026-09-08",
    summary: "Saved synthetic insight for the PDF route journey.",
    highlights: ["Saved evidence is available for export."],
    risks: ["Synthetic export risk for retry coverage."],
    opportunities: ["Synthetic export opportunity for route coverage."],
    anomaly_flags: [],
    recommended_actions: [
      "Operations - next 7 days - verify the saved snapshot.",
    ],
    model_used: "mock-provider",
    token_count: 12,
    latency_ms: 8,
    created_at: FIXED_NOW,
  };
}

async function prepareHarness(
  page: Page,
  initialMode: ExportMode,
): Promise<ExportHarness> {
  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));

  const fixture = createAnalyticsFixture("success");
  fixture.latestInsight = savedInsight();
  await installAnalyticsFixture(page, fixture);

  let mode = initialMode;
  const exportBodies: Array<Record<string, unknown>> = [];
  let exportCalls = 0;
  const exportMethods: string[] = [];
  const exportPaths: string[] = [];
  let release: (() => void) | null = null;

  await page.route(
    /\/v1\/business-analytics\/insights\/[^/]+\/export\/pdf$/,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      exportCalls += 1;
      exportMethods.push(request.method());
      exportPaths.push(url.pathname);
      if (request.method() === "POST") {
        try {
          exportBodies.push(request.postDataJSON() as Record<string, unknown>);
        } catch {
          exportBodies.push({});
        }
      }

      if (mode === "pending") {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      if (mode === "error") {
        await route.fulfill({
          status: 500,
          headers: { "cache-control": "no-store" },
          contentType: "application/json",
          body: JSON.stringify({ detail: "Synthetic saved export failure." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": "http://127.0.0.1:8080",
          "access-control-expose-headers": "Content-Disposition",
          "cache-control": "no-store",
          "content-disposition":
            'attachment; filename="fittrack-business-insight-2026-09-08.pdf"',
        },
        contentType: "application/pdf",
        body: PDF_BYTES,
      });
    },
  );

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Latest AI Insight", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved AI Insight: Overview", { exact: true }),
  ).toBeVisible();

  return {
    fixture,
    getExportBodies: () => [...exportBodies],
    getExportCalls: () => exportCalls,
    getExportMethods: () => [...exportMethods],
    getExportPaths: () => [...exportPaths],
    setMode: (nextMode) => {
      mode = nextMode;
    },
    releasePending: () => {
      release?.();
      release = null;
    },
  };
}

function latestExportButton(page: Page) {
  return page.locator(".analytics-ai-generated-card").getByRole("button");
}

function insightExportDialog(page: Page) {
  return page.getByRole("dialog", { name: "Export AI Insight PDF" });
}

async function expectDownloadedBytes(download: Download) {
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  await expect(readFile(filePath!)).resolves.toEqual(PDF_BYTES);
}

test("analytics-insight-pdf-export: confirmation uses the saved id and guards duplicate clicks while pending", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const harness = await prepareHarness(page, "pending");
  const button = latestExportButton(page);
  await expect(button).toHaveCount(1);
  await expect(button).toHaveText("EXPORT PDF");

  await button.click();
  const dialog = insightExportDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", {
      name: "Compare with previous AI insight",
    }),
  ).toBeChecked();
  await expect(
    dialog.getByText(
      "No previous AI insight is available. The PDF will show N/A - Insufficient Data.",
      { exact: true },
    ),
  ).toBeVisible();

  const modalExportButton = dialog.getByRole("button", {
    name: /^(EXPORT PDF|PREPARING PDF\.\.\.)$/,
  });
  const downloadPromise = page.waitForEvent("download");
  await modalExportButton.click();
  await expect(modalExportButton).toHaveText("PREPARING PDF...");
  await expect(modalExportButton).toBeDisabled();
  await expect(button).toHaveText("PREPARING PDF...");
  await expect(button).toBeDisabled();
  await expect.poll(harness.getExportCalls).toBe(1);

  await modalExportButton.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(100);
  expect(harness.getExportCalls()).toBe(1);

  harness.setMode("success");
  harness.releasePending();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "fittrack-business-insight-2026-09-08.pdf",
  );
  await expectDownloadedBytes(download);
  await expect(dialog).toBeHidden();
  expect(harness.getExportMethods()).toEqual(["POST"]);
  expect(harness.getExportBodies()).toEqual([{ compare_previous: true }]);
  expect(harness.getExportPaths()).toEqual([
    `/v1/business-analytics/insights/${SAVED_ID}/export/pdf`,
  ]);
  expect(harness.fixture.unhandled).toEqual([]);
  expect(harness.fixture.pageErrors).toEqual([]);
});

test("analytics-insight-pdf-export: saved export failure surfaces a retryable error", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const harness = await prepareHarness(page, "error");
  const button = latestExportButton(page);

  await button.click();
  const dialog = insightExportDialog(page);
  const modalExportButton = dialog.getByRole("button", {
    name: /^(EXPORT PDF|PREPARING PDF\.\.\.)$/,
  });
  await modalExportButton.click();
  await expect(
    page.getByText("Couldn't export the saved insight PDF.", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(modalExportButton).toHaveText("EXPORT PDF");
  await expect(modalExportButton).toBeEnabled();
  expect(harness.getExportCalls()).toBe(1);

  harness.setMode("success");
  const comparisonToggle = dialog.getByRole("checkbox", {
    name: "Compare with previous AI insight",
  });
  await comparisonToggle.uncheck();
  await expect(comparisonToggle).not.toBeChecked();
  const downloadPromise = page.waitForEvent("download");
  await modalExportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "fittrack-business-insight-2026-09-08.pdf",
  );
  await expectDownloadedBytes(download);
  await expect(dialog).toBeHidden();
  await expect(button).toHaveText("EXPORT PDF");
  await expect(button).toBeEnabled();
  expect(harness.getExportCalls()).toBe(2);
  expect(harness.getExportMethods()).toEqual(["POST", "POST"]);
  expect(harness.getExportBodies()).toEqual([
    { compare_previous: true },
    { compare_previous: false },
  ]);
  expect(harness.getExportPaths()).toEqual([
    `/v1/business-analytics/insights/${SAVED_ID}/export/pdf`,
    `/v1/business-analytics/insights/${SAVED_ID}/export/pdf`,
  ]);
  expect(harness.fixture.unhandled).toEqual([]);
  expect(harness.fixture.pageErrors).toEqual([]);
});
