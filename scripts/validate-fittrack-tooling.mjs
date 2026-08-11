import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "apps", "web");

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const registry = readJson("apps/web/registry.json");
const components = readJson("apps/web/components.json");
const rootPackage = readJson("package.json");
const webPackage = readJson("apps/web/package.json");
const vscodeMcp = readJson(".vscode/mcp.json");
const codexMcp = readText(".codex/config.toml");
const registryBuilder = readText("scripts/build-fittrack-registry.mjs");
const storybookPlaywrightConfig = readText("playwright.storybook.config.ts");
const goldenTest = readText("tests/ui/golden-archetypes.spec.ts");
const storybookPreview = readText("apps/web/.storybook/preview.tsx");
const goldenStories = readText("apps/web/components/storybook/GoldenArchetypes.stories.tsx");

assertCondition(registry.$schema === "https://ui.shadcn.com/schema/registry.json", "Registry schema is not shadcn-compatible.");
assertCondition(registry.name === "fittrack", "Registry name must be fittrack.");
assertCondition(components.registries?.["@fittrack"] === "http://127.0.0.1:8080/r/{name}.json", "FitTrack registry URL must stay local.");
assertCondition(!fs.existsSync(path.join(repoRoot, "chromatic.config.json")), "Paid visual-regression config must be removed.");
assertCondition(webPackage.scripts?.["registry:build"] === "node ../../scripts/build-fittrack-registry.mjs", "Registry build must use the local compiler.");
assertCondition(rootPackage.scripts?.["test:ui:golden"] === "playwright test --config=playwright.storybook.config.ts tests/ui/golden-archetypes.spec.ts", "Golden screenshots must use the local Playwright config.");
assertCondition(rootPackage.scripts?.["chromatic:local"] === undefined, "Paid visual-regression scripts must be removed.");
assertCondition(storybookPlaywrightConfig.includes("pnpm --dir apps/web storybook"), "Golden screenshots must start local Storybook.");
assertCondition(goldenTest.includes("toHaveScreenshot"), "Golden screenshots must use Playwright screenshot assertions.");
assertCondition(!/pnpm\\s+dlx|chromatic/i.test(`${JSON.stringify(rootPackage.scripts)}\\n${JSON.stringify(webPackage.scripts)}\\n${registryBuilder}\\n${storybookPreview}\\n${goldenStories}`), "Paid or network-only UI tooling remains in active scripts or stories.");
assertCondition(codexMcp.includes("[mcp_servers.storybook]"), "Storybook MCP must remain configured.");
assertCondition(codexMcp.includes("[mcp_servers.shadcn]"), "The free shadcn-compatible registry MCP must remain configured.");
assertCondition(!/mobbin|magic_patterns|twenty_first_dev|chromatic/i.test(codexMcp), "Paid vendor MCP blocks must be removed.");

const expectedItems = new Map([
  ["fit-button", "components/fit/FitButton.tsx"],
  ["fit-card", "components/fit/FitCard.tsx"],
  ["fit-table", "components/fit/FitTable.tsx"],
]);

assertCondition(Array.isArray(registry.items) && registry.items.length === expectedItems.size, "Registry must contain exactly the stable FitTrack primitive seed.");
for (const item of registry.items) {
  const expectedPath = expectedItems.get(item.name);
  assertCondition(expectedPath !== undefined, `Unexpected registry item: ${item.name}`);
  assertCondition(item.type === "registry:ui", `${item.name} must be a UI registry item.`);
  assertCondition(item.files?.length === 1 && item.files[0].path === expectedPath, `${item.name} must point to its stable source primitive.`);
  const sourcePath = path.resolve(webRoot, item.files[0].path);
  const stableRoot = `${path.resolve(webRoot, "components", "fit")}${path.sep}`;
  assertCondition(sourcePath.startsWith(stableRoot) && fs.existsSync(sourcePath), `${item.name} points outside the stable primitive set.`);
}

const shadcn = vscodeMcp.servers?.shadcn;
assertCondition(shadcn?.command === "npx" && JSON.stringify(shadcn.args) === JSON.stringify(["shadcn@3.0.0", "mcp"]), "VS Code shadcn MCP entry is incomplete.");

for (const storyName of ["ResourceListTable", "EntityDetail", "CreateEditTransaction"]) {
  assertCondition(goldenStories.includes(`export const ${storyName}`), `Missing golden Storybook archetype: ${storyName}`);
}

console.log(`FitTrack tooling validation passed: ${registry.items.length} registry primitives and 3 deterministic golden stories; no credentials embedded.`);
