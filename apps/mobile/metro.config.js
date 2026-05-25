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

function listExistingChildDirectories(parentPath) {
  try {
    return fs
      .readdirSync(parentPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parentPath, entry.name));
  } catch {
    return [];
  }
}

const logicalAppRoot = __dirname;
const appRoot = safeRealpath(logicalAppRoot);
const workspaceRoot = safeRealpath(path.resolve(logicalAppRoot, "..", ".."));
const workspacePackageRoots = listExistingChildDirectories(path.join(workspaceRoot, "packages"));

const config = getDefaultConfig(appRoot);
const extraBlockList = [
  /[\\/]playwright-core[\\/]\.local-browsers([\\/]|$)/,
  /[\\/]\.artifacts([\\/]|$)/,
  /[\\/]\.cxx([\\/]|$)/,
  /[\\/]android[\\/]app[\\/]build([\\/]|$)/,
  /[\\/]android[\\/]build([\\/]|$)/,
  /[\\/]\.pytest_cache([\\/]|$)/,
  /[\\/]\.uv-cache([\\/]|$)/,
  /[\\/]\.uv-cache-local([\\/]|$)/,
  /[\\/]\.uv-runtime([\\/]|$)/,
  /[\\/]\.venv([\\/]|$)/,
  /[\\/]\.next([\\/]|$)/,
  /[\\/]\.next-dev([\\/]|$)/,
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
const mobileSingletonResolverPaths = uniqueExistingPaths([
  path.join(logicalAppRoot, "node_modules"),
  path.join(appRoot, "node_modules"),
]);
const mobileReactRoot = safeResolveModule("react/package.json", mobileSingletonResolverPaths);
const mobileReactNativeRoot = safeResolveModule(
  "react-native/package.json",
  mobileSingletonResolverPaths,
);

function resolveMobileSingleton(moduleName) {
  if (
    moduleName === "react" ||
    moduleName.startsWith("react/") ||
    moduleName === "react-native" ||
    moduleName.startsWith("react-native/")
  ) {
    return safeResolveModule(moduleName, mobileSingletonResolverPaths);
  }

  return null;
}

config.watchFolders = uniqueExistingPaths([
  path.join(workspaceRoot, "node_modules"),
  ...workspacePackageRoots,
]);

config.resolver.nodeModulesPaths = resolverPaths;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...(mobileReactRoot
    ? {
        react: path.dirname(mobileReactRoot),
      }
    : {}),
  ...(mobileReactNativeRoot
    ? {
        "react-native": path.dirname(mobileReactNativeRoot),
      }
    : {}),
  ...(preferredMetroRuntimeRoot
    ? {
        "@expo/metro-runtime": preferredMetroRuntimeRoot,
      }
    : {}),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const singletonEntry = resolveMobileSingleton(moduleName);
  if (singletonEntry) {
    return {
      type: "sourceFile",
      filePath: singletonEntry,
    };
  }

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
