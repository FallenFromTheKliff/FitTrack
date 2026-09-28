import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cleanupVisualRun,
  resolveVisualRunTarget,
} from "../scripts/clean-visual-run.mjs";

const root = resolve(process.cwd(), ".artifacts", "playwright", "visual-runs");

async function testDryRunAndConfirmedDeletion() {
  const runId = `guard-test-${process.pid}-${Date.now()}`;
  const target = resolve(root, runId);
  await mkdir(target, { recursive: true });
  await writeFile(resolve(target, "marker.txt"), "temporary", "utf8");
  try {
    const dryRun = await cleanupVisualRun({ artifactRoot: root, runId });
    assert.equal(dryRun.deleted, false);
    assert.equal(await readFile(resolve(target, "marker.txt"), "utf8"), "temporary");

    const confirmed = await cleanupVisualRun({ artifactRoot: root, runId, confirm: true });
    assert.equal(confirmed.deleted, true);
    await assert.rejects(readFile(resolve(target, "marker.txt"), "utf8"));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function testRefusals() {
  await assert.rejects(
    cleanupVisualRun({ artifactRoot: root, runId: "does-not-exist" }),
    /does not exist/,
  );

  assert.throws(
    () => resolveVisualRunTarget(root, "..\\all-runs"),
    /safe directory name/,
  );

  assert.throws(
    () => resolveVisualRunTarget(root, "snapshots"),
    /baseline and snapshot/,
  );
}

await testDryRunAndConfirmedDeletion();
await testRefusals();
console.log("visual cleanup guard tests passed");
