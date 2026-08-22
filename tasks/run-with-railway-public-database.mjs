import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
const publicDatabaseUrl = process.env.DATABASE_PUBLIC_URL;

if (!command) {
  console.error(
    "[railway-db] Usage: node tasks/run-with-railway-public-database.mjs <command> [...args]",
  );
  process.exit(1);
}

if (!publicDatabaseUrl) {
  console.error(
    "[railway-db] DATABASE_PUBLIC_URL is unavailable. Run this through `railway run --service Postgres --no-local`.",
  );
  process.exit(1);
}

const parsedUrl = new URL(publicDatabaseUrl);
if (parsedUrl.hostname.endsWith(".railway.internal")) {
  console.error(
    "[railway-db] Refusing to use a Railway private hostname from the local machine.",
  );
  process.exit(1);
}

process.env.DATABASE_URL = publicDatabaseUrl;
console.log(
  `[railway-db] Using Railway public proxy ${parsedUrl.hostname}:${parsedUrl.port}.`,
);

const usesWindowsCommandShim =
  process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
const executable = usesWindowsCommandShim
  ? process.env.ComSpec || "cmd.exe"
  : command;
const commandArgs = usesWindowsCommandShim
  ? ["/d", "/s", "/c", command, ...args]
  : args;
const result = spawnSync(executable, commandArgs, {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `[railway-db] Failed to start command: ${result.error.message}`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
