import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compare } from "odiff-bin";
import {
  applySimilarityPolicy,
  evaluateBaselineEligibility,
  failedDiffResult,
  finalizeVisualPolicy,
  normalizeDiffResult,
} from "./expect-visual-match.ts";
import { cropPng, readPngDimensions } from "./png-utils.ts";
import { assertVisualSeedScenario } from "./seed-contract.ts";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBytes, body]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  return Buffer.concat([length, payload, checksum]);
}

function rgbaPng(pixel, width = 2, height = 2) {
  const header = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.concat([
    Buffer.from([0]),
    ...Array.from({ length: width }, () => Buffer.from(pixel)),
  ]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const aggregate = normalizeDiffResult({
  match: false,
  reason: "pixel-diff",
  diffCount: 3,
  diffPercentage: 0.75,
  diffLines: [7, 2, 8],
  diffCols: [5, 1],
});
assert.deepEqual(aggregate.aggregateRegion, {
  minLine: 2,
  maxLine: 8,
  minCol: 1,
  maxCol: 5,
});
assert.equal(aggregate.similarityPercentage, 99.25);

// A 95% similarity policy is intentionally separate from ODiff's exact match.
const atLeast95 = applySimilarityPolicy(
  normalizeDiffResult({
    match: false,
    reason: "pixel-diff",
    diffCount: 499,
    diffPercentage: 4.99,
    diffLines: [],
    diffCols: [],
  }),
  0.95,
);
assert.equal(atLeast95.comparatorMatch, false);
assert.equal(atLeast95.similarityPercentage, 95.01);
assert.equal(atLeast95.policyMatch, true, ">=95% should pass the similarity policy");

const below95 = applySimilarityPolicy(
  normalizeDiffResult({
    match: false,
    reason: "pixel-diff",
    diffCount: 501,
    diffPercentage: 5.01,
    diffLines: [],
    diffCols: [],
  }),
  0.95,
);
assert.equal(below95.policyMatch, false, "<95% must fail the similarity policy");
assert.equal(
  applySimilarityPolicy(normalizeDiffResult({ match: false, reason: "layout-diff" }), 0.95)
    .policyMatch,
  false,
  "layout differences cannot pass by similarity",
);
assert.equal(
  applySimilarityPolicy(failedDiffResult("dimension-mismatch"), 0.95).policyMatch,
  false,
  "dimension mismatches cannot pass by similarity",
);

const verifiedCapture = {
  captureUrl: "/schedule",
  viewport: { id: "desktop-1920x1080", width: 1920, height: 1080 },
  devicePixelRatio: 1,
  locale: "en-PH",
  timezone: "Asia/Manila",
  colorScheme: "light",
  reducedMotion: "reduce",
  fontsFingerprint: "sha256:fonts",
  seedScenario: "realistic-seed-admin-gym-operations",
  state: "Authenticated admin Gym Operations schedule landing",
  scrollPosition: { x: 0, y: 0 },
  browser: { name: "chromium", channel: "chrome", version: "151.0.7922.174" },
};
const verifiedSource = {
  kind: "browser-baseline",
  verification: "verified",
  sourceId: "fittrack:visual:unit:browser-baseline:v1",
  sourceHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  capture: verifiedCapture,
};

const missingProvenance = evaluateBaselineEligibility({
  baselineStatus: "approved",
  source: { ...verifiedSource, verification: "migration-required" },
  baselineHash: verifiedSource.sourceHash,
  actual: verifiedCapture,
});
assert.equal(missingProvenance.eligible, false, "unverified provenance must make ODiff N/A");
assert.match(missingProvenance.reason, /^ODiff N\/A:/);

const environmentMismatch = evaluateBaselineEligibility({
  baselineStatus: "approved",
  source: verifiedSource,
  baselineHash: verifiedSource.sourceHash,
  actual: { ...verifiedCapture, locale: "en-US" },
});
assert.equal(environmentMismatch.eligible, false, "environment drift must make ODiff N/A");
assert.ok(environmentMismatch.reasons.some((reason) => reason.startsWith("locale:")));

const unapprovedNormalizedSource = evaluateBaselineEligibility({
  baselineStatus: "approved",
  source: { ...verifiedSource, kind: "normalized-figma-make-react" },
  baselineHash: verifiedSource.sourceHash,
  actual: verifiedCapture,
});
assert.equal(
  unapprovedNormalizedSource.eligible,
  false,
  "normalized Figma Make React references require human approval evidence",
);
assert.ok(
  unapprovedNormalizedSource.reasons.some((reason) => reason.includes("human approval")),
);

const criticalRegionFailure = finalizeVisualPolicy(atLeast95, {
  provenanceEligible: true,
  playwrightMatch: true,
  criticalRegions: [
    {
      regionId: "membership-plan-card",
      criticality: "critical",
      source: "exact-bounds",
      expectedBounds: { x: 0, y: 0, width: 20, height: 20 },
      actualBounds: { x: 0, y: 0, width: 20, height: 20 },
      componentAudit: null,
      minimumSimilarity: 0.95,
      diff: failedDiffResult("critical-region-error: unavailable"),
      artifacts: { expectedPath: null, actualPath: null, diffPath: null },
    },
  ],
});
assert.equal(criticalRegionFailure.policyMatch, false, "a failed critical region overrides page similarity");

assert.throws(
  () =>
    assertVisualSeedScenario("unknown-seed", {
      role: "admin",
      surface: "web",
      viewport: "desktop-1920x1080",
    }),
  /Unknown visual seed scenario/,
);
assert.throws(
  () =>
    assertVisualSeedScenario("realistic-seed-admin-gym-operations", {
      role: "member",
      surface: "web",
      viewport: "desktop-1920x1080",
    }),
  /requires role admin/,
);

const runDirectory = resolve(
  process.cwd(),
  ".artifacts",
  "playwright",
  "visual-runs",
  `temporary-odiff-mismatch-${process.pid}`,
);
const expectedPath = resolve(runDirectory, "expected.png");
const actualPath = resolve(runDirectory, "actual.png");
const diffPath = resolve(runDirectory, "diff.png");
const cropPath = resolve(runDirectory, "crop.png");
const resultPath = resolve(runDirectory, "diff-result.json");
const auditPath = resolve(runDirectory, "layout-audit.json");

await mkdir(runDirectory, { recursive: true });
try {
  await writeFile(expectedPath, rgbaPng([20, 20, 20, 255], 4, 4));
  await writeFile(actualPath, rgbaPng([240, 80, 20, 255], 4, 4));
  const rawResult = await compare(expectedPath, actualPath, diffPath, {
    captureDiffLines: true,
    captureDiffCols: true,
    failOnLayoutDiff: true,
  });
  const result = applySimilarityPolicy(normalizeDiffResult(rawResult), 0.95);
  await writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(auditPath, JSON.stringify({ horizontalOverflow: false }, null, 2), "utf8");

  assert.equal(result.comparatorMatch, false);
  assert.equal(result.reason, "pixel-diff");
  assert.ok(result.diffCount > 0);
  assert.ok(result.diffLines.length > 0);
  assert.ok(result.diffCols.length > 0);
  assert.ok(result.aggregateRegion);
  await access(diffPath);

  await cropPng(expectedPath, cropPath, { x: 1, y: 1, width: 2, height: 2 });
  assert.deepEqual(await readPngDimensions(cropPath), { width: 2, height: 2 });

  const persisted = JSON.parse(await readFile(resultPath, "utf8"));
  for (const field of [
    "match",
    "reason",
    "diffCount",
    "diffPercentage",
    "similarityPercentage",
    "comparatorMatch",
    "policyMatch",
    "diffLines",
    "diffCols",
    "aggregateRegion",
  ]) {
    assert.ok(Object.hasOwn(persisted, field), `missing ${field}`);
  }
  console.log("visual helper comparator, provenance, seed, and crop policy tests passed");
} finally {
  await rm(runDirectory, { recursive: true, force: true });
}
