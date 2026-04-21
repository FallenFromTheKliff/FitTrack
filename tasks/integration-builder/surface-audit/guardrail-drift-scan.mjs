import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tasks/integration-builder/surface-audit/guardrail-drift-snapshot.md");
const SHOULD_WRITE = process.argv.includes("--write");

const ROUTE_THRESHOLD = 100;
const UI_THRESHOLD = 150;
const BACKEND_THRESHOLD = 250;

const ROUTE_DIRS = [
  "apps/web/app",
  "apps/mobile/app"
];

const UI_DIRS = [
  "apps/web/components",
  "apps/mobile/components",
  "packages/ui"
];

const BACKEND_DIRS = [
  "apps/api/src"
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  ".expo",
  "dist-web-auth-check"
]);

function normalize(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function countLines(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

function walk(dirPath, onFile) {
  if (!fs.existsSync(dirPath)) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, onFile);
      continue;
    }

    onFile(fullPath);
  }
}

function isCodeFile(filePath) {
  return /\.(ts|tsx|js|jsx)$/.test(filePath);
}

function isWebRouteFile(relativePath) {
  return /apps\/web\/app\/.*\/page\.(ts|tsx|js|jsx)$/.test(relativePath);
}

function isMobileRouteFile(relativePath) {
  return /apps\/mobile\/app\/.*\.(ts|tsx|js|jsx)$/.test(relativePath) &&
    !/\/_layout\.(ts|tsx|js|jsx)$/.test(relativePath) &&
    !/\/index\.(ts|tsx|js|jsx)$/.test(relativePath);
}

function collectHotspots() {
  const routeRows = [];
  const uiRows = [];
  const backendRows = [];

  for (const relativeDir of ROUTE_DIRS) {
    walk(path.join(ROOT, relativeDir), (filePath) => {
      if (!isCodeFile(filePath)) return;

      const relativePath = normalize(path.relative(ROOT, filePath));
      const isRouteFile = isWebRouteFile(relativePath) || isMobileRouteFile(relativePath);
      if (!isRouteFile) return;

      const lines = countLines(filePath);
      if (lines > ROUTE_THRESHOLD) {
        routeRows.push({ lines, path: relativePath });
      }
    });
  }

  for (const relativeDir of UI_DIRS) {
    walk(path.join(ROOT, relativeDir), (filePath) => {
      if (!isCodeFile(filePath)) return;
      const lines = countLines(filePath);
      if (lines > UI_THRESHOLD) {
        uiRows.push({
          lines,
          path: normalize(path.relative(ROOT, filePath))
        });
      }
    });
  }

  for (const relativeDir of BACKEND_DIRS) {
    walk(path.join(ROOT, relativeDir), (filePath) => {
      if (!isCodeFile(filePath)) return;
      const lines = countLines(filePath);
      if (lines > BACKEND_THRESHOLD) {
        backendRows.push({
          lines,
          path: normalize(path.relative(ROOT, filePath))
        });
      }
    });
  }

  routeRows.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
  uiRows.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
  backendRows.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));

  return { routeRows, uiRows, backendRows };
}

function formatRows(rows) {
  if (rows.length === 0) {
    return ["- none"];
  }

  return rows.map((row) => `- \`${row.path}\` - ${row.lines} lines`);
}

function buildMarkdown({ routeRows, uiRows, backendRows }) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "# Guardrail Drift Snapshot",
    "",
    `- Generated on ${today}.`,
    `- Route threshold: ${ROUTE_THRESHOLD} lines.`,
    `- Non-route UI threshold: ${UI_THRESHOLD} lines.`,
    `- Backend/API threshold: ${BACKEND_THRESHOLD} lines.`,
    "",
    "## Route Hotspots",
    ...formatRows(routeRows),
    "",
    "## UI Hotspots",
    ...formatRows(uiRows),
    "",
    "## Backend Hotspots",
    ...formatRows(backendRows),
    ""
  ].join("\n");
}

const results = collectHotspots();
const markdown = buildMarkdown(results);

if (SHOULD_WRITE) {
  fs.writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`Wrote ${normalize(path.relative(ROOT, OUTPUT_PATH))}`);
} else {
  console.log(markdown);
}
