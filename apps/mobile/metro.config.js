const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const extraBlockList = [
  /[\\/]playwright-core[\\/]\.local-browsers([\\/]|$)/,
  /[\\/]\.artifacts[\\/].*/,
];

// Expo SDK 55 already configures Metro for pnpm workspaces automatically.
// Overriding watch folders or nodeModules paths forces Metro to traverse the
// entire pnpm store, which is what triggers transient `next_tmp_*` watch errors.

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...extraBlockList,
];

module.exports = config;
