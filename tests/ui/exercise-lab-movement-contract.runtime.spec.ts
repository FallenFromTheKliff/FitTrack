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
  const editor = page.getByTestId("exercise-lab-workbench");
  await expect(editor).toBeVisible();
  const rail = page.getByTestId("exercise-lab-step-rail");
  await expect(rail.getByText("Edit exercise")).toBeVisible();
  await expect(rail.locator("[data-workflow-step]")).toHaveCount(6);
  await expect(rail.getByRole("button", { name: "EXP Allocation" })).toHaveCount(1);
  await expect(rail.getByRole("button", { name: "Training Map" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Training map" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Media" })).toHaveCount(0);
  await expect(
    rail.getByRole("button", { name: "Movement Builder" }),
  ).toHaveCount(1);
  await expect(
    rail.getByRole("button", { name: /Hand Setup optional/i }),
  ).toHaveCount(1);
  await expect(
    rail.getByRole("button", { name: "Review & Publish" }),
  ).toHaveCount(1);
  const headerCopy = editor.locator(
    ".exercise-lab-step-header .exercise-lab-step-header-copy",
  );
  await expect(headerCopy.locator("p")).toHaveCount(1);
  await expect(
    headerCopy.getByText("Name the movement and add coaching guidance.", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    editor.getByText("Name the movement and add coaching guidance.", {
      exact: true,
    }),
  ).toHaveCount(1);
  await rail.getByRole("button", { name: "EXP Allocation" }).click();
  await expect(
    editor.getByRole("heading", { name: "EXP Allocation", exact: true }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Tracking Choice" }).click();
  await expect(
    editor.getByRole("button", {
      name: "Configure hand shapes (optional)",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    editor.getByRole("button", {
      name: "Set up hand requirements",
      exact: true,
    }),
  ).toHaveCount(0);

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

  await editor.getByRole("button", { name: "Movement Builder" }).click();
  await editor.getByRole("button", { name: "Angles", exact: true }).click();
  if (testInfo.project.name === "mobile-chrome") {
    const stageNavigation = editor.locator(
      '[aria-label="Tracking setup progress"]',
    );
    await expect(
      stageNavigation.getByRole("button", { name: "Angles", exact: true }),
    ).toHaveAttribute("aria-current", "step");
    await expect(editor.getByText("3. Angles and keyframes")).toBeVisible();
    const stageLayout = await stageNavigation.evaluate((node) => {
      const element = node as HTMLElement;
      const buttons = Array.from(element.querySelectorAll("button"));
      const rects = buttons.map((button) => button.getBoundingClientRect());
      const overlapPairs = rects.reduce((count, rect, index) => {
        const next = rects[index + 1];
        return count + (next && rect.right > next.left + 0.5 ? 1 : 0);
      }, 0);
      return {
        buttonCount: buttons.length,
        clientWidth: element.clientWidth,
        overflowX: window.getComputedStyle(element).overflowX,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        scrollWidth: element.scrollWidth,
        overlapPairs,
      };
    });
    expect(stageLayout.buttonCount).toBe(6);
    expect(stageLayout.scrollWidth).toBeGreaterThan(stageLayout.clientWidth);
    expect(stageLayout.overflowX).toBe("auto");
    expect(stageLayout.overlapPairs).toBe(0);
    expect(stageLayout.pageOverflow).toBeLessThanOrEqual(1);
  }
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
  const workbenchLayout = await editor.evaluate((workbench) => {
    const pageScrollOwners = document.querySelectorAll(
      ".fit-browser-scrollpane",
    );
    const verticalScrollOwners = Array.from(
      workbench.querySelectorAll<HTMLElement>("*"),
    ).filter((node) => {
      const overflowY = window.getComputedStyle(node).overflowY;
      return (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 2
      );
    });
    return {
      horizontalOverflow: workbench.scrollWidth - workbench.clientWidth,
      pageScrollOwnerCount: pageScrollOwners.length,
      verticalScrollOwners: verticalScrollOwners.map(
        (node) => node.getAttribute("data-testid") ?? node.className,
      ),
    };
  });
  expect(workbenchLayout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(workbenchLayout.pageScrollOwnerCount).toBe(1);
  expect(workbenchLayout.verticalScrollOwners).toEqual([]);

  await editor.getByRole("button", { name: "Continue" }).click();
  await expect(
    rail.getByRole("button", { name: "Review & Publish" }),
  ).toHaveAttribute("aria-current", "step");
  await editor.getByRole("button", { name: "Back" }).click();
  await expect(
    rail.getByRole("button", { name: "Movement Builder" }),
  ).toHaveAttribute("aria-current", "step");
  await rail.getByRole("button", { name: /Hand Setup optional/i }).click();
  await expect(
    editor.getByRole("button", { name: "Done with hands", exact: true }),
  ).toHaveCount(1);
  await editor.getByRole("button", { name: "Done with hands", exact: true }).click();
  await rail.getByRole("button", { name: "Review & Publish" }).click();

  const camera = editor.getByRole("region", { name: "Camera validation" });
  const reviewSummary = editor.getByTestId("exercise-lab-review-summary");
  await expect(camera).toBeVisible();
  await expect(reviewSummary).toBeVisible();
  await expect(editor.getByRole("region", { name: "EXP Allocation" })).toHaveCount(1);
  await expect(editor.getByRole("region", { name: "Training map" })).toHaveCount(0);
  await expect(editor.getByText("Training Map", { exact: true })).toHaveCount(0);
  await expect(editor.getByText("Training map", { exact: true })).toHaveCount(0);
  const reviewOrder = await editor.evaluate((workbench) => {
    const camera = workbench.querySelector('[aria-label="Camera validation"]');
    const summary = workbench.querySelector(
      '[data-testid="exercise-lab-review-summary"]',
    );
    const checklist = Array.from(workbench.querySelectorAll("*" )).find(
      (node) => node.textContent?.trim() === "Definition checklist",
    );
    if (!camera || !summary || !checklist) return null;
    const follows = (before: Node, after: Node) =>
      Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      cameraBeforeChecklist: follows(camera, checklist),
      cameraBeforeSummary: follows(camera, summary),
    };
  });
  expect(reviewOrder).toEqual({
    cameraBeforeChecklist: true,
    cameraBeforeSummary: true,
  });
  await expect(editor.getByText(/reference media|image url|video url/i)).toHaveCount(0);
  await editor.getByRole("button", { name: "Exit", exact: true }).click();
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

test("manual tracking uses the compact media-free flow and keeps camera validation in review", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: undefined },
    });
  });
  await loginAdmin(page);
  await page.goto("/exercise-lab", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("textbox", { name: "Search global exercises" }),
  ).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole("textbox", { name: "Search global exercises" })
    .fill("Dumbbell Biceps Curl");
  await page
    .getByRole("button", { name: "Edit Dumbbell Biceps Curl" })
    .click();

  const workbench = page.getByTestId("exercise-lab-workbench");
  const rail = page.getByTestId("exercise-lab-step-rail");
  await expect(rail.getByRole("button", { name: "EXP Allocation" })).toHaveCount(1);
  await expect(rail.getByRole("button", { name: "Training Map" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Training map" })).toHaveCount(0);
  await rail.getByRole("button", { name: "Tracking Choice" }).click();
  await workbench.getByRole("button", { name: "Manual only", exact: true }).click();

  await expect(rail.locator("[data-workflow-step]")).toHaveCount(4);
  await expect(rail.getByRole("button", { name: "Movement Builder" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: /Hand Setup optional/i })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Media" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Review & Publish" })).toHaveCount(1);

  await rail.getByRole("button", { name: "Review & Publish" }).click();
  const camera = workbench.getByRole("region", { name: "Camera validation" });
  const reviewSummary = workbench.getByTestId("exercise-lab-review-summary");
  await expect(camera).toBeVisible();
  await expect(reviewSummary).toBeVisible();
  const cameraBeforeSummary = await workbench.evaluate((node) => {
    const camera = node.querySelector('[aria-label="Camera validation"]');
    const summary = node.querySelector(
      '[data-testid="exercise-lab-review-summary"]',
    );
    return Boolean(
      camera &&
        summary &&
        camera.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(cameraBeforeSummary).toBe(true);
  await expect(camera).toHaveAttribute("data-camera-state", "idle");
  await expect(workbench.getByText(/reference media|image url|video url/i)).toHaveCount(0);

  await workbench.getByRole("button", { name: "Exit", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "Discard changes?" });
  if (await discard.isVisible()) {
    await discard.getByRole("button", { name: "Discard changes" }).click();
  }
  await expect(workbench).toBeHidden({ timeout: 20_000 });
});

test("Exercise Lab review keeps camera validation opt-in when camera access is unavailable", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: undefined },
    });
  });
  await loginAdmin(page);
  await page.goto("/exercise-lab", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("textbox", { name: "Search global exercises" }),
  ).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole("textbox", { name: "Search global exercises" })
    .fill("Dumbbell Biceps Curl");
  await page
    .getByRole("button", { name: "Edit Dumbbell Biceps Curl" })
    .click();

  const workbench = page.getByTestId("exercise-lab-workbench");
  await workbench.getByRole("button", { name: "Review & Publish" }).click();
  const camera = workbench.getByRole("region", { name: "Camera validation" });
  await expect(camera).toHaveAttribute("data-camera-state", "idle");
  await camera.getByRole("button", { name: "Allow camera access" }).click();
  await expect(camera).toHaveAttribute("data-camera-state", "unavailable");
  await expect(camera).toContainText("Publishing remains available");
});
