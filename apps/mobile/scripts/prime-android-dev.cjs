#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const reversePorts = ["8081", "3001"];

function detectAdbPath() {
  const sdkCandidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "AppData", "Local", "Android", "Sdk")
      : null,
  ].filter(Boolean);

  for (const sdkRoot of sdkCandidates) {
    const adbPath = path.join(
      sdkRoot,
      "platform-tools",
      process.platform === "win32" ? "adb.exe" : "adb",
    );
    const result = spawnSync(adbPath, ["version"], { stdio: "ignore", windowsHide: true });

    if (result.status === 0) {
      return adbPath;
    }
  }

  const fallback = spawnSync("adb", ["version"], { stdio: "ignore", windowsHide: true });
  return fallback.status === 0 ? "adb" : null;
}

function listUsbDevices(adbPath) {
  const result = spawnSync(adbPath, ["devices"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^(.+?)\s+device$/)?.[1])
    .filter((serial) => serial && !serial.includes(":"));
}

function reversePort(adbPath, serial, port) {
  return spawnSync(adbPath, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`], {
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
}

const adbPath = detectAdbPath();

if (!adbPath) {
  console.log("[fittrack-mobile] adb not found; skipping USB reverse priming.");
  process.exit(0);
}

const devices = listUsbDevices(adbPath);

if (devices.length === 0) {
  console.log("[fittrack-mobile] No USB Android device found; native dev will use LAN QR if available.");
  process.exit(0);
}

for (const serial of devices) {
  const reversed = [];
  const failed = [];

  for (const port of reversePorts) {
    const result = reversePort(adbPath, serial, port);

    if (result.status === 0) {
      reversed.push(port);
    } else {
      failed.push(port);
    }
  }

  if (reversed.length > 0) {
    console.log(`[fittrack-mobile] USB ${serial}: reversed ${reversed.map((port) => `tcp:${port}`).join(", ")}.`);
  }

  if (failed.length > 0) {
    console.log(`[fittrack-mobile] USB ${serial}: failed to reverse ${failed.map((port) => `tcp:${port}`).join(", ")}.`);
  }
}
