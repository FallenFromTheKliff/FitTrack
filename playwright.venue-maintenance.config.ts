import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "venue-maintenance.paid-runtime.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  outputDir: ".artifacts/playwright/venue-maintenance/results",
  reporter: [
    ["line"],
    [
      "html",
      {
        open: "never",
        outputFolder: ".artifacts/playwright/venue-maintenance/report",
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:8080",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "venue-maintenance-isolated" }],
});
