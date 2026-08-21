import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "apps", "web");
const registryPath = path.join(webRoot, "registry.json");
const outputRoot = path.join(webRoot, "public", "r");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
if (!Array.isArray(registry.items)) {
  throw new Error("FitTrack registry metadata must contain an items array.");
}

fs.mkdirSync(outputRoot, { recursive: true });

for (const item of registry.items) {
  if (!item.name || !Array.isArray(item.files) || item.files.length === 0) {
    throw new Error(`Registry item ${item.name ?? "<unnamed>"} must declare source files.`);
  }

  const files = item.files.map((file) => {
    const sourcePath = path.resolve(webRoot, file.path);
    const relativePath = path.relative(webRoot, sourcePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`${item.name} points outside the web workspace: ${file.path}`);
    }

    return {
      path: file.path,
      type: file.type ?? "registry:ui",
      content: fs.readFileSync(sourcePath, "utf8"),
    };
  });

  const output = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.categories ? { categories: item.categories } : {}),
    files,
  };

  fs.writeFileSync(path.join(outputRoot, `${item.name}.json`), `${JSON.stringify(output, null, 2)}\n`);
}

console.log(`Built ${registry.items.length} local FitTrack registry items in ${path.relative(repoRoot, outputRoot)}.`);
