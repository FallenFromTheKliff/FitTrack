import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL = "http://127.0.0.1:8081";
const FIXED_NOW = Date.parse("2026-09-08T08:00:00.000Z");
const TODAY = "2026-09-08";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const TDEE_ID = "tdee-nutrition-touch-fixture";
const MACRO_ID = "macro-nutrition-touch-fixture";
const HISTORY_TDEE_ID = "tdee-nutrition-touch-history-fixture";

type NutritionFixtureState = {
  consoleErrors: string[];
  mutations: Array<{ method: string; path: string; body: unknown }>;
  observedRequests: string[];
  unhandled: string[];
};

function newFixtureState(): NutritionFixtureState {
  return {
    consoleErrors: [],
    mutations: [],
    observedRequests: [],
    unhandled: [],
  };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    status,
  });
}

async function fulfillPaginated(
  route: Route,
  records: unknown[],
  meta: { page: number; limit: number; total: number; total_pages: number },
) {
  await route.fulfill({
    body: JSON.stringify({ data: records, meta }),
    contentType: "application/json",
    status: 200,
  });
}

function memberProfile() {
  return {
    email: "nutrition-touch-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: MEMBER_ID,
    membership_card: {
      activated_at: "2026-09-01T00:00:00.000Z",
      purchased_at: "2026-09-01T00:00:00.000Z",
      source: "fixture",
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    },
    phone_no: "+639171234567",
    profile: {
      activity_level: "moderate",
      date_of_birth: "1994-05-20",
      first_name: "Nutrition",
      gender: "female",
      height_cm: 165,
      last_name: "Touch",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

function tdeeRecord(id: string, calculatedAt: string, tdeeCalories: number) {
  return {
    activity_level: "moderate",
    age: 32,
    bmr_calories: 1400,
    calculated_at: calculatedAt,
    created_at: calculatedAt,
    fitness_goal: "maintenance",
    gender: "female",
    height_cm: 165,
    id,
    is_active: id === TDEE_ID,
    tdee_calories: tdeeCalories,
    updated_at: calculatedAt,
    user_id: MEMBER_ID,
    weight_kg: 60,
  };
}

function macroTarget() {
  return {
    carbs_g: 250,
    created_at: "2026-09-08T00:00:00.000Z",
    fat_g: 67,
    id: MACRO_ID,
    is_active: true,
    protein_g: 125,
    target_calories: 2000,
    tdee_profile_id: TDEE_ID,
    updated_at: "2026-09-08T00:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function nutritionLog(index: number, mealName: string, foodItem: string) {
  return {
    calories: 120 + index * 35,
    carbs_g: 14 + index * 3,
    created_at: `2026-09-08T0${8 + index}:00:00.000Z`,
    fat_g: 5 + index,
    food_item: foodItem,
    icon: { asset_key: null, key: "utensils", kind: "library" },
    id: `nutrition-log-touch-${index}`,
    log_date: TODAY,
    macro_target_id: MACRO_ID,
    meal_name: mealName,
    protein_g: 10 + index * 2,
    quantity: 1,
    unit: "serving",
    updated_at: `2026-09-08T0${8 + index}:00:00.000Z`,
    user_id: MEMBER_ID,
  };
}

function todayLogs() {
  return [
    nutritionLog(0, "Breakfast", "Greek yogurt and berries"),
    nutritionLog(1, "Breakfast", "Whole grain toast"),
    nutritionLog(2, "Lunch", "Chicken rice bowl"),
    nutritionLog(3, "Lunch", "Avocado salad"),
    nutritionLog(4, "Dinner", "Salmon and vegetables"),
    nutritionLog(5, "Dinner", "Roasted potatoes"),
    nutritionLog(6, "Snacks", "Protein smoothie"),
    nutritionLog(7, "Snacks", "Apple with peanut butter"),
  ];
}

async function installNutritionFixtures(page: Page, state: NutritionFixtureState) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/v1/")) {
      state.observedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await page.addInitScript((fixedBaseMs) => {
    const nativeDateNow = Date.now.bind(Date);
    const nativeStartMs = nativeDateNow();
    window.localStorage.setItem("fittrack_access_token", "nutrition-touch-access-token");
    window.localStorage.setItem("fittrack_refresh_token", "nutrition-touch-refresh-token");
    Date.now = () => fixedBaseMs + (nativeDateNow() - nativeStartMs);
  }, FIXED_NOW);

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    if (method !== "GET") state.mutations.push({ body, method, path });

    if (method === "GET" && path === "/v1/users/me") {
      await fulfill(route, memberProfile());
      return;
    }
    if (method === "GET" && path === "/v1/users/deletion-request") {
      await fulfill(route, { status: null });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await fulfillPaginated(route, [], {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 10),
        total: 0,
        total_pages: 0,
      });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/membership/my-subscription") {
      await fulfill(route, {
        id: "membership-nutrition-touch-fixture",
        plan: { name: "Fitness Access" },
        status: "active",
      });
      return;
    }

    if (method === "GET" && path === "/v1/nutrition/tdee") {
      await fulfill(route, {
        macros: macroTarget(),
        tdee: tdeeRecord(TDEE_ID, "2026-09-08T00:00:00.000Z", 2000),
      });
      return;
    }
    if (method === "GET" && path === "/v1/nutrition/tdee/history") {
      await fulfillPaginated(
        route,
        [
          tdeeRecord(TDEE_ID, "2026-09-08T00:00:00.000Z", 2000),
          tdeeRecord(HISTORY_TDEE_ID, "2026-08-08T00:00:00.000Z", 1950),
        ],
        {
          page: Number(url.searchParams.get("page") ?? 1),
          limit: Number(url.searchParams.get("limit") ?? 4),
          total: 2,
          total_pages: 1,
        },
      );
      return;
    }
    if (method === "GET" && path === "/v1/nutrition/daily-summary") {
      await fulfill(route, {
        coaching: [
          {
            id: "nutrition-touch-insight",
            message: "A steady meal rhythm supports your target.",
            priority: "info",
            reason_codes: [],
            source: "nutrition_summary",
            title: "Keep the rhythm",
          },
        ],
        date: url.searchParams.get("date") ?? TODAY,
        logged: { calories: 1030, carbs_g: 130, fat_g: 35, protein_g: 70 },
        macro_target_id: MACRO_ID,
        remaining: { calories: 970, carbs_g: 120, fat_g: 32, protein_g: 55 },
        target: { calories: 2000, carbs_g: 250, fat_g: 67, protein_g: 125 },
      });
      return;
    }
    if (method === "GET" && path === "/v1/nutrition/logs") {
      await fulfillPaginated(route, todayLogs(), {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 100),
        total: todayLogs().length,
        total_pages: 1,
      });
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function dismissAutomaticHelp(page: Page) {
  const helpTitle = page.getByText("Help - Nutrition", { exact: true });
  try {
    await helpTitle.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    return;
  }
  const closeHelp = page.getByRole("button", { name: "Close help", exact: true });
  await expect(closeHelp).toBeVisible();
  await closeHelp.tap();
  await expect(helpTitle).toBeHidden();
}

async function enterNutrition(page: Page, state: NutritionFixtureState) {
  await page.goto(`${MOBILE_BASE_URL}/nutrition`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/nutrition(?:\?|$)/);
  await expect(page.getByText("Nutrition", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("TODAY'S CALORIES", { exact: true })).toBeVisible({ timeout: 20_000 });
  await dismissAutomaticHelp(page);
  await stabilizeVisualPage(page);
  expect(state.unhandled, "nutrition fixture requests before interaction").toEqual([]);
}

async function tapHeaderMenu(page: Page) {
  const candidates = page.locator("button, [role='button'], [tabindex='0']");
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const box = await candidate.boundingBox();
    if (
      box &&
      box.x < 96 &&
      box.y < 96 &&
      box.width > 20 &&
      box.width <= 96 &&
      box.height > 20 &&
      box.height <= 96
    ) {
      await candidate.tap();
      return;
    }
  }
  throw new Error("Could not find the rendered header hamburger press target.");
}

async function openFab(page: Page) {
  const open = page.getByRole("button", { name: "Open quick actions menu", exact: true });
  await expect(open).toBeVisible();
  await open.tap();
  await expect(page.getByRole("button", { name: "Close quick actions menu", exact: true })).toBeVisible();
}

async function readScrollMetrics(scroll: ReturnType<Page["getByTestId"]>) {
  return scroll.evaluate((element) => {
    const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
    const scrollable = nodes.find((node) => node.scrollHeight > node.clientHeight + 4);
    const target = scrollable ?? element;
    return {
      clientHeight: target.clientHeight,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
    };
  });
}

async function waitForScrollToSettle(scroll: ReturnType<Page["getByTestId"]>) {
  let previousScrollTop = Number.NaN;
  let stablePolls = 0;
  await expect
    .poll(
      async () => {
        const currentScrollTop = await scroll.evaluate(
          (element) =>
            new Promise<number>((resolve) => {
              requestAnimationFrame(() => {
                const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
                const scrollable = nodes.find((node) => node.scrollHeight > node.clientHeight + 4);
                resolve((scrollable ?? element).scrollTop);
              });
            }),
        );
        stablePolls = currentScrollTop === previousScrollTop ? stablePolls + 1 : 0;
        previousScrollTop = currentScrollTop;
        return stablePolls;
      },
      { intervals: [50, 100, 200], timeout: 3_000 },
    )
    .toBeGreaterThanOrEqual(2);
}

async function swipeNutritionContent(page: Page, scroll: ReturnType<Page["getByTestId"]>) {
  const box = await scroll.boundingBox();
  expect(box, "nutrition scroll bounds").not.toBeNull();
  if (!box) return;
  const startX = box.x + box.width / 2;
  const startY = box.y + Math.min(260, Math.max(80, box.height - 40));
  const endY = Math.max(box.y + 24, startY - 360);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    const progress = step / 12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: startX, y: startY + (endY - startY) * progress }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: NutritionFixtureState,
  name: string,
) {
  const audit = await auditConventionalLayout(page);
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "nutrition-touch");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const evidence = {
    audit,
    mutations: state.mutations,
    observedRequests: state.observedRequests,
    route: await page.url(),
    unhandled: state.unhandled,
  };
  await writeFile(resolve(evidenceRoot, `${safeName}.layout.json`), JSON.stringify(evidence, null, 2));
  await testInfo.attach(`${name}-layout.json`, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    fullPage: true,
    path: resolve(evidenceRoot, `${safeName}.png`),
  });
  return audit;
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.squishedText, "squished text").toEqual([]);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

function assertNoUnexpectedRequests(state: NutritionFixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.mutations, "nutrition touch journey should not write to the API").toEqual([]);
}

async function assertNutritionModalGeometry(page: Page, requireScrollableBody = false) {
  const viewport = page.viewportSize();
  expect(viewport, "NutritionLog viewport").not.toBeNull();

  const card = page.getByTestId("nutrition-log-modal-card");
  const header = page.getByTestId("nutrition-log-modal-header");
  const body = page.getByTestId("nutrition-log-modal-scroll");
  const footer = page.getByTestId("nutrition-log-modal-footer");
  await expect(card).toBeVisible();
  await expect(header).toBeVisible();
  await expect(body).toBeVisible();
  await expect(footer).toBeVisible();

  const [cardBox, headerBox, bodyBox, footerBox] = await Promise.all([
    card.boundingBox(),
    header.boundingBox(),
    body.boundingBox(),
    footer.boundingBox(),
  ]);
  expect(cardBox, "NutritionLog card bounds").not.toBeNull();
  expect(headerBox, "NutritionLog header bounds").not.toBeNull();
  expect(bodyBox, "NutritionLog body bounds").not.toBeNull();
  expect(footerBox, "NutritionLog footer bounds").not.toBeNull();
  if (viewport && cardBox && headerBox && bodyBox && footerBox) {
    for (const [name, box] of [
      ["card", cardBox],
      ["header", headerBox],
      ["body", bodyBox],
      ["footer", footerBox],
    ] as const) {
      expect(box.width, `${name} width`).toBeGreaterThan(1);
      expect(box.height, `${name} height`).toBeGreaterThan(1);
      expect(box.x, `${name} left edge`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y, `${name} top edge`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
    }
  }

  const bodyMetrics = await body.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(bodyMetrics.clientHeight, "NutritionLog body client height").toBeGreaterThan(1);
  expect(bodyMetrics.clientWidth, "NutritionLog body client width").toBeGreaterThan(1);
  expect(bodyMetrics.scrollWidth, "NutritionLog body horizontal content").toBeLessThanOrEqual(
    bodyMetrics.clientWidth + 1,
  );
  expect(["auto", "scroll"], "NutritionLog body vertical overflow").toContain(bodyMetrics.overflowY);
  expect(bodyMetrics.overflowX, "NutritionLog body horizontal overflow").not.toBe("scroll");
  if (requireScrollableBody) {
    expect(bodyMetrics.scrollHeight, "NutritionLog form should scroll").toBeGreaterThan(
      bodyMetrics.clientHeight + 4,
    );
  }
}

test.describe("nutrition touch · core interaction", () => {
  test("header help, notifications, and hamburger remain tappable after automatic Help closes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installNutritionFixtures(page, state);
    await enterNutrition(page, state);

    await openFab(page);
    const helpTitle = page.getByText("Help - Nutrition", { exact: true });
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open page help", exact: true }).tap();
    await expect(page.getByText("Help - Nutrition", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close help", exact: true }).tap();
    await expect(page.getByText("Help - Nutrition", { exact: true })).toBeHidden();

    await openFab(page);
    await page.getByRole("button", { name: "Open notifications", exact: true }).tap();
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeVisible();
    await expect(page.getByText("All caught up", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    const notificationClose = page.getByRole("button", { name: "Close", exact: true });
    await expect(notificationClose).toBeVisible();
    await notificationClose.tap();
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeHidden();

    await openFab(page);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Nutrition", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeHidden();

    const audit = await captureEvidence(page, testInfo, state, "header-actions-390");
    assertCleanLayout(audit);
    assertNoUnexpectedRequests(state);
  });

  test("content swipe closes the open Nutrition FAB and scrolls in the same gesture", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installNutritionFixtures(page, state);
    await enterNutrition(page, state);

    const scroll = page.getByTestId("nutrition-scroll");
    await expect(scroll).toBeVisible();
    const initialMetrics = await readScrollMetrics(scroll);
    expect(initialMetrics.scrollHeight, "nutrition content should be scrollable").toBeGreaterThan(initialMetrics.clientHeight + 4);

    await openFab(page);
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toBeVisible();
    await captureEvidence(page, testInfo, state, "fab-open-390");

    await swipeNutritionContent(page, scroll);
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    await expect.poll(async () => (await readScrollMetrics(scroll)).scrollTop).toBeGreaterThan(initialMetrics.scrollTop);
    const lowerContent = page.getByText("Today's Nutrition Log", { exact: true });
    for (let swipe = 0; swipe < 4 && !(await lowerContent.isVisible()); swipe += 1) {
      await swipeNutritionContent(page, scroll);
    }
    await expect(lowerContent).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, "content-swipe-390");
    assertCleanLayout(audit);
    assertNoUnexpectedRequests(state);
  });

  test("responsive Nutrition layout stays readable at 320, 390, and 430 pixels", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installNutritionFixtures(page, state);
    await enterNutrition(page, state);
    await expect(page.getByText("Target Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Macro Breakdown", { exact: true })).toBeVisible();
    await expect(page.getByText("Today's Nutrition Log", { exact: true })).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, `responsive-${testInfo.project.name}`);
    assertCleanLayout(audit);
    assertNoUnexpectedRequests(state);
  });
});

test.describe("nutrition touch · lifecycle and menu", () => {
  test("FAB actions open and close the nutrition target and meal modals", async ({ page }, testInfo) => {
    test.skip(!["mobile-320x568", "mobile-390x844"].includes(testInfo.project.name));
    const state = newFixtureState();
    await installNutritionFixtures(page, state);
    await enterNutrition(page, state);

    await openFab(page);
    await page.getByRole("button", { name: "Target. Update calories", exact: true }).tap();
    await expect(page).toHaveURL(/\/nutrition(?:\?|$)/);
    await expect(page.getByText("Set Nutrition Target", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).tap();
    await expect(page.getByText("Set Nutrition Target", { exact: true })).toBeHidden();

    await openFab(page);
    await page.getByRole("button", { name: "Log Meal. Add today's food", exact: true }).tap();
    await expect(page).toHaveURL(/\/nutrition(?:\?|$)/);
    await expect(page.getByText("Log Meal", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search previous meals", exact: true })).toBeVisible();
    await assertNutritionModalGeometry(page);
    const nutritionScroll = page.getByTestId("nutrition-log-modal-scroll");
    const choiceAudit = await captureEvidence(
      page,
      testInfo,
      state,
      `modal-choice-${testInfo.project.name}`,
    );
    assertCleanLayout(choiceAudit);
    await page.getByRole("button", { name: "Cancel", exact: true }).tap();
    await expect(page.getByText("Log Meal", { exact: true })).toBeHidden();

    await openFab(page);
    await page.getByRole("button", { name: "Log Meal. Add today's food", exact: true }).tap();
    await page.getByRole("button", { name: "New Log Meal", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Meal type: not selected", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Food item", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Calories", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Portion quantity", exact: true })).toBeVisible();

    await assertNutritionModalGeometry(page, true);
    const formAudit = await captureEvidence(
      page,
      testInfo,
      state,
      `modal-form-${testInfo.project.name}`,
    );
    assertCleanLayout(formAudit);
    const initialMetrics = await readScrollMetrics(nutritionScroll);
    await swipeNutritionContent(page, nutritionScroll);
    await expect
      .poll(async () => (await readScrollMetrics(nutritionScroll)).scrollTop)
      .toBeGreaterThan(initialMetrics.scrollTop);
    await waitForScrollToSettle(nutritionScroll);
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Save Log", exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Back", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Cancel", exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).last().tap();
    await expect(page.getByText("Log Meal", { exact: true })).toBeHidden();

    const audit = await captureEvidence(page, testInfo, state, `fab-actions-${testInfo.project.name}`);
    assertCleanLayout(audit);
    assertNoUnexpectedRequests(state);
  });

  test("navigation away and return to Nutrition starts with the FAB closed", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installNutritionFixtures(page, state);
    await enterNutrition(page, state);

    await openFab(page);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Nutrition", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nutrition", exact: true }).tap();
    await expect(page).toHaveURL(/\/nutrition(?:\?|$)/);
    await dismissAutomaticHelp(page);
    await expect(page.getByRole("button", { name: "Open quick actions menu", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Target. Update calories", exact: true })).toHaveCount(0);
    await expect(page.getByText("Today's Nutrition Log", { exact: true })).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, "navigate-back-390");
    assertCleanLayout(audit);
    assertNoUnexpectedRequests(state);
  });
});
