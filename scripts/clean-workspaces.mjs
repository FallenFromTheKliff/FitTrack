import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const workspaceParents = ['apps', 'packages'];
const removableNames = ['.next', '.next-dev', '.next-runtime', '.expo', '.turbo', 'node_modules', 'dist'];
const isDryRun = process.argv.includes('--dry-run');

function isInsideRepo(targetPath) {
  const relative = path.relative(repoRoot, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getWorkspaceDirs() {
  const dirs = [repoRoot];

  for (const parent of workspaceParents) {
    const parentDir = path.join(repoRoot, parent);

    if (!fs.existsSync(parentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        dirs.push(path.join(parentDir, entry.name));
      }
    }
  }

  return dirs;
}

function removeTarget(targetPath) {
  if (!isInsideRepo(targetPath)) {
    throw new Error(`Refusing to remove path outside repo: ${targetPath}`);
  }

  if (!fs.existsSync(targetPath)) {
    return 'missing';
  }

  if (isDryRun) {
    return 'would-remove';
  }

  fs.rmSync(targetPath, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  });

  return 'removed';
}

const workspaces = getWorkspaceDirs();
const results = [];
const failures = [];

for (const workspaceDir of workspaces) {
  for (const removableName of removableNames) {
    const targetPath = path.join(workspaceDir, removableName);

    try {
      const status = removeTarget(targetPath);

      if (status !== 'missing') {
        results.push({ status, targetPath });
      }
    } catch (error) {
      failures.push({
        targetPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

for (const result of results) {
  const label = result.status === 'would-remove' ? 'Would remove' : 'Removed';
  console.log(`${label}: ${path.relative(repoRoot, result.targetPath)}`);
}

if (failures.length > 0) {
  console.error('Clean failed for these paths:');

  for (const failure of failures) {
    console.error(`- ${path.relative(repoRoot, failure.targetPath)}: ${failure.message}`);
  }

  process.exitCode = 1;
} else {
  const mode = isDryRun ? 'dry run complete' : 'complete';
  console.log(`Workspace clean ${mode}.`);
}
