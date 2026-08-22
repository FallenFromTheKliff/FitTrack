import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compare } from "odiff-bin";
import { normalizeDiffResult } from "./expect-visual-match.ts";

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

function rgbaPng(pixel) {
  const header = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(pixel), Buffer.from(pixel)]);
  const pixels = Buffer.concat([row, row]);
  const iend = Buffer.alloc(0);
  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", iend),
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
assert.deepEqual(normalizeDiffResult({ match: false, reason: "layout-diff" }), {
  match: false,
  reason: "layout-diff",
  diffCount: null,
  diffPercentage: null,
  diffLines: [],
  diffCols: [],
  aggregateRegion: null,
});
assert.deepEqual(normalizeDiffResult({ match: true }), {
  match: true,
  reason: "match",
  diffCount: 0,
  diffPercentage: 0,
  diffLines: [],
  diffCols: [],
  aggregateRegion: null,
});

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
const resultPath = resolve(runDirectory, "diff-result.json");
const auditPath = resolve(runDirectory, "layout-audit.json");

await mkdir(runDirectory, { recursive: true });
try {
  await writeFile(expectedPath, rgbaPng([20, 20, 20, 255]));
  await writeFile(actualPath, rgbaPng([240, 80, 20, 255]));
  const rawResult = await compare(expectedPath, actualPath, diffPath, {
    captureDiffLines: true,
    captureDiffCols: true,
    failOnLayoutDiff: true,
  });
  const result = normalizeDiffResult(rawResult);
  await writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(auditPath, JSON.stringify({ horizontalOverflow: false }, null, 2), "utf8");

  assert.equal(result.match, false);
  assert.equal(result.reason, "pixel-diff");
  assert.ok(result.diffCount > 0);
  assert.ok(result.diffLines.length > 0);
  assert.ok(result.diffCols.length > 0);
  assert.ok(result.aggregateRegion);
  await access(diffPath);
  const persisted = JSON.parse(await readFile(resultPath, "utf8"));
  for (const field of [
    "match",
    "reason",
    "diffCount",
    "diffPercentage",
    "diffLines",
    "diffCols",
    "aggregateRegion",
  ]) {
    assert.ok(Object.hasOwn(persisted, field), `missing ${field}`);
  }
  console.log("visual helper ODiff mismatch/artifact tests passed");
} finally {
  await rm(runDirectory, { recursive: true, force: true });
}
