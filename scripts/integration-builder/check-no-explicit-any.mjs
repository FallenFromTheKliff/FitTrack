#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const usage =
  'Usage: node scripts/integration-builder/check-no-explicit-any.mjs <file.ts> [more-files.tsx ...]';

const supportedExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);

async function loadTypescript(repoRoot) {
  const directCandidate = path.join(
    repoRoot,
    'node_modules',
    'typescript',
    'lib',
    'typescript.js',
  );
  const candidates = [];

  if (fs.existsSync(directCandidate)) {
    candidates.push(directCandidate);
  }

  const pnpmDirectory = path.join(repoRoot, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDirectory)) {
    const pnpmCandidates = fs
      .readdirSync(pnpmDirectory)
      .filter((entry) => entry.startsWith('typescript@'))
      .sort((left, right) => right.localeCompare(left))
      .map((entry) =>
        path.join(
          pnpmDirectory,
          entry,
          'node_modules',
          'typescript',
          'lib',
          'typescript.js',
        ),
      )
      .filter((candidate) => fs.existsSync(candidate));

    candidates.push(...pnpmCandidates);
  }

  for (const candidate of candidates) {
    const loadedModule = await import(pathToFileURL(candidate).href);
    return loadedModule.default ?? loadedModule;
  }

  throw new Error(
    'Unable to resolve TypeScript for the explicit-any integration guard.',
  );
}

function toScriptKind(filePath, ts) {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  return ts.ScriptKind.TS;
}

function formatViolation(violation) {
  return `${violation.file}:${violation.line}:${violation.column} explicit any -> ${violation.lineText}`;
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  console.error(usage);
  process.exit(2);
}

const repoRoot = process.cwd();
const ts = await loadTypescript(repoRoot);
const violations = [];
const missingFiles = [];

for (const rawArg of [...new Set(rawArgs)]) {
  const resolvedPath = path.resolve(repoRoot, rawArg);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (!supportedExtensions.has(extension) || resolvedPath.endsWith('.d.ts')) {
    continue;
  }

  if (!fs.existsSync(resolvedPath)) {
    missingFiles.push(path.relative(repoRoot, resolvedPath));
    continue;
  }

  const sourceText = fs.readFileSync(resolvedPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    resolvedPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    toScriptKind(resolvedPath, ts),
  );
  const lineCache = sourceText.split(/\r?\n/);

  function walk(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const start = node.getStart(sourceFile);
      const location = sourceFile.getLineAndCharacterOfPosition(start);
      const relativePath = path.relative(repoRoot, resolvedPath).replaceAll('\\', '/');
      violations.push({
        file: relativePath,
        line: location.line + 1,
        column: location.character + 1,
        lineText: lineCache[location.line]?.trim() ?? '',
      });
    }

    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
}

if (missingFiles.length > 0) {
  console.error('Explicit-any check received missing files:');
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
  process.exit(2);
}

if (violations.length > 0) {
  console.error('Explicit any is not allowed for active integration work.');
  for (const violation of violations.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    return left.column - right.column;
  })) {
    console.error(formatViolation(violation));
  }
  process.exit(1);
}

console.log('Explicit-any check passed for the supplied TypeScript files.');
