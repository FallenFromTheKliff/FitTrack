#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const usage =
  'Usage: node tasks/integration-builder/check-edited-syntax.mjs [file1 file2 ...]\n' +
  'If no files are supplied, the script checks supported changed files from git status.';

const supportedExtensions = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
]);

function fail(message, exitCode = 2) {
  console.error(message);
  process.exit(exitCode);
}

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

  throw new Error('Unable to resolve TypeScript for the edited syntax check.');
}

function toScriptKind(filePath, ts) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
      return ts.ScriptKind.JS;
    case '.mjs':
      return ts.ScriptKind.JS;
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.json':
      return ts.ScriptKind.JSON;
    default:
      return ts.ScriptKind.TS;
  }
}

function normalizeRelativePath(repoRoot, targetPath) {
  return path.relative(repoRoot, targetPath).replaceAll('\\', '/');
}

function parseGitStatusPaths(repoRoot) {
  const result = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    fail(
      `Unable to read git status for edited syntax checks.\n${result.stderr || result.stdout || 'No output.'}`,
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const payload = line.slice(3).trim();
      const renameArrow = payload.lastIndexOf(' -> ');
      if (renameArrow >= 0) {
        return payload.slice(renameArrow + 4).trim();
      }

      return payload;
    })
    .filter(Boolean);
}

function collectCandidateFiles(repoRoot, rawArgs) {
  const inputPaths =
    rawArgs.length > 0 ? [...new Set(rawArgs)] : parseGitStatusPaths(repoRoot);

  return inputPaths
    .map((rawPath) => path.resolve(repoRoot, rawPath))
    .filter((resolvedPath) => {
      const extension = path.extname(resolvedPath).toLowerCase();
      return (
        supportedExtensions.has(extension) &&
        !resolvedPath.endsWith('.d.ts') &&
        fs.existsSync(resolvedPath)
      );
    });
}

function formatSyntaxDiagnostic(repoRoot, filePath, diagnostic) {
  const lineStart = diagnostic.lineText?.trim() ?? '';
  return `${normalizeRelativePath(repoRoot, filePath)}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message}${lineStart ? ` -> ${lineStart}` : ''}`;
}

const repoRoot = process.cwd();
const rawArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

if (process.argv.includes('--help')) {
  console.log(usage);
  process.exit(0);
}

const candidateFiles = collectCandidateFiles(repoRoot, rawArgs);

if (candidateFiles.length === 0) {
  console.log('Edited syntax check found no supported changed files to inspect.');
  process.exit(0);
}

const ts = await loadTypescript(repoRoot);
const diagnostics = [];

for (const filePath of candidateFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    toScriptKind(filePath, ts),
  );
  const lineCache = sourceText.split(/\r?\n/);

  for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
    const start = diagnostic.start ?? 0;
    const position = sourceFile.getLineAndCharacterOfPosition(start);
    diagnostics.push({
      filePath,
      line: position.line + 1,
      column: position.character + 1,
      message: ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      ),
      lineText: lineCache[position.line] ?? '',
    });
  }

  if (path.extname(filePath).toLowerCase() === '.json') {
    try {
      JSON.parse(sourceText);
    } catch (error) {
      diagnostics.push({
        filePath,
        line: 1,
        column: 1,
        message: error instanceof Error ? error.message : 'Invalid JSON.',
        lineText: lineCache[0] ?? '',
      });
    }
  }
}

if (diagnostics.length > 0) {
  console.error(
    'Edited syntax check failed. Fix the touched-file syntax issue before treating the watcher crash as a runtime outage.',
  );
  for (const diagnostic of diagnostics
    .sort((left, right) => {
      const leftFile = normalizeRelativePath(repoRoot, left.filePath);
      const rightFile = normalizeRelativePath(repoRoot, right.filePath);

      if (leftFile !== rightFile) {
        return leftFile.localeCompare(rightFile);
      }

      if (left.line !== right.line) {
        return left.line - right.line;
      }

      return left.column - right.column;
    })) {
    console.error(formatSyntaxDiagnostic(repoRoot, diagnostic.filePath, diagnostic));
  }
  process.exit(1);
}

console.log(
  `Edited syntax check passed for ${candidateFiles.length} supported changed file(s).`,
);
