import { getVisualReference } from "./visual/reference-manifest";
import { expectVisualMatch } from "./visual/expect-visual-match";
import {
  auditConventionalLayout,
  getVolatileTextMasks,
  stabilizeVisualPage,
} from "./visual-stabilizer";
import { expect, test } from "./visual-fixtures";

const visualCase = getVisualReference("member-home-mobile");

test.describe("route visual smoke · member mobile", () => {
  test.use({
    visualRole: "member",
    visualSurface: "mobile",
    visualViewport: visualCase.viewport,
    visualSeedScenario: visualCase.seedScenario,
  });

  test(`matches ${visualCase.expectedState}`, async ({ authenticatedPage }, testInfo) => {
    test.skip(
      testInfo.project.name !== visualCase.viewport,
      `This case is scoped to ${visualCase.viewport}.`,
    );

    const page = authenticatedPage;
    await page.goto(new URL(visualCase.route, page.url()).toString());
    await expect(page).toHaveURL(/\/home(?:\?|$)/);
    await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });

    const masks = [
      ...(await stabilizeVisualPage(page, visualCase.maskSelectors)),
      ...getVolatileTextMasks(page, visualCase.maskTextPatterns),
    ];
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
