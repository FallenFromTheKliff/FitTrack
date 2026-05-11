#!/usr/bin/env node

const path = require("node:path");
const { spawn } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const expoCliPath = path.join(appRoot, "node_modules", "expo", "bin", "cli");
const localApiBaseUrl = process.env.FITTRACK_LOCAL_API_URL || "http://127.0.0.1:3001/v1";

const expoEnv = {
  ...process.env,
  EXPO_PUBLIC_API_URL: localApiBaseUrl,
};

console.log(`[fittrack-mobile-web] Local API: ${expoEnv.EXPO_PUBLIC_API_URL}`);

const expoProcess = spawn(
  process.execPath,
  [expoCliPath, "start", "--web", ...process.argv.slice(2)],
  {
    cwd: appRoot,
    stdio: "inherit",
    env: expoEnv,
    windowsHide: true,
  },
);

expoProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
