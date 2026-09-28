import { createHash } from "node:crypto";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compare, type ODiffResult } from "odiff-bin";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { getActiveVisualFixtureContract } from "../visual-fixtures.ts";
import {
  getMaxDiffPixelRatio,
  getMinimumSimilarity,
  type VisualBounds,
  type VisualCaptureEnvironment,
  type VisualCriticalRegion,
  type VisualReferenceSource,
  type getVisualReference,
} from "./reference-manifest.ts";
import { cropPng, readPngDimensions, type PngDimensions } from "./png-utils.ts";
import { assertVisualSeedScenario } from "./seed-contract.ts";

type VisualReference = ReturnType<typeof getVisualReference>;

export type AggregateRegion = {
  minLine: number;
  maxLine: number;
  minCol: number;
  maxCol: number;
} | null;

export type VisualDiffResult = {
  /** Compatibility alias for the final visual policy verdict. */
  match: boolean;
  reason: string;
  diffCount: number | null;
  diffPercentage: number | null;
  /** 100 - ODiff's diffPercentage, in percentage points. */
  similarityPercentage: number | null;
  /** ODiff's exact comparator verdict, before the 95% policy is applied. */
  comparatorMatch: boolean;
  /** The page/region similarity threshold verdict, before final gates. */
  similarityPolicyMatch: boolean;
  /** Final verdict after provenance, Playwright, and critical-region gates. */
  policyMatch: boolean;
  policyReasons: string[];
  diffLines: number[];
  diffCols: number[];
  aggregateRegion: AggregateRegion;
};

export type BaselineEligibility = {
  eligible: boolean;
  reason: string;
  reasons: string[];
};

export type CapturedVisualEnvironment = VisualCaptureEnvironment & {
  capturedAt: string;
  fullUrl: string;
};

export type CriticalRegionResult = {
  regionId: string;
  criticality: "critical" | "supporting";
  source: "exact-bounds" | "locator" | "unresolved";
  expectedBounds: VisualBounds | null;
  actualBounds: VisualBounds | null;
  componentAudit: string | null;
  minimumSimilarity: number;
  diff: VisualDiffResult;
  artifacts: {
    expectedPath: string | null;
    actualPath: string | null;
    diffPath: string | null;
  };
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

function similarityPercentage(diffPercentage: number | null) {
  if (diffPercentage === null || !Number.isFinite(diffPercentage)) return null;
  return Math.max(0, Math.min(100, 100 - diffPercentage));
}

export function normalizeDiffResult(result: ODiffResult): VisualDiffResult {
  if (result.match) {
    return {
      match: true,
      reason: "match",
      diffCount: 0,
      diffPercentage: 0,
      similarityPercentage: 100,
      comparatorMatch: true,
      similarityPolicyMatch: true,
      policyMatch: true,
      policyReasons: [],
      diffLines: [],
      diffCols: [],
      aggregateRegion: null,
    };
  }

  const mismatch = result as Exclude<ODiffResult, { match: true }>;
  if (mismatch.reason === "pixel-diff") {
    const diffLines = mismatch.diffLines ?? [];
    const diffCols = mismatch.diffCols ?? [];
    return {
      match: false,
      reason: mismatch.reason,
      diffCount: mismatch.diffCount,
      diffPercentage: mismatch.diffPercentage,
      similarityPercentage: similarityPercentage(mismatch.diffPercentage),
      comparatorMatch: false,
      similarityPolicyMatch: false,
      policyMatch: false,
      policyReasons: ["ODiff reported non-identical pixels."],
      diffLines,
      diffCols,
      aggregateRegion: aggregateRegion(diffLines, diffCols),
    };
  }

  return failedDiffResult(mismatch.reason);
}

export function failedDiffResult(reason: string): VisualDiffResult {
  return {
    match: false,
    reason,
    diffCount: null,
    diffPercentage: null,
    similarityPercentage: null,
    comparatorMatch: false,
    similarityPolicyMatch: false,
    policyMatch: false,
    policyReasons: [reason],
    diffLines: [],
    diffCols: [],
    aggregateRegion: null,
  };
}

/**
 * Pixel differences can meet the product policy even though ODiff correctly
 * says the two files are not byte-identical. Layout, dimension, filesystem,
 * and comparator errors never qualify through this policy.
 */
export function applySimilarityPolicy(
  raw: VisualDiffResult,
  minimumSimilarity: number,
): VisualDiffResult {
  if (!Number.isFinite(minimumSimilarity) || minimumSimilarity < 0 || minimumSimilarity > 1) {
    return {
      ...raw,
      match: false,
      similarityPolicyMatch: false,
      policyMatch: false,
      policyReasons: [...raw.policyReasons, "Invalid minimumSimilarity policy."],
    };
  }
  const requiredPercentage = minimumSimilarity * 100;
  const similarityPasses =
    raw.reason === "match" ||
    (raw.reason === "pixel-diff" &&
      raw.similarityPercentage !== null &&
      raw.similarityPercentage >= requiredPercentage);
  return {
    ...raw,
    match: similarityPasses,
    similarityPolicyMatch: similarityPasses,
    policyMatch: similarityPasses,
    policyReasons: similarityPasses
      ? raw.policyReasons
      : [
          ...raw.policyReasons,
          `Similarity ${raw.similarityPercentage ?? "N/A"}% is below ${requiredPercentage}%.`,
        ],
  };
}

export function finalizeVisualPolicy(
  result: VisualDiffResult,
  options: {
    provenanceEligible: boolean;
    playwrightMatch: boolean | null;
    criticalRegions: readonly CriticalRegionResult[];
  },
): VisualDiffResult {
  const reasons = [...result.policyReasons];
  if (!options.provenanceEligible) reasons.push("ODiff is N/A because provenance is ineligible.");
  if (options.playwrightMatch !== true) reasons.push("Playwright screenshot policy did not pass.");
  const failedCriticalRegions = options.criticalRegions.filter(
    (region) => region.criticality === "critical" && !region.diff.policyMatch,
  );
  if (failedCriticalRegions.length) {
    reasons.push(
      `Critical region(s) failed or were unverified: ${failedCriticalRegions.map((region) => region.regionId).join(", ")}.`,
    );
  }
  const policyMatch =
    result.similarityPolicyMatch &&
    options.provenanceEligible &&
    options.playwrightMatch === true &&
    failedCriticalRegions.length === 0;
  return {
    ...result,
    match: policyMatch,
    policyMatch,
    policyReasons: reasons,
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
  filePath: string | null,
  contentType: string,
) {
  if (filePath && (await exists(filePath))) {
    await testInfo.attach(name, { path: filePath, contentType });
  }
}

function sha256(value: Buffer) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fileSha256(filePath: string) {
  const { readFile } = await import("node:fs/promises");
  return sha256(await readFile(filePath));
}

function isMissing(value: unknown) {
  return (
    typeof value !== "string" ||
    !value.trim() ||
    /^(?:unknown|unverified|migration-required|n\/a)$/i.test(value.trim())
  );
}

export function validateReferenceSource(source: VisualReferenceSource) {
  const failures: string[] = [];
  if (source.verification !== "verified") {
    failures.push(source.migrationReason ?? "Reference provenance requires migration and human verification.");
  }
  if (isMissing(source.sourceId)) failures.push("Reference sourceId is missing.");
  if (!/^sha256:[a-f0-9]{64}$/i.test(source.sourceHash ?? "")) {
    failures.push("Reference sourceHash must be a SHA-256 digest.");
  }
  const capture = source.capture;
  if (!capture) return [...failures, "Reference capture provenance is missing."];
  if (isMissing(capture.captureUrl)) failures.push("Reference capture URL/route is missing.");
  if (!capture.viewport?.id || capture.viewport.width <= 0 || capture.viewport.height <= 0) {
    failures.push("Reference viewport provenance is incomplete.");
  }
  if (!Number.isFinite(capture.devicePixelRatio) || capture.devicePixelRatio <= 0) {
    failures.push("Reference device pixel ratio is invalid.");
  }
  for (const [label, value] of Object.entries({
    locale: capture.locale,
    timezone: capture.timezone,
    colorScheme: capture.colorScheme,
    reducedMotion: capture.reducedMotion,
    fontsFingerprint: capture.fontsFingerprint,
    seedScenario: capture.seedScenario,
    state: capture.state,
    browserName: capture.browser?.name,
    browserVersion: capture.browser?.version,
  })) {
    if (isMissing(value)) failures.push(`Reference ${label} is missing or unverified.`);
  }
  if (!Number.isFinite(capture.scrollPosition?.x) || !Number.isFinite(capture.scrollPosition?.y)) {
    failures.push("Reference scroll position is incomplete.");
  }
  if (source.kind === "normalized-figma-make-react") {
    const approval = source.humanApproval;
    if (!approval || isMissing(approval.approvalId) || isMissing(approval.approvedBy) || isMissing(approval.approvedAt)) {
      failures.push("Normalized Figma Make React reference lacks human approval evidence.");
    }
  }
  return failures;
}

function normalizedRoute(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

export function compareCaptureEnvironments(
  expected: VisualCaptureEnvironment,
  actual: VisualCaptureEnvironment,
) {
  const differences: string[] = [];
  const equal = (label: string, left: unknown, right: unknown) => {
    if (left !== right) differences.push(`${label}: expected ${String(left)}, received ${String(right)}.`);
  };
  equal("capture URL/route", normalizedRoute(expected.captureUrl), normalizedRoute(actual.captureUrl));
  equal("viewport id", expected.viewport.id, actual.viewport.id);
  equal("viewport width", expected.viewport.width, actual.viewport.width);
  equal("viewport height", expected.viewport.height, actual.viewport.height);
  if (Math.abs(expected.devicePixelRatio - actual.devicePixelRatio) > 0.001) {
    differences.push(
      `device pixel ratio: expected ${expected.devicePixelRatio}, received ${actual.devicePixelRatio}.`,
    );
  }
  equal("locale", expected.locale, actual.locale);
  equal("timezone", expected.timezone, actual.timezone);
  equal("color scheme", expected.colorScheme, actual.colorScheme);
  equal("reduced motion", expected.reducedMotion, actual.reducedMotion);
  equal("fonts fingerprint", expected.fontsFingerprint, actual.fontsFingerprint);
  equal("seed scenario", expected.seedScenario, actual.seedScenario);
  equal("state", expected.state, actual.state);
  equal("scroll x", expected.scrollPosition.x, actual.scrollPosition.x);
  equal("scroll y", expected.scrollPosition.y, actual.scrollPosition.y);
  equal("browser name", expected.browser.name, actual.browser.name);
  equal("browser version", expected.browser.version, actual.browser.version);
  if (expected.browser.channel) equal("browser channel", expected.browser.channel, actual.browser.channel);
  return differences;
}

export function evaluateBaselineEligibility(options: {
  baselineStatus: string;
  source: VisualReferenceSource;
  baselineHash: string | null;
  actual: VisualCaptureEnvironment;
}) {
  const reasons: string[] = [];
  if (options.baselineStatus !== "approved") reasons.push("Baseline is not explicitly approved.");
  reasons.push(...validateReferenceSource(options.source));
  if (!options.baselineHash) reasons.push("Baseline image is missing.");
  else if (options.baselineHash.toLowerCase() !== options.source.sourceHash.toLowerCase()) {
    reasons.push("Baseline image hash does not match the declared reference source hash.");
  }
  if (reasons.length === 0) {
    reasons.push(...compareCaptureEnvironments(options.source.capture, options.actual));
  }
  return {
    eligible: reasons.length === 0,
    reason: reasons.length === 0 ? "eligible" : `ODiff N/A: ${reasons[0]}`,
    reasons,
  } satisfies BaselineEligibility;
}

async function captureVisualEnvironment(
  page: Page,
  testInfo: TestInfo,
  visualCase: VisualReference,
  seedScenario: string,
): Promise<CapturedVisualEnvironment> {
  const browser = page.context().browser();
  const projectUse = testInfo.project.use as unknown as { channel?: unknown };
  const browserDocumentEvidence = await page.evaluate(() => {
    const fontFaces = document.fonts
      ? Array.from(document.fonts)
          .map((face) => [face.family, face.style, face.weight, face.stretch, face.status].join("|"))
          .sort()
      : ["document-fonts-unavailable"];
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduce"
        : "no-preference",
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      fontFaces,
    };
  });
  return {
    capturedAt: new Date().toISOString(),
    fullUrl: page.url(),
    captureUrl: normalizedRoute(page.url()),
    viewport: {
      id: testInfo.project.name,
      width: browserDocumentEvidence.viewportWidth,
      height: browserDocumentEvidence.viewportHeight,
    },
    devicePixelRatio: browserDocumentEvidence.devicePixelRatio,
    locale: browserDocumentEvidence.locale,
    timezone: browserDocumentEvidence.timezone,
    colorScheme: browserDocumentEvidence.colorScheme as VisualCaptureEnvironment["colorScheme"],
    reducedMotion: browserDocumentEvidence.reducedMotion as VisualCaptureEnvironment["reducedMotion"],
    fontsFingerprint: sha256(Buffer.from(browserDocumentEvidence.fontFaces.join("\n"))),
    seedScenario,
    state: visualCase.expectedState,
    scrollPosition: {
      x: browserDocumentEvidence.scrollX,
      y: browserDocumentEvidence.scrollY,
    },
    browser: {
      name: browser?.browserType().name() ?? "unknown",
      version: browser?.version() ?? "unknown",
      ...(typeof projectUse.channel === "string" ? { channel: projectUse.channel } : {}),
    },
  };
}

function assertFixtureContract(page: Page, visualCase: VisualReference) {
  const active = getActiveVisualFixtureContract(page);
  if (!active) {
    throw new Error(
      `Visual capture ${visualCase.id} has no active allowlisted seed fixture contract. ` +
        "Set visualSeedScenario before requesting a visual baseline capture.",
    );
  }
  if (active.seedScenario !== visualCase.seedScenario) {
    throw new Error(
      `Visual fixture seed ${active.seedScenario} does not match case seed ${visualCase.seedScenario}.`,
    );
  }
  if (active.role !== visualCase.role || active.surface !== visualCase.surface) {
    throw new Error(
      `Visual fixture identity ${active.role}/${active.surface} does not match case ${visualCase.id}.`,
    );
  }
  if (active.viewport !== visualCase.viewport) {
    throw new Error(
      `Visual fixture viewport ${active.viewport} does not match case viewport ${visualCase.viewport}.`,
    );
  }
  assertVisualSeedScenario(
    active.seedScenario,
    { role: active.role, surface: active.surface, viewport: active.viewport },
    visualCase.expectedState,
  );
  return active;
}

function dimensionMismatch(expected: PngDimensions, actual: PngDimensions) {
  return expected.width !== actual.width || expected.height !== actual.height;
}

async function resolveRegionBounds(page: Page, region: VisualCriticalRegion) {
  const hasBounds = Boolean(region.bounds);
  const hasLocator = Boolean(region.locator);
  if (hasBounds === hasLocator) {
    throw new Error("A critical region must declare exactly one of bounds or locator.");
  }
  if (region.bounds) {
    return { source: "exact-bounds" as const, bounds: region.bounds };
  }
  const box = await page.locator(region.locator!).first().boundingBox();
  if (!box) throw new Error(`Locator ${region.locator} did not resolve to visible bounds.`);
  return {
    source: "locator" as const,
    bounds: {
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.ceil(box.width),
      height: Math.ceil(box.height),
    },
  };
}

function unresolvedRegion(
  region: VisualCriticalRegion,
  minimumSimilarity: number,
  reason: string,
): CriticalRegionResult {
  return {
    regionId: region.id,
    criticality: region.criticality,
    source: "unresolved",
    expectedBounds: null,
    actualBounds: null,
    componentAudit: region.componentAudit ?? null,
    minimumSimilarity,
    diff: failedDiffResult(reason),
    artifacts: { expectedPath: null, actualPath: null, diffPath: null },
  };
}

async function compareCriticalRegions(options: {
  page: Page;
  visualCase: VisualReference;
  expectedPath: string;
  actualPath: string;
  expectedDimensions: PngDimensions;
  actualDimensions: PngDimensions;
  artifactDirectory: string;
  provenanceEligible: boolean;
  provenanceReason: string;
}) {
  const defaultMinimum = getMinimumSimilarity(options.visualCase.diffPolicy);
  if (!options.provenanceEligible) {
    return options.visualCase.criticalRegions.map((manifestRegion) => {
      const region = manifestRegion as VisualCriticalRegion;
      return unresolvedRegion(
        region,
        region.minimumSimilarity ?? defaultMinimum,
        options.provenanceReason,
      );
    });
  }
  if (dimensionMismatch(options.expectedDimensions, options.actualDimensions)) {
    return options.visualCase.criticalRegions.map((manifestRegion) => {
      const region = manifestRegion as VisualCriticalRegion;
      return unresolvedRegion(
        region,
        region.minimumSimilarity ?? defaultMinimum,
        "dimension-mismatch",
      );
    });
  }

  const results: CriticalRegionResult[] = [];
  for (const manifestRegion of options.visualCase.criticalRegions) {
    const region = manifestRegion as VisualCriticalRegion;
    const minimumSimilarity = region.minimumSimilarity ?? defaultMinimum;
    try {
      const resolved = await resolveRegionBounds(options.page, region);
      const regionDirectory = resolve(
        options.artifactDirectory,
        "regions",
        safeSegment(region.id, "critical-region"),
      );
      await mkdir(regionDirectory, { recursive: true });
      const expectedPath = resolve(regionDirectory, "expected.png");
      const actualPath = resolve(regionDirectory, "actual.png");
      const diffPath = resolve(regionDirectory, "diff.png");
      const expectedBounds = await cropPng(options.expectedPath, expectedPath, resolved.bounds);
      const actualBounds = await cropPng(options.actualPath, actualPath, resolved.bounds);
      const raw = await compare(expectedPath, actualPath, diffPath, {
        threshold: options.visualCase.diffPolicy.threshold,
        captureDiffLines: true,
        captureDiffCols: true,
        failOnLayoutDiff: true,
        noFailOnFsErrors: true,
      });
      results.push({
        regionId: region.id,
        criticality: region.criticality,
        source: resolved.source,
        expectedBounds,
        actualBounds,
        componentAudit: region.componentAudit ?? null,
        minimumSimilarity,
        diff: applySimilarityPolicy(normalizeDiffResult(raw), minimumSimilarity),
        artifacts: { expectedPath, actualPath, diffPath },
      });
    } catch (error) {
      results.push(
        unresolvedRegion(
          region,
          minimumSimilarity,
          `critical-region-error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
  return results;
}

async function attachCriticalRegionArtifacts(
  testInfo: TestInfo,
  regions: readonly CriticalRegionResult[],
) {
  for (const region of regions) {
    const prefix = `visual-region-${safeSegment(region.regionId, "region")}`;
    await attachIfPresent(testInfo, `${prefix}-expected.png`, region.artifacts.expectedPath, "image/png");
    await attachIfPresent(testInfo, `${prefix}-actual.png`, region.artifacts.actualPath, "image/png");
    await attachIfPresent(testInfo, `${prefix}-diff.png`, region.artifacts.diffPath, "image/png");
  }
}

export async function expectVisualMatch({
  page,
  testInfo,
  visualCase,
  masks,
  layoutAudit,
}: VisualMatchOptions) {
  const fixture = assertFixtureContract(page, visualCase);
  const artifactDirectory = getVisualArtifactDirectory(testInfo, visualCase.id);
  await mkdir(artifactDirectory, { recursive: true });

  const expectedPath = resolve(artifactDirectory, "expected.png");
  const actualPath = resolve(artifactDirectory, "actual.png");
  const diffPath = resolve(artifactDirectory, "diff.png");
  const diffResultPath = resolve(artifactDirectory, "diff-result.json");
  const layoutAuditPath = resolve(artifactDirectory, "layout-audit.json");
  const captureEnvironmentPath = resolve(artifactDirectory, "capture-environment.json");
  const baselinePath = testInfo.snapshotPath(visualCase.snapshot);
  const screenshotOptions = {
    mask: masks.length > 0 ? [...masks] : undefined,
    animations: "disabled" as const,
    caret: "hide" as const,
    scale: "css" as const,
  };
  const maximumDiffPixelRatio = getMaxDiffPixelRatio(visualCase.diffPolicy);

  await writeFile(layoutAuditPath, JSON.stringify(layoutAudit, null, 2), "utf8");
  const actualEnvironment = await captureVisualEnvironment(
    page,
    testInfo,
    visualCase,
    fixture.seedScenario,
  );
  await page.screenshot({ path: actualPath, ...screenshotOptions });

  const baselineExists = await exists(baselinePath);
  if (baselineExists) await copyFile(baselinePath, expectedPath);
  const baselineHash = baselineExists ? await fileSha256(baselinePath) : null;
  const referenceSource = visualCase.referenceSource as VisualReferenceSource;
  const eligibility = evaluateBaselineEligibility({
    baselineStatus: visualCase.baselineStatus,
    source: referenceSource,
    baselineHash,
    actual: actualEnvironment,
  });

  let expectedDimensions: PngDimensions | null = null;
  let actualDimensions: PngDimensions | null = null;
  try {
    actualDimensions = await readPngDimensions(actualPath);
    if (baselineExists) expectedDimensions = await readPngDimensions(expectedPath);
  } catch (error) {
    eligibility.eligible = false;
    eligibility.reason = `ODiff N/A: image dimension read failed: ${error instanceof Error ? error.message : String(error)}`;
    eligibility.reasons.push(eligibility.reason);
  }

  let diffResult: VisualDiffResult;
  if (!baselineExists) {
    diffResult = failedDiffResult("file-not-exists");
  } else if (!eligibility.eligible) {
    diffResult = failedDiffResult("odiff-na-provenance-or-environment");
  } else if (!expectedDimensions || !actualDimensions) {
    diffResult = failedDiffResult("dimension-error");
  } else if (dimensionMismatch(expectedDimensions, actualDimensions)) {
    diffResult = failedDiffResult("dimension-mismatch");
  } else {
    try {
      const odiffResult = await compare(expectedPath, actualPath, diffPath, {
        threshold: visualCase.diffPolicy.threshold,
        captureDiffLines: true,
        captureDiffCols: true,
        failOnLayoutDiff: true,
        noFailOnFsErrors: true,
      });
      diffResult = applySimilarityPolicy(
        normalizeDiffResult(odiffResult),
        getMinimumSimilarity(visualCase.diffPolicy),
      );
    } catch (error) {
      diffResult = failedDiffResult(
        `odiff-error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let playwrightMatch: boolean | null = null;
  let playwrightError: string | null = null;
  if (eligibility.eligible) {
    try {
      await expect(page).toHaveScreenshot(visualCase.snapshot, {
        mask: screenshotOptions.mask,
        maxDiffPixelRatio: maximumDiffPixelRatio,
        threshold: visualCase.diffPolicy.threshold,
      });
      playwrightMatch = true;
    } catch (error) {
      playwrightMatch = false;
      playwrightError = error instanceof Error ? error.message : String(error);
    }
  }

  const criticalRegions = await compareCriticalRegions({
    page,
    visualCase,
    expectedPath,
    actualPath,
    expectedDimensions: expectedDimensions ?? { width: 0, height: 0 },
    actualDimensions: actualDimensions ?? { width: 0, height: 0 },
    artifactDirectory,
    provenanceEligible: eligibility.eligible,
    provenanceReason: eligibility.reason,
  });
  diffResult = finalizeVisualPolicy(diffResult, {
    provenanceEligible: eligibility.eligible,
    playwrightMatch,
    criticalRegions,
  });
  if (playwrightError) diffResult.policyReasons.push(`Playwright: ${playwrightError}`);

  const evidence = {
    schemaVersion: 2,
    visualCaseId: visualCase.id,
    minimumSimilarity: getMinimumSimilarity(visualCase.diffPolicy),
    maxDiffPixelRatio: maximumDiffPixelRatio,
    baselinePath,
    baselineExists,
    baselineEligibility: eligibility,
    referenceSource,
    actualCaptureEnvironment: actualEnvironment,
    screenshotDimensions: { expected: expectedDimensions, actual: actualDimensions },
    playwrightMatch,
    playwrightError,
    criticalRegions,
    ...diffResult,
  };
  await writeFile(captureEnvironmentPath, JSON.stringify({
    visualCaseId: visualCase.id,
    referenceSource,
    actualCaptureEnvironment: actualEnvironment,
    baselineEligibility: eligibility,
    screenshotDimensions: { expected: expectedDimensions, actual: actualDimensions },
  }, null, 2), "utf8");
  await writeFile(diffResultPath, JSON.stringify(evidence, null, 2), "utf8");

  await attachIfPresent(testInfo, "visual-layout-audit.json", layoutAuditPath, "application/json");
  await attachIfPresent(testInfo, "visual-capture-environment.json", captureEnvironmentPath, "application/json");

  if (diffResult.policyMatch) return diffResult;

  await attachIfPresent(testInfo, "visual-expected.png", expectedPath, "image/png");
  await attachIfPresent(testInfo, "visual-actual.png", actualPath, "image/png");
  await attachIfPresent(testInfo, "visual-diff.png", diffPath, "image/png");
  await attachIfPresent(testInfo, "visual-diff-result.json", diffResultPath, "application/json");
  await attachCriticalRegionArtifacts(testInfo, criticalRegions);

  throw new Error(
    `Visual policy failed for ${visualCase.id}: ${diffResult.policyReasons.join(" ")} ` +
      `Artifacts retained at ${artifactDirectory}`,
  );
}
