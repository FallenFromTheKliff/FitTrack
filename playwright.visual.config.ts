import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
const mobileBaseURL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://localhost:8081";

const sharedUse = {
  locale: "en-PH",
  timezoneId: "Asia/Manila",
  colorScheme: "light" as const,
  reducedMotion: "reduce" as const,
  screenshot: "off" as const,
  trace: "retain-on-failure" as const,
  video: "retain-on-failure" as const,
};

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: /route-visual-.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 0,
      scale: "css",
      threshold: 0,
    },
  },
  outputDir: ".artifacts/playwright/visual-results",
  reporter: [
    ["line"],
    ["html", { outputFolder: ".artifacts/playwright/visual-report", open: "never" }],
  ],
  use: {
    ...sharedUse,
    baseURL,
  },
  webServer: [
    {
      command: "pnpm dev:web",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm dev:mobile:web",
      url: mobileBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "desktop-1920x1080",
      use: {
        ...sharedUse,
        ...devices["Desktop Chrome"],
        baseURL,
        channel: "chrome",
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "mobile-320x844",
      use: {
        ...sharedUse,
        ...devices["Pixel 7"],
        baseURL,
        channel: "chrome",
        viewport: { width: 320, height: 844 },
      },
    },
    {
      name: "mobile-390x844",
      use: {
        ...sharedUse,
        ...devices["Pixel 7"],
        baseURL,
        channel: "chrome",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-430x932",
      use: {
        ...sharedUse,
        ...devices["Pixel 7"],
        baseURL,
        channel: "chrome",
        viewport: { width: 430, height: 932 },
      },
    },
  ],
});
