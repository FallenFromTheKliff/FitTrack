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
    visualSeedScenario: visualCase.seedScenario,
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

  test("preserves appointment search and uses reservable operational venues", async ({
    authenticatedPage,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== visualCase.viewport,
      `This case is scoped to ${visualCase.viewport}.`,
    );

    const page = authenticatedPage;
    const operationsRequestPaths: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.includes("/bookings/amenities/operations")) {
        operationsRequestPaths.push(pathname);
      }
    });
    const scopedResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.includes(
          "/bookings/amenities/operations/reservable",
        ),
      { timeout: 20_000 },
    );

    await page.goto(visualCase.route);
    await expect(page).toHaveURL(/\/schedule(?:\?|$)/);

    const scopedResponse = await scopedResponsePromise;
    expect(scopedResponse.ok(), await scopedResponse.text()).toBe(true);
    const payload = (await scopedResponse.json()) as unknown;
    const envelope = payload as { data?: unknown };
    const rawRecords = Array.isArray(payload)
      ? payload
      : Array.isArray(envelope.data)
        ? envelope.data
        : [];
    const records = rawRecords as Array<{
      is_active?: unknown;
      is_mapped?: unknown;
      is_reservable?: unknown;
      name?: unknown;
      status?: unknown;
    }>;

    expect(records.length).toBeGreaterThan(0);
    expect(
      records.every(
        (record) =>
          record.is_active === true &&
          record.is_mapped === true &&
          record.is_reservable === true,
      ),
    ).toBe(true);
    expect(
      records.some(
        (record) =>
          typeof record.name === "string" &&
          /basketball|boxing|studio/i.test(record.name),
      ),
    ).toBe(true);
    expect(
      records.some(
        (record) =>
          typeof record.name === "string" &&
          /^(general floor|reception)$/i.test(record.name),
      ),
    ).toBe(false);

    expect(
      operationsRequestPaths.some((pathname) =>
        /\/bookings\/amenities\/operations\/?$/.test(pathname),
      ),
    ).toBe(false);

    await page.getByRole("tab", { name: "Appointments", exact: true }).click();
    const appointmentPanel = page.locator(
      '[data-ui="gym-operations-appointments-panel"]',
    );
    await expect(appointmentPanel).toBeVisible();
    const appointmentSearch = page.getByLabel("Search appointment members");
    await expect(appointmentSearch).toBeVisible();
    const reviewActions = appointmentPanel.locator(
      '[data-ui="gym-operations-review-appointment"]',
    );
    await expect
      .poll(() => reviewActions.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    await appointmentSearch.fill("__no_appointment_member_match_20260911__");
    await expect(
      page.getByText("No coach appointments match the current filters.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });

    await appointmentSearch.fill("");
    await expect(
      page.getByText("No coach appointments match the current filters.", {
        exact: true,
      }),
    ).toBeHidden({ timeout: 20_000 });
    await expect
      .poll(() => reviewActions.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    await page.getByRole("tab", { name: "Schedule", exact: true }).click();
    await page
      .getByRole("tab", { name: "Venue Bookings", exact: true })
      .click();
    const venueFilter = page.getByLabel(/Venue filter:/);
    await expect(venueFilter).toBeVisible();
    await venueFilter.click();
    const venueItems = page.getByRole("menuitem");
    await expect
      .poll(() => venueItems.count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    const venueLabels = (await venueItems.allTextContents()).map((label) =>
      label.trim(),
    );
    expect(
      venueLabels.some((label) => /basketball|boxing|studio/i.test(label)),
    ).toBe(true);
    expect(
      venueLabels.some((label) => /^(general floor|reception)$/i.test(label)),
    ).toBe(false);

    const maintenanceNames = records
      .filter(
        (record) =>
          typeof record.name === "string" &&
          String(record.status ?? "").toLowerCase() === "maintenance",
      )
      .map((record) => String(record.name));
    for (const maintenanceName of maintenanceNames) {
      expect(venueLabels).toContain(maintenanceName);
    }
  });
});

test.describe("Gym Operations month-calendar legend", () => {
  test.use({
    visualRole: "admin",
    visualSurface: "web",
    visualViewport: visualCase.viewport,
    visualSeedScenario: visualCase.seedScenario,
  });

  test("keeps the legend after navigation and aligned in the desktop header", async ({ authenticatedPage }, testInfo) => {
    test.skip(
      testInfo.project.name !== visualCase.viewport,
      `This case is scoped to ${visualCase.viewport}.`,
    );

    const page = authenticatedPage;
    await page.goto(visualCase.route);

    const calendar = page.locator('[data-ui="gym-operations-month-calendar"]');
    const header = calendar.locator(
      '[data-ui="gym-operations-month-calendar-header"]',
    );
    const navigation = header.locator(
      '[data-ui="gym-operations-calendar-navigation"]',
    );
    const legend = header.locator(
      '[data-ui="gym-operations-calendar-legend"]',
    );

    await expect(calendar).toBeVisible();
    await expect(legend).toHaveAttribute("role", "list");
    await expect(legend.getByRole("listitem")).toHaveCount(3);
    await expect(
      legend.getByRole("listitem", { name: "Confirmed: scheduled" }),
    ).toBeVisible();
    await expect(
      legend.getByRole("listitem", { name: "Completed / pending: neutral" }),
    ).toBeVisible();
    await expect(
      legend.getByRole("listitem", { name: "Cancelled / no-show: attention" }),
    ).toBeVisible();

    const [headerBox, navigationBox, legendBox] = await Promise.all([
      header.boundingBox(),
      navigation.boundingBox(),
      legend.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(legendBox).not.toBeNull();
    if (!headerBox || !navigationBox || !legendBox) return;

    expect(navigationBox.x).toBeGreaterThan(legendBox.x + legendBox.width);
    expect(navigationBox.x + navigationBox.width).toBeGreaterThan(
      headerBox.x + headerBox.width - 40,
    );
    expect(
      Math.abs(
        legendBox.y + legendBox.height / 2 -
          (navigationBox.y + navigationBox.height / 2),
      ),
    ).toBeLessThanOrEqual(2);
  });
});

test.describe("Gym Operations month-calendar legend · responsive", () => {
  const responsiveViewport = "mobile-320x844";

  test.use({
    visualRole: "admin",
    visualSurface: "web",
    visualViewport: responsiveViewport,
  });

  test("wraps within the calendar header without page overflow", async ({ authenticatedPage }, testInfo) => {
    test.skip(
      testInfo.project.name !== responsiveViewport,
      `This case is scoped to ${responsiveViewport}.`,
    );

    const page = authenticatedPage;
    await page.goto(visualCase.route);

    const calendar = page.locator('[data-ui="gym-operations-month-calendar"]');
    const header = calendar.locator(
      '[data-ui="gym-operations-month-calendar-header"]',
    );
    const legend = header.locator(
      '[data-ui="gym-operations-calendar-legend"]',
    );

    await expect(calendar).toBeVisible();
    await expect(legend).toBeVisible();
    const [viewportWidth, headerBox, legendBox] = await Promise.all([
      page.evaluate(() => window.innerWidth),
      header.boundingBox(),
      legend.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(legendBox).not.toBeNull();
    if (!headerBox || !legendBox) return;

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewportWidth + 1,
    );
    expect(legendBox.x).toBeGreaterThanOrEqual(headerBox.x - 1);
    expect(legendBox.x + legendBox.width).toBeLessThanOrEqual(
      headerBox.x + headerBox.width + 1,
    );
  });
});
