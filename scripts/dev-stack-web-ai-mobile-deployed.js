const { spawn } = require("node:child_process");

const root = process.cwd();
const args = process.argv.slice(2);

function parseArgs(values) {
  let apiUrl = null;
  let mobilePort = "8081";

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];

    if (arg === "--help" || arg === "-h") {
      return {
        help: true,
      };
    }

    if (arg === "--api-url") {
      const value = values[index + 1];
      if (!value) {
        throw new Error("--api-url requires a value (e.g. https://your-api.up.railway.app/v1)");
      }
      apiUrl = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--api-url=")) {
      apiUrl = arg.slice("--api-url=".length);
      continue;
    }

    if (arg === "--port") {
      const value = values[index + 1];
      if (!value) {
        throw new Error("--port requires a value.");
      }
      mobilePort = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      mobilePort = arg.slice("--port=".length);
      continue;
    }
  }

  return { apiUrl, mobilePort };
}

function showHelp() {
  console.log(`Usage: pnpm dev:stack:web:ai:mobile-web-deployed [--api-url <url>] [--port <8081>]`);
  console.log("  --api-url   Backend URL to force mobile web against (for OTP/deployed tests)");
  console.log("  --port      Port for mobile web (default: 8081)");
  console.log("Environment overrides used if flag is omitted:");
  console.log("  FITTRACK_MOBILE_DEPLOYED_API_URL");
  console.log("  FITTRACK_LOCAL_API_URL");
  console.log("  EXPO_PUBLIC_API_URL");
}

function resolveApiUrl(parsed) {
  return (
    parsed.apiUrl ||
    process.env.FITTRACK_MOBILE_DEPLOYED_API_URL ||
    process.env.FITTRACK_LOCAL_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "https://api-production-388f.up.railway.app/v1"
  );
}

function spawnService(name, command, argsList, env) {
  const child = spawn(command, argsList, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
    services.delete(child);
    if (!shuttingDown && code !== 0 && code !== null) {
      console.error(`[${name}] stopped unexpectedly. Shutting down the wrapper.`);
      shutdown(code);
    }
  });

  services.add(child);
  console.log(`[${name}] started (pid: ${child.pid})`);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const proc of services) {
    if (!proc.killed) {
      proc.kill("SIGINT");
    }
  }

  setTimeout(() => {
    for (const proc of services) {
      if (!proc.killed) {
        proc.kill("SIGKILL");
      }
    }
    process.exit(code);
  }, 1500);
}

function main() {
  const parsed = parseArgs(args);

  if (parsed.help) {
    showHelp();
    return;
  }

  const deployedApiUrl = resolveApiUrl(parsed);
  const mobilePort = parsed.mobilePort;

  const deployedEnv = {
    ...process.env,
    FITTRACK_LOCAL_API_URL: deployedApiUrl,
    EXPO_PUBLIC_API_URL: deployedApiUrl,
  };

  console.log(`Starting fullstack + mobile web against: ${deployedApiUrl}`);
  console.log(`Mobile web port: ${mobilePort}`);

  spawnService("dev:stack:web:ai", "pnpm", ["dev:stack:web:ai"], process.env);
  spawnService(
    "mobile:web",
    "pnpm",
    ["--dir", "apps/mobile", "run", "web", "--", "--port", mobilePort],
    deployedEnv
  );
}

const services = new Set();
let shuttingDown = false;

process.on("SIGINT", () => {
  console.log("\nShutting down... (Ctrl+C)");
  shutdown(0);
});

process.on("SIGTERM", () => {
  shutdown(0);
});

main();
