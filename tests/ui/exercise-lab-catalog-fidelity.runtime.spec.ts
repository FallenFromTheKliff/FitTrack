import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };

async function waitForSurfaceRows(surface: Locator) {
  await expect(surface.locator("table")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => surface.locator("tbody tr.fit-table-row").count(), {
      timeout: 30_000,
      message: "The seeded catalog should render data rows instead of remaining in loading state.",
    })
    .toBeGreaterThan(0);
}

async function assertConditionalRowActions(surface: Locator) {
  const rows = surface.locator("tbody tr.fit-table-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    const actionButtons = row.locator("td").last().getByRole("button");
    await expect(actionButtons).toHaveCount(2);
    const ariaLabels = await actionButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? ""),
    );
    expect(ariaLabels.filter((label) => /^Edit /.test(label))).toHaveLength(1);

    const status = await row.locator("[data-catalog-status]").getAttribute(
      "data-catalog-status",
    );
    expect(status).toMatch(/^(active|archived)$/);
    await expect(row.locator('[data-catalog-status] [aria-hidden="true"]')).toHaveCount(1);
    if (status === "active") {
      expect(ariaLabels.filter((label) => /^Archive /.test(label))).toHaveLength(1);
      expect(ariaLabels.filter((label) => /^Restore /.test(label))).toHaveLength(0);
    } else {
      expect(ariaLabels.filter((label) => /^Restore /.test(label))).toHaveLength(1);
      expect(ariaLabels.filter((label) => /^Archive /.test(label))).toHaveLength(0);
    }
  }
}

async function assertExerciseCellContract(surface: Locator) {
  const headings = (await surface.locator("thead th").allTextContents()).map((text) =>
    text.trim(),
  );
  expect(headings).toEqual([
    "Exercise",
    "Category",
    "Muscle",
    "Status",
    "Updated",
    "ACTIONS",
  ]);

  const categoryIndex = headings.indexOf("Category");
  const updatedIndex = headings.indexOf("Updated");
  const rows = surface.locator("tbody tr.fit-table-row");
  for (let index = 0; index < (await rows.count()); index += 1) {
    const row = rows.nth(index);
    const trackingMode = await row
      .locator("[data-catalog-exercise-tracking-mode]")
      .getAttribute("data-catalog-exercise-tracking-mode");
    expect(trackingMode).toMatch(/^(manual|inherit|override)$/);
    await expect(row.locator("[data-catalog-tracking-tag]")).toHaveCount(
      trackingMode === "manual" ? 0 : 1,
    );

    const categoryCell = row.locator("td").nth(categoryIndex);
    await expect(categoryCell.locator('[data-catalog-category="plain"]')).toHaveCount(1);
    await expect(categoryCell.locator("[data-catalog-status]")).toHaveCount(0);

    const updatedText = (await row.locator("td").nth(updatedIndex).innerText()).trim();
    expect(updatedText).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
}

async function assertMuscleCellContract(surface: Locator) {
  const headings = (await surface.locator("thead th").allTextContents()).map((text) =>
    text.trim(),
  );
  expect(headings).toEqual([
    "Muscle",
    "Region",
    "Aliases",
    "Sort",
    "Status",
    "ACTIONS",
  ]);

  const rows = surface.locator("tbody tr.fit-table-row");
  for (let index = 0; index < (await rows.count()); index += 1) {
    const row = rows.nth(index);
    const isSystem = await row
      .locator("[data-catalog-muscle-system]")
      .getAttribute("data-catalog-muscle-system");
    expect(isSystem).toMatch(/^(true|false)$/);
    await expect(row.locator("[data-catalog-system-tag]")).toHaveCount(
      isSystem === "true" ? 1 : 0,
    );

    const sortIndex = headings.indexOf("Sort");
    const sortText = (await row.locator("td").nth(sortIndex).innerText()).trim();
    expect(sortText).toMatch(/^\d+$/);
  }
}

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
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
}

async function waitForCatalogRows(page: Page) {
  const surface = page.getByTestId("exercise-lab-library-surface");
  await waitForSurfaceRows(surface);
  return surface;
}

async function readCatalogGeometry(
  page: Page,
  testId = "exercise-lab-library-surface",
) {
  return page.getByTestId(testId).evaluate((node) => {
    const surface = node as HTMLElement;
    const table = surface.querySelector("table") as HTMLTableElement | null;
    const interactive = Array.from(
      surface.querySelectorAll<HTMLElement>("button, input"),
    )
      .map((element) => Math.round(element.getBoundingClientRect().height))
      .filter((height) => height > 0);
    const horizontalScrollOwners = Array.from(
      surface.querySelectorAll<HTMLElement>("*"),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      return (
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1
      );
    });

    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      horizontalScrollOwners: horizontalScrollOwners.length,
      interactiveHeights: interactive,
      tableMinWidth: table ? window.getComputedStyle(table).minWidth : "",
      viewportWidth: window.innerWidth,
    };
  });
}

test("preserves the Exercise Lab catalog contract across desktop and narrow layouts", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const exerciseListRequests: string[] = [];
  page.on("request", (request) => {
    if (/exercise/i.test(request.url()) && /limit=8/.test(request.url())) {
      exerciseListRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto("/exercise-lab?tab=library", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /exercise lab/i })).toBeVisible({
    timeout: 30_000,
  });

  const surface = await waitForCatalogRows(page);
  await expect(surface.getByRole("tab", { name: "Exercise library" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(surface.getByRole("tab", { name: "Muscle groups" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(surface.getByRole("button", { name: "Create" })).toHaveCount(1);
  await expect(surface.getByRole("button", { name: "Refresh" })).toHaveCount(1);
  expect(await surface.locator(".exercise-lab-surface-actions > button").allTextContents()).toEqual([
    "Refresh",
    "Create",
  ]);

  const rowCount = await surface.locator("tbody tr.fit-table-row").count();
  expect(rowCount).toBeGreaterThan(0);
  expect(rowCount).toBeLessThanOrEqual(8);
  expect(exerciseListRequests.some((url) => /limit=8/.test(url))).toBe(true);
  await assertExerciseCellContract(surface);
  await assertConditionalRowActions(surface);

  const geometry = await readCatalogGeometry(page);
  expect(geometry.tableMinWidth).toBe("1240px");
  if (testInfo.project.name === "mobile-chrome") {
    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(
      geometry.viewportWidth + 1,
    );
    expect(geometry.horizontalScrollOwners).toBe(1);
    expect(Math.min(...geometry.interactiveHeights)).toBeGreaterThanOrEqual(44);
  }

  const pagination = surface.getByRole("navigation", {
    name: "Exercise library pagination",
  });
  await expect(pagination).toBeVisible();
  const nextPage = pagination.getByRole("button", { name: "Go to next page" });
  if (!(await nextPage.isDisabled())) {
    await nextPage.click();
    await expect(surface).toContainText(/Showing page 2 of/i);
    const previousPage = pagination.getByRole("button", {
      name: "Go to previous page",
    });
    await previousPage.click();
    await expect(surface).toContainText(/Showing page 1 of/i);
  }

  const search = surface.getByRole("textbox", { name: "Search global exercises" });
  await search.fill("Dumbbell");
  await expect(surface.getByRole("button", { name: "Clear search" })).toBeVisible();
  await surface.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");

  const category = surface.getByRole("button", { name: /All categories/i });
  await category.click();
  await expect(page.getByRole("menuitem", { name: "Strength" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Strength" }).click();
  await expect(surface.getByRole("button", { name: /Strength/i })).toHaveAttribute(
    "data-value",
    "Strength",
  );
  await surface.getByRole("button", { name: /Strength/i }).click();
  await page.getByRole("menuitem", { name: "All categories" }).click();

  await surface.getByRole("button", { name: "Include archived" }).click();
  await expect(surface.getByRole("button", { name: "Include archived" })).toHaveCount(1);
  await waitForSurfaceRows(surface);
  expect(await surface.locator("tbody tr.fit-table-row").count()).toBeLessThanOrEqual(8);
  await assertExerciseCellContract(surface);
  await assertConditionalRowActions(surface);
  await surface.getByRole("button", { name: "Active only" }).click();
  await waitForSurfaceRows(surface);

  await surface.getByRole("tab", { name: "Muscle groups" }).click();
  const muscleSurface = page.getByTestId("exercise-lab-muscle-surface");
  await expect(muscleSurface).toBeVisible();
  await waitForSurfaceRows(muscleSurface);
  await expect(muscleSurface.getByRole("tab", { name: "Muscle groups" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const muscleRowCount = await muscleSurface.locator("tbody tr.fit-table-row").count();
  expect(muscleRowCount).toBeGreaterThan(0);
  expect(muscleRowCount).toBeLessThanOrEqual(8);
  const muscleGeometry = await readCatalogGeometry(
    page,
    "exercise-lab-muscle-surface",
  );
  expect(muscleGeometry.tableMinWidth).toBe("1080px");
  const musclePagination = muscleSurface.getByRole("navigation", {
    name: "Muscle library pagination",
  });
  await expect(musclePagination).toBeVisible();
  await assertMuscleCellContract(muscleSurface);
  await assertConditionalRowActions(muscleSurface);
  await muscleSurface.getByRole("tab", { name: "Exercise library" }).click();
  await expect(surface).toBeVisible();
  await expect(surface.getByRole("tab", { name: "Exercise library" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`exercise-lab-catalog-${testInfo.project.name}.png`),
  });
});

test("keeps Exercise Lab help clear of the workbench footer on a 412px viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "This geometry guard is mobile-only.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await loginAdmin(page);
  await page.goto("/exercise-lab?tab=library", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("textbox", { name: "Search global exercises" });
  await search.waitFor({ state: "visible", timeout: 30_000 });
  await search.fill("Dumbbell Biceps Curl");
  const edit = page.getByRole("button", { name: "Edit Dumbbell Biceps Curl" });
  await edit.waitFor({ state: "visible", timeout: 30_000 });
  await edit.click();

  const workbench = page.getByTestId("exercise-lab-workbench");
  await workbench.waitFor({ state: "visible", timeout: 30_000 });
  const continueButton = workbench.getByRole("button", { name: "Continue" });
  const helpButton = page.getByRole("button", {
    name: "Open help for Exercise Lab",
  });
  await continueButton.waitFor({ state: "visible", timeout: 30_000 });
  await helpButton.waitFor({ state: "visible", timeout: 30_000 });

  await page.locator(".fit-browser-scrollpane").evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
  });
  await expect
    .poll(() =>
      continueButton.evaluate((element) => Math.round(element.getBoundingClientRect().bottom)),
    )
    .toBeGreaterThan(0);

  const geometry = await page.evaluate(() => {
    const help = document.querySelector(
      'button[aria-label="Open help for Exercise Lab"]',
    );
    const continueButton = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "Continue",
    );
    if (!help || !continueButton) return null;
    const helpRect = help.getBoundingClientRect();
    const continueRect = continueButton.getBoundingClientRect();
    return {
      continue: {
        bottom: continueRect.bottom,
        top: continueRect.top,
        right: continueRect.right,
        left: continueRect.left,
      },
      help: {
        bottom: helpRect.bottom,
        top: helpRect.top,
        right: helpRect.right,
        left: helpRect.left,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry?.viewport.width).toBe(412);
  expect(geometry?.help.right).toBeLessThanOrEqual(412);
  expect(geometry?.help.left).toBeGreaterThanOrEqual(0);
  expect(
    geometry &&
      (geometry.help.bottom <= geometry.continue.top - 12 ||
        geometry.help.top >= geometry.continue.bottom + 12),
  ).toBe(true);
  expect(
    geometry &&
      !(
        geometry.help.right > geometry.continue.left &&
        geometry.continue.right > geometry.help.left &&
        geometry.help.bottom > geometry.continue.top &&
        geometry.continue.bottom > geometry.help.top
      ),
  ).toBe(true);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("exercise-lab-workbench-help-clear-412.png"),
  });
});
