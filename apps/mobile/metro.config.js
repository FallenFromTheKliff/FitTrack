const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const appRoot = __dirname;
const workspaceRoot = path.resolve(appRoot, "..", "..");
const mobilePackage = require("./package.json");

function getSharedWorkspacePackageRoots() {
  return Object.keys(mobilePackage.dependencies ?? {})
    .filter((name) => name.startsWith("@fittrack/"))
    .map((name) => path.join(workspaceRoot, "packages", name.replace("@fittrack/", "")))
    .filter((folder) => fs.existsSync(folder));
}

const config = getDefaultConfig(appRoot);
const allowedWatchRoots = new Set([
  path.resolve(appRoot),
  path.resolve(path.join(workspaceRoot, "node_modules")),
  ...getSharedWorkspacePackageRoots().map((folder) => path.resolve(folder)),
]);

const extraBlockList = [
  /[\\/]playwright-core[\\/]\.local-browsers([\\/]|$)/,
  /[\\/]\.artifacts[\\/].*/,
];

config.watchFolders = (config.watchFolders ?? []).filter((folder) =>
  allowedWatchRoots.has(path.resolve(folder)),
);

config.resolver.nodeModulesPaths = [
  path.join(appRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...extraBlockList,
];

module.exports = config;
