import { spawn } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`
          }.`,
        ),
      );
    });
  });
}

async function main() {
  let primaryFailure = null;

  try {
    await run(pnpmCommand, ["--dir", "apps/api", "run", "db:fixture:e2e:apply"]);
    await run(
      pnpmCommand,
      [
        "exec",
        "playwright",
        "test",
        "tests/ui/real-data-corrective.spec.ts",
        "--project=desktop-chrome",
        "--project=mobile-chrome",
      ],
      { FITTRACK_REAL_DATA_E2E: "1" },
    );
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      await run(pnpmCommand, ["--dir", "apps/api", "run", "db:fixture:e2e:cleanup"]);
    } catch (cleanupError) {
      if (primaryFailure) {
        throw new AggregateError(
          [primaryFailure, cleanupError],
          "Real-data E2E and fixture cleanup both failed.",
        );
      }
      throw cleanupError;
    }
  }

  if (primaryFailure) throw primaryFailure;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
