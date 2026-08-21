import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_STORYBOOK_BASE_URL ?? "http://127.0.0.1:6006";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: /golden-archetypes\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 0,
      scale: "css",
    },
  },
  outputDir: ".artifacts/playwright/golden-results",
  reporter: [["line"]],
  use: {
    baseURL,
    colorScheme: "dark",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "pnpm --dir apps/web storybook",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
