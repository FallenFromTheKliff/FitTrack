import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  createFacilitiesFixture,
  fixtureAmenityId,
  installFacilitiesFixture,
} from "./facilities-venues-layout-fixtures";
import {
  auditConventionalLayout,
  stabilizeVisualPage,
} from "./visual-stabilizer";

const FIRST_VENUE = "Venue 01";
const LAST_VENUE = "Venue 12";
const FIRST_VENUE_ID = fixtureAmenityId(1);
const RETAINED_HIDDEN_VENUE_ID = fixtureAmenityId(2);

async function openVenuesTable(page: Page) {
  await page.goto("/facilities");
  await page.getByRole("button", { name: "Venues", exact: true }).first().click();
  await expect(
    page.getByRole("textbox", { name: "Search venues", exact: true }),
  ).toBeVisible();
}

async function tableFrameMetrics(page: Page) {
  return page.evaluate(() => {
    const frame = Array.from(document.querySelectorAll<HTMLElement>("div")).find(
      (element) =>
        ["auto", "scroll", "overlay"].includes(
          window.getComputedStyle(element).overflowX,
        ) && element.querySelector('[aria-label="Venue management pagination"]'),
    );
    const root = frame?.parentElement ?? null;
    const toolbar = root?.firstElementChild as HTMLElement | null;
    const controls = [
      document.querySelector<HTMLElement>('input[aria-label="Search venues"]'),
      ...Array.from(document.querySelectorAll<HTMLElement>("button")).filter(
        (button) =>
          button.getAttribute("aria-label")?.startsWith("Filter venues by") ||
          ["Archive", "Add venue"].includes(button.textContent?.trim() ?? ""),
      ),
    ].filter((element): element is HTMLElement => Boolean(element));
    const rects = controls.map((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
    });
    let overlaps = 0;
    for (let index = 0; index < rects.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < rects.length; otherIndex += 1) {
        const left = rects[index];
        const right = rects[otherIndex];
        if (
          Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1
        ) {
          overlaps += 1;
        }
      }
    }
    const rowHeights = frame
      ? Array.from(frame.querySelectorAll<HTMLElement>('button[aria-label^="More actions for "]'))
          .map((button) => {
            let parent = button.parentElement;
            while (parent && parent !== frame) {
              if (parent.style.minHeight === "62px") {
                return parent.getBoundingClientRect().height;
              }
              parent = parent.parentElement;
            }
            return 0;
          })
          .filter((height) => height > 0)
      : [];

    return {
      frameClientWidth: frame?.clientWidth ?? 0,
      frameHeight: frame?.getBoundingClientRect().height ?? 0,
      frameScrollWidth: frame?.scrollWidth ?? 0,
      rootHeight: root?.getBoundingClientRect().height ?? 0,
      toolbarHeight: toolbar?.getBoundingClientRect().height ?? 0,
      rowHeights,
      overlaps,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

async function assertMenuCentersHitSafe(
  page: Page,
  menu: Locator,
) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is required for menu evidence.");
  const items = menu.getByRole("menuitem");
  const count = await items.count();
  expect(count).toBe(5);
  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    const bounds = await item.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) continue;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return Boolean(element?.closest('[role="menuitem"]'));
    }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    expect(hit).toBe(true);
  }
}

async function assertFooterHitSafe(page: Page) {
  await page
    .getByRole("button", { name: "Go to next page", exact: true })
    .scrollIntoViewIfNeeded();
  const evidence = await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(
      '[aria-label="Venue management pagination"]',
    );
    const footer = navigation?.parentElement ?? null;
    if (!navigation || !footer) {
      return { centerHit: false, footerFound: false, overlappingRows: 0 };
    }

    const footerBounds = footer.getBoundingClientRect();
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('button[aria-label^="More actions for "]'),
    )
      .map((button) => {
        let row = button.parentElement;
        while (row && row.style.minHeight !== "62px") row = row.parentElement;
        return row;
      })
      .filter((row): row is HTMLElement => Boolean(row));
    const overlappingRows = rows.filter(
      (row) => row.getBoundingClientRect().bottom > footerBounds.top + 1,
    ).length;
    const nextButton = navigation.querySelector<HTMLButtonElement>(
      'button[aria-label="Go to next page"]',
    );
    if (!nextButton) {
      return { centerHit: false, footerFound: true, overlappingRows };
    }
    const nextBounds = nextButton.getBoundingClientRect();
    const center = document.elementFromPoint(
      nextBounds.left + nextBounds.width / 2,
      nextBounds.top + nextBounds.height / 2,
    );
    return {
      centerHit: Boolean(center && (center === nextButton || nextButton.contains(center))),
      footerFound: true,
      overlappingRows,
    };
  });
  expect(evidence.footerFound).toBe(true);
  expect(evidence.overlappingRows).toBe(0);
  expect(evidence.centerHit).toBe(true);
}

async function getFacilitiesCanvasCellPoint(
  page: Page,
  column: number,
  row: number,
) {
  const canvas = page.locator("canvas").last();
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Facilities canvas bounds were unavailable.");

  const planWidth = Math.min(
    Math.max(1, bounds.width - 36),
    Math.max(1, bounds.height - 44) * (14 / 10),
  );
  const cellWidth = planWidth / 14;
  const cellHeight = planWidth / 14;

  return {
    x: bounds.x + bounds.width / 2 + (column - 500) * cellWidth,
    y: bounds.y + bounds.height / 2 + (row - 500) * cellHeight,
  };
}

test.describe("Facilities venues table evidence", () => {
  test("long list keeps desktop height, natural rows, toolbar, and pagination bounded", async ({ page }) => {
    const fixture = await installFacilitiesFixture(page, createFacilitiesFixture("long"));
    await openVenuesTable(page);
    await expect(page.getByText("Showing 1–5 of 12", { exact: true })).toBeVisible();

    await stabilizeVisualPage(page);
    const metrics = await tableFrameMetrics(page);
    expect(metrics.frameHeight).toBeGreaterThan(300);
    expect(metrics.frameHeight).toBeGreaterThanOrEqual(
      metrics.rootHeight - metrics.toolbarHeight - 24,
    );
    expect(metrics.rowHeights.length).toBe(5);
    expect(metrics.rowHeights.every((height) => height >= 62)).toBe(true);
    expect(metrics.overlaps).toBe(0);
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    await assertFooterHitSafe(page);

    const firstTrigger = page.getByRole("button", { name: `More actions for ${FIRST_VENUE}` });
    await firstTrigger.click();
    const menu = page.getByRole("menu").last();
    await expect(menu).toBeVisible();
    for (const label of ["View details", "Edit venue", "Mark maintenance", "Remove from map", "Archive"]) {
      await expect(menu.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
    }
    await assertMenuCentersHitSafe(page, menu);
    await menu.getByRole("menuitem", { name: "View details", exact: true }).click();
    await expect(page.getByRole("dialog", { name: FIRST_VENUE, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close venue details" }).click();
    await expect(page.getByRole("dialog", { name: FIRST_VENUE, exact: true })).toBeHidden();

    await firstTrigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(firstTrigger).toBeFocused();

    await page.getByRole("button", { name: "Go to next page" }).click();
    await expect(page.getByText("Showing 6–10 of 12", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Go to next page" }).click();
    await expect(page.getByText("Showing 11–12 of 12", { exact: true })).toBeVisible();
    const lastTrigger = page.getByRole("button", { name: `More actions for ${LAST_VENUE}` });
    await page.locator('div[class*="tableFrame"]').first().evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const actionInset = await lastTrigger.evaluate((button) => {
      let row = button.parentElement;
      while (row && row.style.minHeight !== "62px") row = row.parentElement;
      if (!row) return null;
      const rowBounds = row.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      return rowBounds.right - buttonBounds.right;
    });
    expect(actionInset).not.toBeNull();
    expect(actionInset ?? 0).toBeGreaterThanOrEqual(8);
    await lastTrigger.click();
    await expect(menu).toBeVisible();
    await assertMenuCentersHitSafe(page, menu);
    await page.mouse.click(8, 8);
    await expect(menu).toBeHidden();
    expect(fixture.unhandled).toEqual([]);
  });

  test("narrow viewport contains table scrolling and keeps status, search, and floor filters usable", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) !== 390, "Narrow-scroll journey runs at its fixed 390px viewport.");
    const fixture = await installFacilitiesFixture(page, createFacilitiesFixture("long"));
    await openVenuesTable(page);
    await expect(page.getByText("Showing 1–5 of 12", { exact: true })).toBeVisible();
    await stabilizeVisualPage(page);

    const before = await tableFrameMetrics(page);
    expect(before.frameScrollWidth).toBeGreaterThan(before.frameClientWidth);
    expect(before.documentWidth).toBeLessThanOrEqual(before.viewportWidth + 1);
    const frame = page.locator('div[class*="tableFrame"]').first();
    await frame.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect.poll(() => frame.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    const search = page.getByRole("textbox", { name: "Search venues", exact: true });
    await search.fill("Venue 07");
    await expect(page.getByRole("button", { name: `More actions for Venue 07` })).toBeVisible();
    await expect(page.getByRole("button", { name: `More actions for ${FIRST_VENUE}` })).toHaveCount(0);
    await search.fill("");

    await page.getByRole("button", { name: "Filter venues by status: All statuses" }).click();
    await page.getByRole("menuitem", { name: "Maintenance", exact: true }).click();
    await expect(page.getByRole("button", { name: "More actions for Venue 07" })).toBeVisible();
    await expect(page.getByRole("button", { name: `More actions for ${FIRST_VENUE}` })).toHaveCount(0);

    await page.getByRole("button", { name: "Filter venues by floor: Floor 1" }).click();
    await page.getByRole("menuitem", { name: "Floor 2", exact: true }).click();
    await expect(page.getByText("No venues found", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Filter venues by floor: Floor 2" }).click();
    await page.getByRole("menuitem", { name: "Floor 1", exact: true }).click();
    await expect(page.getByRole("button", { name: "More actions for Venue 07" })).toBeVisible();

    const audit = await auditConventionalLayout(page);
    expect(audit.horizontalOverflow).toBe(false);
    expect(fixture.unhandled).toEqual([]);
  });

  test("loading, empty, and failed reads expose the intended recovery states", async ({ page }) => {
    const fixture = await installFacilitiesFixture(page, createFacilitiesFixture("loading"));
    await openVenuesTable(page);
    await expect(page.getByLabel("Loading venues")).toBeVisible();
    fixture.releaseLoading();
    await expect(page.getByText("Showing 1–3 of 3", { exact: true })).toBeVisible();

    fixture.mode = "empty";
    await page.reload();
    await page.getByRole("button", { name: "Venues", exact: true }).first().click();
    await expect(page.getByText("No venues found", { exact: true })).toBeVisible();
    await expect(
      page.locator('div[class*="tableFrame"]').first().getByRole("button", {
        name: "Add venue",
        exact: true,
      }),
    ).toHaveCount(1);

    fixture.mode = "error";
    await page.reload();
    await page.getByRole("button", { name: "Venues", exact: true }).first().click();
    await expect(page.getByText("Unable to load venues", { exact: true })).toBeVisible();
    fixture.enableRetry();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("Showing 1–3 of 3", { exact: true })).toBeVisible();
    expect(fixture.unhandled).toEqual([]);
  });

  test("gallery, read-only history, and saved venue placement retain one venue record", async ({ page }) => {
    const fixtureSetup = createFacilitiesFixture("long");
    fixtureSetup.retainHiddenVenueAtPlacementDestination = true;
    const fixture = await installFacilitiesFixture(page, fixtureSetup);
    await openVenuesTable(page);

    const firstActions = page.getByRole("button", {
      name: `More actions for ${FIRST_VENUE}`,
    });
    await firstActions.click();
    await page.getByRole("menuitem", { name: "Edit venue", exact: true }).click();
    const venueEditor = page.getByRole("dialog", { name: "Edit Venue", exact: true });
    await expect(venueEditor).toBeVisible();
    const galleryTiles = venueEditor.getByAltText(/^Venue image \d+$/);
    await expect(galleryTiles).toHaveCount(3);
    await galleryTiles.nth(2).dragTo(galleryTiles.nth(0));
    await expect(venueEditor.getByAltText("Venue image 1", { exact: true }))
      .toHaveAttribute("src", /detail-two/);
    await expect(
      venueEditor.getByRole("button", {
        name: "Move Venue image image 1 earlier",
        exact: true,
      }),
    ).toBeDisabled();
    await venueEditor.getByRole("button", {
      name: "Move Venue image image 2 later",
      exact: true,
    }).click();
    await venueEditor.getByRole("button", { name: "NEXT: PLACEMENT", exact: true }).click();
    await venueEditor.getByRole("button", { name: "SAVE VENUE", exact: true }).click();
    await expect.poll(
      () => fixture.venuePatches.some((patch) => patch.id === FIRST_VENUE_ID),
    ).toBe(true);
    await expect(venueEditor).toBeHidden();

    await firstActions.click();
    await page.getByRole("menuitem", { name: "Edit venue", exact: true }).click();
    await expect(venueEditor.getByAltText("Venue image 1", { exact: true }))
      .toHaveAttribute("src", /detail-two/);
    await page.getByRole("button", { name: "Close venue editor", exact: true }).click();

    await firstActions.click();
    await page.getByRole("menuitem", { name: "View details", exact: true }).click();
    const venueDetails = page.getByRole("dialog", { name: FIRST_VENUE, exact: true });
    await expect(venueDetails).toBeVisible();
    await expect(venueDetails.locator("textarea")).toHaveCount(0);
    await venueDetails.getByRole("button", { name: "View all feedback", exact: true }).click();
    await expect(venueDetails.getByText("All venue feedback", { exact: true })).toBeVisible();
    await expect(venueDetails.getByText("Feedback Member 10", { exact: true })).toBeVisible();
    await venueDetails.getByRole("button", { name: "Load more feedback", exact: true }).click();
    await expect(venueDetails.getByText("Feedback Member 12", { exact: true })).toBeVisible();
    await expect(venueDetails.getByText("No written comment.", { exact: true })).toBeVisible();
    await venueDetails.getByRole("button", { name: "Back to venue details", exact: true }).click();
    await expect(venueDetails.getByRole("button", { name: "View all feedback", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close venue details", exact: true }).click();

    const patchCountBeforeUnmap = fixture.venuePatches.length;
    await firstActions.click();
    await page.getByRole("menuitem", { name: "Remove from map", exact: true }).click();
    const removalDialog = page.getByRole("dialog", { name: "Remove venue from map", exact: true });
    await expect(removalDialog).toBeVisible();
    await removalDialog.getByRole("button", { name: "REMOVE FROM MAP", exact: true }).click();
    await expect.poll(() => fixture.venuePatches.length).toBeGreaterThan(patchCountBeforeUnmap);
    const unmapPatch = fixture.venuePatches
      .slice(patchCountBeforeUnmap)
      .find((patch) => patch.id === FIRST_VENUE_ID && patch.body.is_mapped === false);
    expect(unmapPatch).toBeDefined();

    await page.reload();
    await page.getByRole("button", { name: "Venues", exact: true }).first().click();
    await expect(page.getByText("Not on map", { exact: true }).first()).toBeVisible();
    await firstActions.click();
    await page.getByRole("menuitem", { name: "View details", exact: true }).click();
    await expect(page.getByRole("button", { name: "NOT ON MAP", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Close venue details", exact: true }).click();

    await page.getByRole("button", { name: "Layout", exact: true }).click();
    await page.getByRole("button", { name: "Edit layout", exact: true }).click();
    await expect(page.getByRole("button", { name: "Path Paint", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paths", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Venues", exact: true }).last().click();
    const placeSavedVenue = page.getByRole("button", {
      name: `Place saved venue ${FIRST_VENUE}`,
      exact: true,
    });
    await expect(placeSavedVenue).toBeEnabled();
    await placeSavedVenue.click();
    const cancelPlacement = page.getByRole("button", {
      name: `Cancel placement for ${FIRST_VENUE}`,
      exact: true,
    });
    await expect(cancelPlacement).toBeVisible();
    await page.getByRole("button", { name: "Venues", exact: true }).first().click();
    await page.getByRole("button", { name: "Layout", exact: true }).click();
    await page.getByRole("button", { name: "Venues", exact: true }).last().click();
    await expect(cancelPlacement).toHaveCount(0);
    await placeSavedVenue.click();
    await expect(cancelPlacement).toBeVisible();

    const patchCountBeforeInvalidPlacement = fixture.venuePatches.length;
    const invalidPoint = await getFacilitiesCanvasCellPoint(page, 500, 500);
    await page.mouse.click(invalidPoint.x, invalidPoint.y);
    await expect(cancelPlacement).toBeVisible();
    expect(fixture.venuePatches).toHaveLength(patchCountBeforeInvalidPlacement);

    const validPoint = await getFacilitiesCanvasCellPoint(page, 494, 502);
    await page.mouse.click(validPoint.x, validPoint.y);
    await expect.poll(() =>
      fixture.venuePatches.find((patch, index) =>
        index >= patchCountBeforeInvalidPlacement &&
        patch.id === FIRST_VENUE_ID &&
        patch.body.is_mapped === true,
      ),
    ).toBeTruthy();
    const remapPatch = fixture.venuePatches.find(
      (patch, index) =>
        index >= patchCountBeforeInvalidPlacement &&
        patch.id === FIRST_VENUE_ID &&
        patch.body.is_mapped === true,
    );
    expect(remapPatch?.id).toBe(unmapPatch?.id);
    await expect(
      page.getByRole("button", {
        name: "Place saved venue Venue 02",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      fixture.venuePatches.some(
        (patch) => patch.id === RETAINED_HIDDEN_VENUE_ID,
      ),
    ).toBe(false);
    expect(
      fixture.observed.some((request) =>
        new RegExp(
          `^(POST|DELETE) /v1/bookings/amenities/${FIRST_VENUE_ID}$`,
        ).test(request),
      ),
    ).toBe(false);
    expect(fixture.unhandled).toEqual([]);
  });
});
