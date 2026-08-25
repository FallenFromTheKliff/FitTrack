import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

async function loginAdmin(page: Page) {
  let manifest: { credentials: Credential[] } | null = null;
  for (const manifestName of [
    "dynamic-seed-manifest.json",
    "test-data-manifest.json",
  ]) {
    try {
      manifest = JSON.parse(
        await readFile(
          resolve(process.cwd(), ".artifacts", manifestName),
          "utf8",
        ),
      ) as { credentials: Credential[] };
      break;
    } catch {
      // Support both the realistic dynamic seed and the deterministic test seed.
    }
  }
  if (!manifest) throw new Error("Missing FitTrack seed credential manifest.");
  const credential = manifest.credentials.find(({ role }) => role === "admin");
  if (!credential) throw new Error("Missing seeded admin credential.");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email Address").fill(credential.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

test("seeded admin edits the shared Exercise Lab movement contract responsively", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await loginAdmin(page);
  await page.goto("/exercise-lab", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /exercise lab/i }),
  ).toBeVisible({
    timeout: 30_000,
  });

  await page
    .getByRole("textbox", { name: "Search global exercises" })
    .fill("Dumbbell Biceps Curl");
  const editCurl = page.getByRole("button", {
    name: "Edit Dumbbell Biceps Curl",
  });
  await expect(editCurl).toHaveCount(1);
  await editCurl.click();
  const editor = page.getByRole("dialog", { name: "Edit global exercise" });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Continue" }).click();
  await editor.getByRole("button", { name: "Continue" }).click();

  await expect(
    editor.getByText("Movement family", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByText("Tracking mode", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByText("Contract source", { exact: true }),
  ).toBeVisible();
  await expect(editor.getByText("Revision", { exact: true })).toBeVisible();
  await expect(
    editor.getByText(/Effective gates: bottom trigger/),
  ).toContainText("required landmarks");
  const contractStatus = editor.getByRole("region", {
    name: "Movement contract status",
  });
  await expect(contractStatus).toContainText("Bicep Curl");
  await expect(contractStatus).toContainText("Shared family");
  await expect(contractStatus).toContainText(/dumbbell biceps curl/i);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `exercise-lab-contract-${testInfo.project.name}.png`,
    ),
  });

  const editShared = editor.getByRole("button", {
    name: "Edit shared tracking",
  });
  await expect(editShared).toBeVisible();
  await editShared.click();
  const confirmation = page.getByRole("dialog", {
    name: /Edit shared tracking for Bicep Curl/i,
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("list", { name: "Affected inheriting exercises" }),
  ).toContainText("Dumbbell Biceps Curl");
  await expect(
    confirmation.getByRole("button", { name: "Update shared tracking" }),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      confirmation.evaluate((node) => node.contains(document.activeElement)),
    )
    .toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      `exercise-lab-confirmation-${testInfo.project.name}.png`,
    ),
  });
  await confirmation
    .getByRole("button", { name: "Update shared tracking" })
    .click();
  await expect(confirmation).toBeHidden({ timeout: 20_000 });

  await editor
    .getByRole("button", { name: "Create override for this exercise" })
    .click();
  await expect(
    editor.getByText("Exercise override", { exact: true }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Reset to inherited" }).click();
  await expect(
    editor.getByText("Shared family", { exact: true }),
  ).toBeVisible();

  await editor.getByRole("button", { name: "Angles", exact: true }).click();
  const fullBodyRig = editor.getByTestId("exercise-full-body-rig");
  await expect(fullBodyRig).toBeVisible();
  await expect(fullBodyRig).toHaveAttribute("data-rig-visible-landmarks", "33");
  for (const landmarkIndex of [0, 11, 12, 23, 24, 27, 28, 31, 32]) {
    await expect(
      fullBodyRig.locator('[data-rig-landmark="' + landmarkIndex + '"]'),
    ).toHaveCount(1);
  }
  for (const bone of ["0-7", "11-13", "11-23", "23-25", "27-31"]) {
    await expect(
      fullBodyRig.locator('[data-rig-bone="' + bone + '"]'),
    ).toHaveCount(1);
  }

  const downTarget = editor.getByRole("spinbutton", {
    name: "Peak / down target degrees",
  });
  await downTarget.fill("52");
  const effectiveThresholds = editor.locator(
    '[data-mobile-effective-thresholds="true"]',
  );
  await expect(effectiveThresholds).toHaveAttribute("data-down-angle", "52");
  await expect(effectiveThresholds).toContainText(
    "Mobile rep counting now uses 52°",
  );
  await editor.getByRole("button", { name: "Peak contraction" }).click();
  await expect(
    editor.locator('[data-mobile-frame-threshold="down"]'),
  ).toContainText("Peak/down mobile target: 52°");
  await expect(
    editor.locator('input[name="exercise-keyframe-angle"]'),
  ).toHaveValue("52");

  await editor.getByRole("button", { name: "Reset rig" }).click();
  const resetConfirmation = page.getByRole("dialog", {
    name: "Regenerate Rig",
  });
  await expect(resetConfirmation).toContainText(
    "Manual keyframe edits will be overwritten",
  );
  await resetConfirmation
    .getByRole("button", { name: "REGENERATE RIG" })
    .click();
  await expect(resetConfirmation).toBeHidden();
  await expect(fullBodyRig).toHaveAttribute("data-rig-visible-landmarks", "33");
  await expect(effectiveThresholds).toHaveAttribute("data-down-angle", "52");
  await fullBodyRig.scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(
      "exercise-lab-full-body-rig-" + testInfo.project.name + ".png",
    ),
  });
  await fullBodyRig.screenshot({
    path: testInfo.outputPath(
      "exercise-lab-rig-canvas-" + testInfo.project.name + ".png",
    ),
  });
  const editorLayout = await editor.evaluate((dialog) => {
    const scrollOwners = [
      dialog,
      ...dialog.querySelectorAll<HTMLElement>("*"),
    ].filter((node) => {
      const overflowY = window.getComputedStyle(node).overflowY;
      return (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 2
      );
    });
    return {
      horizontalOverflow: dialog.scrollWidth - dialog.clientWidth,
      scrollOwnerCount: scrollOwners.length,
    };
  });
  expect(editorLayout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(editorLayout.scrollOwnerCount).toBeLessThanOrEqual(1);

  await editor.getByRole("button", { name: "Continue" }).click();
  await editor.getByRole("button", { name: "Cancel" }).click();
  const discard = page.getByRole("dialog", { name: "Discard changes?" });
  if (await discard.isVisible()) {
    await discard.getByRole("button", { name: "Discard changes" }).click();
  }
  await expect(editor).toBeHidden({ timeout: 20_000 });

  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - window.innerWidth,
    dialog: Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).map((node) => node.scrollWidth - node.clientWidth),
  }));
  expect(overflow.page).toBeLessThanOrEqual(1);
  expect(overflow.dialog.every((value) => value <= 1)).toBe(true);
  expect(consoleErrors).toEqual([]);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`exercise-lab-${testInfo.project.name}.png`),
  });
});
