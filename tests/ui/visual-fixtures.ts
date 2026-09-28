import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test as base, type Page } from "@playwright/test";
import {
  assertVisualSeedScenario,
  type VisualSeedContract,
} from "./visual/seed-contract.ts";

export type VisualRole = "member" | "coach" | "staff" | "admin";
export type VisualSurface = "web" | "mobile";

type SeedCredential = {
  email: string;
  password: string;
  role: string;
};

type SeedManifest = {
  credentials: SeedCredential[];
};

export type VisualFixtures = {
  authenticatedPage: Page;
  visualRole: VisualRole;
  visualSurface: VisualSurface;
  visualViewport: string;
  /** Required by expectVisualMatch; kept optional for non-baseline route checks. */
  visualSeedScenario: string;
};

export type ActiveVisualFixtureContract = {
  role: VisualRole;
  surface: VisualSurface;
  viewport: string;
  seedScenario: string;
  seedContract: VisualSeedContract;
};

const seedManifestPath = resolve(
  process.cwd(),
  ".artifacts",
  "dynamic-seed-manifest.json",
);
const mobileBaseURL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://localhost:8081";

const activeVisualFixtureContracts = new WeakMap<Page, ActiveVisualFixtureContract>();

export function getActiveVisualFixtureContract(page: Page) {
  return activeVisualFixtureContracts.get(page) ?? null;
}

async function readSeedCredential(role: VisualRole) {
  const manifest = JSON.parse(
    await readFile(seedManifestPath, "utf8"),
  ) as SeedManifest;
  const credential = manifest.credentials.find(
    (candidate) => candidate.role.toLowerCase() === role,
  );
  if (!credential) {
    throw new Error(`No seeded visual-QA credential exists for role: ${role}`);
  }
  return credential;
}

async function login(page: Page, role: VisualRole, surface: VisualSurface) {
  const credential = await readSeedCredential(role);
  const loginPath = surface === "mobile" || role !== "member" ? "/login" : "/member-login";
  const loginURL =
    surface === "mobile"
      ? new URL(loginPath, mobileBaseURL).toString()
      : loginPath;

  await page.goto(loginURL);
  await page
    .getByLabel(surface === "mobile" ? "Email" : "Email Address")
    .fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  if (surface === "mobile") {
    await page.waitForURL(/\/home(?:\?|$)/, { timeout: 20_000 });
    return;
  }

  await page.waitForURL(/\/(?:home|dashboard|schedule|analytics)(?:\?|$)/, {
    timeout: 20_000,
  });
}

export const test = base.extend<VisualFixtures>({
  visualRole: ["admin", { option: true }],
  visualSurface: ["web", { option: true }],
  visualViewport: ["desktop-1920x1080", { option: true }],
  visualSeedScenario: ["", { option: true }],
  authenticatedPage: async (
    { page, visualRole, visualSurface, visualViewport, visualSeedScenario },
    use,
    testInfo,
  ) => {
    if (testInfo.project.name !== visualViewport) {
      await use(page);
      return;
    }

    const seedContract = visualSeedScenario
      ? assertVisualSeedScenario(visualSeedScenario, {
          role: visualRole,
          surface: visualSurface,
          viewport: visualViewport,
        })
      : null;

    await login(page, visualRole, visualSurface);
    if (!seedContract) {
      await use(page);
      return;
    }

    activeVisualFixtureContracts.set(page, {
      role: visualRole,
      surface: visualSurface,
      viewport: visualViewport,
      seedScenario: visualSeedScenario,
      seedContract,
    });
    try {
      await use(page);
    } finally {
      activeVisualFixtureContracts.delete(page);
    }
  },
});

export { expect };
