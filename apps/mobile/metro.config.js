const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync.native?.(targetPath) ?? fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function uniqueExistingPaths(paths) {
  return [
    ...new Set(
      paths
        .filter(Boolean)
        .map((folder) => safeRealpath(folder))
        .filter((folder) => fs.existsSync(folder)),
    ),
  ];
}

function safeResolveModule(request, resolverPaths) {
  try {
    return require.resolve(request, { paths: resolverPaths });
  } catch {
    return null;
  }
}

const logicalAppRoot = __dirname;
const appRoot = safeRealpath(logicalAppRoot);
const workspaceRoot = safeRealpath(path.resolve(logicalAppRoot, "..", ".."));

const config = getDefaultConfig(appRoot);
const extraBlockList = [
  /[\\/]playwright-core[\\/]\.local-browsers([\\/]|$)/,
  /[\\/]\.artifacts([\\/]|$)/,
  /[\\/]\.pytest_cache([\\/]|$)/,
  /[\\/]\.uv-cache([\\/]|$)/,
  /[\\/]\.uv-cache-local([\\/]|$)/,
  /[\\/]\.uv-runtime([\\/]|$)/,
  /[\\/]\.venv([\\/]|$)/,
  /[\\/]\.next([\\/]|$)/,
  /[\\/]\.next-runtime([\\/]|$)/,
  /[\\/]pytest-cache-files[^\\/]*([\\/]|$)/,
  /[\\/]node_modules[\\/]\.pnpm[\\/]next@[^\\/]+[\\/]node_modules[\\/]next_tmp_[^\\/]+([\\/]|$)/,
];
const resolverPaths = uniqueExistingPaths([
  path.join(logicalAppRoot, "node_modules"),
  path.join(appRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
]);
const metroRuntimeEntry = safeResolveModule("@expo/metro-runtime/src/index.ts", resolverPaths);
const preferredMetroRuntimeRoot = uniqueExistingPaths([
  path.join(logicalAppRoot, "node_modules", "@expo", "metro-runtime"),
  path.join(appRoot, "node_modules", "@expo", "metro-runtime"),
])[0];

config.watchFolders = uniqueExistingPaths([workspaceRoot]);

config.resolver.nodeModulesPaths = resolverPaths;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...(preferredMetroRuntimeRoot
    ? {
        "@expo/metro-runtime": preferredMetroRuntimeRoot,
      }
    : {}),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@expo/metro-runtime" && metroRuntimeEntry) {
    return {
      type: "sourceFile",
      filePath: metroRuntimeEntry,
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...extraBlockList,
];

module.exports = config;
