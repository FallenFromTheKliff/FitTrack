#!/usr/bin/env node

import { access, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";

const ARTIFACT_ROOT = resolve(
  process.cwd(),
  ".artifacts",
  "playwright",
  "visual-runs",
);

export function parseArgs(argv) {
  let runId = "";
  let confirm = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--confirm") {
      confirm = true;
      continue;
    }
    if (argument === "--run-id" && !runId) {
      runId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    return { error: `unexpected argument ${argument}` };
  }
  return { runId, confirm };
}

export function resolveVisualRunTarget(artifactRoot, runId) {
  if (!runId) throw new Error("an exact --run-id value is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(runId)) {
    throw new Error("run ID must be one exact safe directory name");
  }
  if (/baseline|snapshot/i.test(runId)) {
    throw new Error("baseline and snapshot directories are never cleanup targets");
  }

  const target = resolve(artifactRoot, runId);
  const containment = relative(artifactRoot, target);
  if (!containment || containment.startsWith("..") || isAbsolute(containment)) {
    throw new Error("target must be a direct child below .artifacts/playwright/visual-runs");
  }
  return target;
}

export async function cleanupVisualRun({
  artifactRoot = ARTIFACT_ROOT,
  runId,
  confirm = false,
}) {
  const target = resolveVisualRunTarget(artifactRoot, runId);
  try {
    await access(target);
    const targetStats = await stat(target);
    if (!targetStats.isDirectory()) throw new Error("target is not a directory");
  } catch {
    throw new Error(`run ID does not exist: ${runId}`);
  }

  if (!confirm) {
    return { target, deleted: false };
  }

  await rm(target, { recursive: true, force: false });
  return { target, deleted: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const parsed = parseArgs(process.argv.slice(2));
  try {
    if (parsed.error) throw new Error(parsed.error);
    const result = await cleanupVisualRun(parsed);
    if (result.deleted) {
      console.log(`Removed visual run artifacts: ${result.target}`);
    } else {
      console.log(`Dry run: would remove exactly ${result.target}`);
      console.log("Nothing was deleted. Re-run with --confirm to delete this run only.");
    }
  } catch (error) {
    console.error(`Refusing visual-run cleanup: ${error.message}`);
    process.exitCode = 1;
  }
}
