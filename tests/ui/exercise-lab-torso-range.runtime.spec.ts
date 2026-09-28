import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("bench torso fields show the enforced range and preserve the other bound when edited", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    (window as any).__poseCameraRequests = 0;
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
      (window as any).__poseCameraRequests++;
      throw new DOMException("Camera blocked for this field-only check", "NotAllowedError");
    };
  });
  let credentials: Array<{email:string;password:string;role:string}> = [];
  for (const filename of ["dynamic-seed-manifest.json", "test-data-manifest.json"]) {
    try {
      credentials = JSON.parse(await readFile(resolve(".artifacts", filename), "utf8")).credentials;
      break;
    } catch { /* Use the existing local manifest only; never seed data. */ }
  }
  const admin = credentials.find(entry => entry.role === "admin");
  if (!admin) throw new Error("Existing local admin fixture is required.");
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(admin.email);
  await page.getByRole("textbox", {name:"Password"}).fill(admin.password);
  await page.getByRole("button", {name:/sign in/i}).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, {timeout:60_000});
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("textbox", {name:"Search global exercises"}).fill("Barbell Bench");
  await page.getByRole("button", {name:/^Edit Barbell Bench Press/}).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  await expect(editor).toBeVisible();
  await editor.getByRole("button", {name:"Movement Builder", exact:true}).click();
  await editor.getByRole("button", {name:/5\.\s*Form checks/}).click();
  await editor.getByText("Fine-tune form checks", {exact:true}).click();
  const minimum = editor.locator('input[data-exercise-field="movementProfile.movementContract.spatialRequirements.torsoSlopeMinDeg"]');
  const maximum = editor.locator('input[data-exercise-field="movementProfile.movementContract.spatialRequirements.torsoSlopeMaxDeg"]');
  await expect(minimum).toHaveValue("0");
  await expect(maximum).toHaveValue("40");
  await minimum.fill("5");
  await expect(maximum).toHaveValue("40");
  await maximum.fill("60");
  await expect(minimum).toHaveValue("5");
  await expect(maximum).toHaveValue("60");
  await expect.poll(() => page.evaluate(() => (window as any).__poseCameraRequests)).toBe(0);
  await editor.screenshot({path:testInfo.outputPath("torso-range-fields.png")});
  // Leave the draft unsaved: no exercise, family, or camera-session writes.
});
