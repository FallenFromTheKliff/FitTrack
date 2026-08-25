import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compare, type ODiffResult } from "odiff-bin";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import type { getVisualReference } from "./reference-manifest";

type VisualReference = ReturnType<typeof getVisualReference>;

export type AggregateRegion = {
  minLine: number;
  maxLine: number;
  minCol: number;
  maxCol: number;
} | null;

export type VisualDiffResult = {
  match: boolean;
  reason: string;
  diffCount: number | null;
  diffPercentage: number | null;
  diffLines: number[];
  diffCols: number[];
  aggregateRegion: AggregateRegion;
};

export type VisualMatchOptions = {
  page: Page;
  testInfo: TestInfo;
  visualCase: VisualReference;
  masks: readonly Locator[];
  layoutAudit: unknown;
};

const VISUAL_RUN_ROOT = [
  ".artifacts",
  "playwright",
  "visual-runs",
] as const;

function safeSegment(value: string, fallback: string) {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 80) || fallback;
}

const VISUAL_RUN_ID = (() => {
  const requested = process.env.VISUAL_RUN_ID;
  if (requested) return safeSegment(requested, "run");
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `run-${timestamp}-${process.pid}`;
})();

export function getVisualArtifactDirectory(testInfo: TestInfo, caseId: string) {
  return resolve(
    process.cwd(),
    ...VISUAL_RUN_ROOT,
    VISUAL_RUN_ID,
    safeSegment(`${caseId}-${testInfo.project.name}`, "visual-case"),
  );
}

function aggregateRegion(diffLines: readonly number[], diffCols: readonly number[]) {
  if (diffLines.length === 0 || diffCols.length === 0) return null;
  return {
    minLine: Math.min(...diffLines),
    maxLine: Math.max(...diffLines),
    minCol: Math.min(...diffCols),
    maxCol: Math.max(...diffCols),
  };
}

export function normalizeDiffResult(result: ODiffResult): VisualDiffResult {
  if (result.match) {
    return {
      match: true,
      reason: "match",
      diffCount: 0,
      diffPercentage: 0,
      diffLines: [],
      diffCols: [],
      aggregateRegion: null,
    };
  }

  if (result.reason === "pixel-diff") {
    const diffLines = result.diffLines ?? [];
    const diffCols = result.diffCols ?? [];
    return {
      match: false,
      reason: result.reason,
      diffCount: result.diffCount,
      diffPercentage: result.diffPercentage,
      diffLines,
      diffCols,
      aggregateRegion: aggregateRegion(diffLines, diffCols),
    };
  }

  return {
    match: false,
    reason: result.reason,
    diffCount: null,
    diffPercentage: null,
    diffLines: [],
    diffCols: [],
    aggregateRegion: null,
  };
}

function failedDiffResult(reason: string): VisualDiffResult {
  return {
    match: false,
    reason,
    diffCount: null,
    diffPercentage: null,
    diffLines: [],
    diffCols: [],
    aggregateRegion: null,
  };
}

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function attachIfPresent(
  testInfo: TestInfo,
  name: string,
  filePath: string,
  contentType: string,
) {
  if (await exists(filePath)) {
    await testInfo.attach(name, { path: filePath, contentType });
  }
}

export async function expectVisualMatch({
  page,
  testInfo,
  visualCase,
  masks,
  layoutAudit,
}: VisualMatchOptions) {
  const artifactDirectory = getVisualArtifactDirectory(testInfo, visualCase.id);
  await mkdir(artifactDirectory, { recursive: true });

  const expectedPath = resolve(artifactDirectory, "expected.png");
  const actualPath = resolve(artifactDirectory, "actual.png");
  const diffPath = resolve(artifactDirectory, "diff.png");
  const diffResultPath = resolve(artifactDirectory, "diff-result.json");
  const layoutAuditPath = resolve(artifactDirectory, "layout-audit.json");
  const baselinePath = testInfo.snapshotPath(visualCase.snapshot);
  const screenshotOptions = {
    mask: masks.length > 0 ? [...masks] : undefined,
    animations: "disabled" as const,
    caret: "hide" as const,
    scale: "css" as const,
  };
  const baselineEligible =
    visualCase.baselineStatus === "approved" &&
    visualCase.referenceSource?.provider === "browser-capture";

  await writeFile(layoutAuditPath, JSON.stringify(layoutAudit, null, 2), "utf8");

  let playwrightError: unknown;
  const updateSnapshots =
    baselineEligible && testInfo.config.updateSnapshots !== "none";
  if (updateSnapshots) {
    try {
      await expect(page).toHaveScreenshot(visualCase.snapshot, {
        mask: screenshotOptions.mask,
        maxDiffPixels: visualCase.diffPolicy.maxDiffPixels,
        threshold: visualCase.diffPolicy.threshold,
      });
    } catch (error) {
      playwrightError = error;
    }
  }

  await page.screenshot({ path: actualPath, ...screenshotOptions });
  const baselineExists = baselineEligible && (await exists(baselinePath));
  if (baselineExists) {
    await copyFile(baselinePath, expectedPath);
  }

  let diffResult: VisualDiffResult;
  if (!baselineEligible) {
    diffResult = failedDiffResult("baseline-not-approved");
  } else if (!baselineExists) {
    diffResult = failedDiffResult("file-not-exists");
  } else {
    try {
      const odiffResult = await compare(baselinePath, actualPath, diffPath, {
        threshold: visualCase.diffPolicy.threshold,
        captureDiffLines: true,
        captureDiffCols: true,
        failOnLayoutDiff: true,
        noFailOnFsErrors: true,
      });
      diffResult = normalizeDiffResult(odiffResult);
    } catch (error) {
      diffResult = failedDiffResult(
        `odiff-error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!updateSnapshots && baselineEligible) {
    try {
      await expect(page).toHaveScreenshot(visualCase.snapshot, {
        mask: screenshotOptions.mask,
        maxDiffPixels: visualCase.diffPolicy.maxDiffPixels,
        threshold: visualCase.diffPolicy.threshold,
      });
    } catch (error) {
      playwrightError = error;
    }
  }

  await writeFile(diffResultPath, JSON.stringify(diffResult, null, 2), "utf8");
  await attachIfPresent(testInfo, "visual-layout-audit.json", layoutAuditPath, "application/json");

  if (diffResult.match && !playwrightError) return diffResult;

  await attachIfPresent(testInfo, "visual-expected.png", expectedPath, "image/png");
  await attachIfPresent(testInfo, "visual-actual.png", actualPath, "image/png");
  await attachIfPresent(testInfo, "visual-diff.png", diffPath, "image/png");
  await attachIfPresent(testInfo, "visual-diff-result.json", diffResultPath, "application/json");

  if (playwrightError) throw playwrightError;
  throw new Error(
    `ODiff visual mismatch (${diffResult.reason}) for ${visualCase.id}; ` +
      `artifacts retained at ${artifactDirectory}`,
  );
}
