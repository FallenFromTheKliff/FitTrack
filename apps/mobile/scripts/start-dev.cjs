#!/usr/bin/env node

const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const expoCliPath = path.join(appRoot, "node_modules", "expo", "bin", "cli");
const metroPort = "8081";
const apiPort = "3001";
const localApiBaseUrl = process.env.FITTRACK_LOCAL_API_URL || `http://127.0.0.1:${apiPort}/v1`;
const devClientUrl = `exp+fittrack-mobile://expo-development-client/?url=${encodeURIComponent(
  `http://127.0.0.1:${metroPort}`,
)}`;

function detectAdbPath() {
  const sdkCandidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local", "Android", "Sdk") : null,
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

function runAdb(adbPath, args, options = {}) {
  return spawnSync(adbPath, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    windowsHide: true,
  });
}

function listUsbDevices(adbPath) {
  runAdb(adbPath, ["start-server"]);

  const result = runAdb(adbPath, ["devices", "-l"]);
  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter((device) => device.state === "device" && !device.serial.includes(":"))
    .map((device) => device.serial);
}

function primeUsbReverse(adbPath, devices) {
  for (const serial of devices) {
    const reversed = [];
    const failed = [];

    for (const port of [metroPort, apiPort]) {
      const result = runAdb(adbPath, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]);
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
}

function waitForMetroStatus(timeoutMs = 45000) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      const request = http.get(
        {
          hostname: "127.0.0.1",
          port: Number(metroPort),
          path: "/status",
          timeout: 1500,
        },
        (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
            resolve(true);
            return;
          }
          schedule();
        },
      );

      request.on("timeout", () => {
        request.destroy();
        schedule();
      });
      request.on("error", schedule);
    };

    const schedule = () => {
      if (Date.now() - startedAt > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 1000);
    };

    check();
  });
}

async function openDevClientWhenReady(adbPath, devices) {
  if (devices.length === 0) {
    return;
  }

  const metroReady = await waitForMetroStatus();
  if (!metroReady) {
    console.log("[fittrack-mobile] Metro did not report ready yet; open the FitTrack dev client manually if needed.");
    return;
  }

  for (const serial of devices) {
    const result = runAdb(adbPath, [
      "-s",
      serial,
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      devClientUrl,
    ]);

    if (result.status === 0) {
      console.log(`[fittrack-mobile] Opened FitTrack dev client on USB ${serial} via localhost:${metroPort}.`);
    } else {
      console.log(`[fittrack-mobile] Could not auto-open FitTrack dev client on USB ${serial}. Open the APK manually, then press r.`);
    }
  }
}

const adbPath = detectAdbPath();
const usbDevices = adbPath ? listUsbDevices(adbPath) : [];

if (!adbPath) {
  console.log("[fittrack-mobile] adb not found; native dev will use LAN QR if available.");
} else if (usbDevices.length === 0) {
  console.log("[fittrack-mobile] No USB Android device found; native dev will use LAN QR if available.");
} else {
  primeUsbReverse(adbPath, usbDevices);
}

const expoEnv = {
  ...process.env,
  EXPO_PUBLIC_API_URL: localApiBaseUrl,
};

console.log(`[fittrack-mobile] Local API: ${expoEnv.EXPO_PUBLIC_API_URL}`);

const expoProcess = spawn(
  process.execPath,
  ["--max-old-space-size=8192", expoCliPath, "start", "--lan", "--port", metroPort],
  {
    cwd: appRoot,
    stdio: "inherit",
    env: expoEnv,
    windowsHide: true,
  },
);

if (adbPath && usbDevices.length > 0) {
  openDevClientWhenReady(adbPath, usbDevices).catch((error) => {
    console.log(`[fittrack-mobile] Dev client auto-open failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

expoProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
