import { getVisualReference } from "./visual/reference-manifest";
import { expectVisualMatch } from "./visual/expect-visual-match";
import { auditConventionalLayout, stabilizeVisualPage } from "./visual-stabilizer";
import { expect, test } from "./visual-fixtures";

const visualCase = getVisualReference("admin-schedule-desktop");

test.describe("route visual smoke · admin desktop", () => {
  test.use({
    visualRole: "admin",
    visualSurface: "web",
    visualViewport: visualCase.viewport,
  });

  test(`matches ${visualCase.expectedState}`, async ({ authenticatedPage }, testInfo) => {
    test.skip(
      testInfo.project.name !== visualCase.viewport,
      `This case is scoped to ${visualCase.viewport}.`,
    );

    const page = authenticatedPage;
    await page.goto(visualCase.route);
    await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
    await expect(page.getByText("Schedule", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Appointments", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    const masks = await stabilizeVisualPage(page, visualCase.maskSelectors);
    const audit = await auditConventionalLayout(page);

    await expectVisualMatch({
      page,
      testInfo,
      visualCase,
      masks,
      layoutAudit: audit,
    });

    expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
    expect(audit.squishedText, "squished text").toEqual([]);
    expect(audit.clipping, "clipped text or controls").toEqual([]);
    expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
    expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
    expect(audit.awkwardProportions, "awkward interactive proportions").toEqual([]);
  });
});
