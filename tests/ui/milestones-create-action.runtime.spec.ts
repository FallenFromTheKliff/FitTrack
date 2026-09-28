import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

async function readAdminCredential() {
  const artifactRoot = resolve(process.cwd(), ".artifacts");

  for (const fileName of [
    "dynamic-seed-manifest.json",
    "test-data-manifest.json",
  ]) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(artifactRoot, fileName), "utf8"),
      ) as { credentials: Credential[] };
      const credential = manifest.credentials.find(
        ({ role }) => role.toLowerCase() === "admin",
      );
      if (credential) return credential;
    } catch {
      // Try the next supported local seed manifest.
    }
  }

  throw new Error("Missing seeded admin credential manifest.");
}

async function loginAdmin(page: Page) {
  const credential = await readAdminCredential();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email Address").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

async function expectNoHorizontalOverflow(page: Page, surface: string) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(
    metrics.documentWidth - metrics.viewportWidth,
    `${surface} should not overflow horizontally`,
  ).toBeLessThanOrEqual(1);
}

test("seeded admin has one milestones create action across tabs and modal flow", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginAdmin(page);
  await page.goto("/milestones", { waitUntil: "domcontentloaded" });

  const main = page.getByRole("main");
  await expect(page).toHaveURL(/\/milestones(?:\?|$)/, { timeout: 60_000 });
  await expect(
    main.getByRole("heading", { name: "Milestones", exact: true, level: 1 }),
  ).toBeVisible({ timeout: 30_000 });

  const manageTab = main.getByRole("button", {
    name: "Manage milestones",
    exact: true,
  });
  await expect(manageTab).toHaveCount(1);
  await expect(manageTab).toBeVisible();

  const createAction = main.getByRole("button", {
    name: "Create milestone",
    exact: true,
  });
  await expect(createAction).toHaveCount(1);
  await expect(createAction).toBeVisible();
  await expectNoHorizontalOverflow(page, `${testInfo.project.name} manage tab`);

  const insightsTab = main.getByRole("button", {
    name: "Insights",
    exact: true,
  });
  await expect(insightsTab).toHaveCount(1);
  await insightsTab.click();
  await expect(
    main.getByRole("heading", { name: "Milestone insights", exact: true }),
  ).toBeVisible();

  // Count before opening: the modal footer has its own Create milestone action.
  const insightsCreateAction = main.getByRole("button", {
    name: "Create milestone",
    exact: true,
  });
  await expect(insightsCreateAction).toHaveCount(1);
  await expect(insightsCreateAction).toBeVisible();
  await expectNoHorizontalOverflow(page, `${testInfo.project.name} insights tab`);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `milestones-create-action-${testInfo.project.name}-page.png`,
    ),
  });

  await insightsCreateAction.click();
  const dialog = page.getByRole("dialog", {
    name: "Create milestone",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      "Set the goal and reward. Progress unlocks automatically from member activity.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Title", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, `${testInfo.project.name} create modal`);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `milestones-create-action-${testInfo.project.name}-modal.png`,
    ),
  });

  await dialog.getByRole("button", { name: "Close modal", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(consoleErrors).toEqual([]);
});
