import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

type SeedCredential = { email: string; password: string; role: string };

async function readAdminCredential() {
  const artifactRoot = resolve(process.cwd(), ".artifacts");

  for (const fileName of [
    "dynamic-seed-manifest.json",
    "test-data-manifest.json",
  ]) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(artifactRoot, fileName), "utf8"),
      ) as { credentials: SeedCredential[] };
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
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

function sectionForHeading(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true }).locator("xpath=../..");
}

function legendItem(section: Locator, label: string) {
  return section.locator(".recharts-legend-item").filter({ hasText: label }).first();
}

async function readLegendPaint(item: Locator) {
  return item.locator(".recharts-legend-icon").evaluate((shape) => {
    const styles = getComputedStyle(shape);
    if (
      styles.fill &&
      styles.fill !== "none" &&
      styles.fill !== "transparent" &&
      styles.fill !== "rgba(0, 0, 0, 0)"
    ) {
      return styles.fill;
    }
    if (
      styles.stroke &&
      styles.stroke !== "none" &&
      styles.stroke !== "transparent" &&
      styles.stroke !== "rgba(0, 0, 0, 0)"
    ) {
      return styles.stroke;
    }
    return null;
  });
}

async function readCompositionPaint(row: Locator) {
  return row.locator('span[aria-hidden="true"]').evaluate((swatch) =>
    getComputedStyle(swatch).backgroundColor,
  );
}

async function resolveThemeToken(page: Page, tokenName: string) {
  return page.evaluate((name) => {
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!token) return null;

    const probe = document.createElement("span");
    probe.style.color = token;
    probe.style.position = "fixed";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, tokenName);
}

test("analytics keeps revenue category colors stable across chart consumers", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginAdmin(page);
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/analytics(?:\?|$)/, { timeout: 60_000 });

  const momentum = sectionForHeading(page, "Revenue momentum");
  const composition = sectionForHeading(page, "Revenue composition");
  await expect(momentum).toBeVisible({ timeout: 60_000 });
  await expect(composition).toBeVisible({ timeout: 60_000 });

  const productsMomentum = legendItem(momentum, "Products");
  const productsComposition = composition
    .locator(".analytics-composition-row")
    .filter({ hasText: "Products" });
  await expect(productsMomentum).toHaveCount(1);
  await expect(productsMomentum).toBeVisible();
  await expect(productsComposition).toHaveCount(1);
  await expect(productsComposition).toBeVisible();

  const momentumProductPaint = await readLegendPaint(productsMomentum);
  const compositionProductPaint = await readCompositionPaint(productsComposition);
  expect(momentumProductPaint).toBeTruthy();
  expect(compositionProductPaint).toBeTruthy();
  expect(compositionProductPaint).toBe(momentumProductPaint);

  const textSecondary = await resolveThemeToken(page, "--fit-text-secondary");
  expect(textSecondary).toBeTruthy();
  expect(compositionProductPaint).toBe(textSecondary);

  const coachingMomentum = legendItem(momentum, "Coaching");
  const coachingComposition = composition
    .locator(".analytics-composition-row")
    .filter({ hasText: "Coaching" });
  if ((await coachingMomentum.count()) === 1 && (await coachingComposition.count()) === 1) {
    await expect(coachingMomentum).toBeVisible();
    await expect(coachingComposition).toBeVisible();
    const momentumCoachingPaint = await readLegendPaint(coachingMomentum);
    const compositionCoachingPaint = await readCompositionPaint(coachingComposition);
    expect(compositionCoachingPaint).toBe(momentumCoachingPaint);
    expect(compositionCoachingPaint).not.toBe(compositionProductPaint);

    const warning = await resolveThemeToken(page, "--fit-warning");
    expect(warning).toBeTruthy();
    expect(compositionCoachingPaint).toBe(warning);
  }

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
});
