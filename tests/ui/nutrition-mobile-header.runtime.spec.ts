import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

const manifestPath = resolve(process.cwd(), ".artifacts", "dynamic-seed-manifest.json");
const mobileBaseUrl = "http://127.0.0.1:8081";

async function loginMobileMember(page: Page) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    credentials: Credential[];
  };
  const credential = manifest.credentials.find((item) => item.role === "member");
  if (!credential) throw new Error("Missing member test account.");

  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 30_000 });
}

async function dismissAutomaticHelp(page: Page) {
  const helpTitle = page.getByText("Help - Nutrition", { exact: true });
  const closeHelp = page.getByText("Close Help", { exact: true });
  try {
    await helpTitle.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return;
  }
  await closeHelp.click();
  await expect(helpTitle).toBeHidden();
}

test("member nutrition route has one shell-owned Nutrition header", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginMobileMember(page);
  await page.goto(`${mobileBaseUrl}/nutrition`);
  await dismissAutomaticHelp(page);

  const nutritionTitles = page.getByText("Nutrition", { exact: true });
  await expect(nutritionTitles).toHaveCount(1);
  await expect(nutritionTitles).toBeVisible();
  await expect(page.getByText("TODAY'S CALORIES", { exact: true })).toBeVisible();
  await dismissAutomaticHelp(page);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("nutrition-single-header.png"),
  });
});
