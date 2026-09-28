import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL = process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const ACCESS_TOKEN = "signout-fixture-access-token";
const REFRESH_TOKEN = "signout-fixture-refresh-token";
const MEMBER_ID = "signout-fixture-member";
const RETRYABLE_ERROR = "Couldn't sign you out. Please try again.";

type LogoutMode = "success" | "unauthorized" | "held";

type LogoutObservation = {
  hasAuthorization: boolean;
  hasRefreshToken: boolean;
  refreshMatchesSentinel: boolean;
};

type SignoutFixtureState = {
  consoleErrors: string[];
  holdReleaseRequested: boolean;
  holdResponseAttempted: boolean;
  holdStarted: boolean;
  logoutRequests: LogoutObservation[];
  mode: LogoutMode;
  observedRequests: string[];
  releaseHeldLogout?: () => void;
  refreshRequests: number;
  unhandled: string[];
};

function newFixtureState(mode: LogoutMode): SignoutFixtureState {
  return {
    consoleErrors: [],
    holdReleaseRequested: false,
    holdResponseAttempted: false,
    holdStarted: false,
    logoutRequests: [],
    mode,
    observedRequests: [],
    refreshRequests: 0,
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

function memberProfile() {
  return {
    email: "signout-fixture-member@fittrack.test",
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
      first_name: "Signout",
      gender: "female",
      height_cm: 165,
      last_name: "Member",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

async function installSignoutFixtures(page: Page, state: SignoutFixtureState) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.includes("/v1/")) return;
    const requestDescription = `${request.method()} ${url.pathname}${url.search}`;
    state.observedRequests.push(requestDescription);
    if (url.pathname === "/v1/auth/refresh") state.refreshRequests += 1;
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: Record<string, unknown> = {};
    if (request.postData()) {
      try {
        body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    if (method === "POST" && path === "/v1/auth/logout") {
      state.logoutRequests.push({
        hasAuthorization: Boolean(request.headers().authorization),
        hasRefreshToken: typeof body.refresh_token === "string" && body.refresh_token.length > 0,
        refreshMatchesSentinel: body.refresh_token === REFRESH_TOKEN,
      });
      if (state.mode === "held") {
        // Keep the mocked request pending until the client timeout completes and the
        // test has asserted local cleanup. This is a response gate, not a UI wait.
        await new Promise<void>((resolvePromise) => {
          state.holdStarted = true;
          state.releaseHeldLogout = () => {
            if (state.holdReleaseRequested) return;
            state.holdReleaseRequested = true;
            resolvePromise();
          };
        });
        try {
          await fulfill(route, {});
        } catch {
          // Axios has normally timed out and closed the request by this point.
        }
        state.holdResponseAttempted = true;
        return;
      }
      if (state.mode === "unauthorized") {
        await fulfill(route, { message: "expired" }, 401);
        return;
      }
      await fulfill(route, {});
      return;
    }

    if (method === "GET" && path === "/v1/users/me") {
      await fulfill(route, memberProfile());
      return;
    }
    if (method === "GET" && path === "/v1/users/deletion-request") {
      await fulfill(route, { status: null });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await route.fulfill({
        body: JSON.stringify({
          data: [],
          meta: { limit: 10, page: 1, total: 0, total_pages: 0 },
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function seedSessionOnce(page: Page) {
  await page.goto(`${MOBILE_BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ accessToken, refreshToken }) => {
    window.localStorage.setItem("fittrack_access_token", accessToken);
    window.localStorage.setItem("fittrack_refresh_token", refreshToken);
  }, { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN });
  await page.goto(`${MOBILE_BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
}

async function enterSettings(page: Page) {
  await seedSessionOnce(page);
  await expect(page).toHaveURL(/\/settings(?:\?|$)/);
  await expect(page.getByText("PREFERENCES", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Open page help", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await stabilizeVisualPage(page);
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

async function assertHitTarget(page: Page, target: Locator, label: string) {
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const viewport = page.viewportSize();
        if (!box || !viewport || box.width <= 0 || box.height <= 0) return false;
        if (
          box.x < 0 ||
          box.y < 0 ||
          box.x + box.width > viewport.width ||
          box.y + box.height > viewport.height
        ) {
          return false;
        }
        return target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const topmost = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return Boolean(topmost && (topmost === element || element.contains(topmost)));
        });
      },
      { intervals: [50, 100, 250, 500], timeout: 5_000 },
    )
    .toBe(true);

  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${label} bounds`).not.toBeNull();
  expect(viewport, `${label} viewport`).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(180);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(viewport.height);
}

async function openSidebar(page: Page) {
  await tapHeaderMenu(page);
  const sidebarSignOut = page.getByRole("button", { name: "SIGN OUT", exact: true });
  await expect(sidebarSignOut).toBeVisible({ timeout: 5_000 });
  await assertHitTarget(page, sidebarSignOut, "sidebar SIGN OUT");
  return sidebarSignOut;
}

async function openLogoutConfirmation(page: Page, sidebarSignOut: Locator) {
  await sidebarSignOut.tap();
  const title = page.getByText("Logging out?", { exact: true });
  const confirm = page.getByRole("button", { name: "Sign Out", exact: true });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(title).toBeVisible({ timeout: 5_000 });
  await expect(confirm).toBeVisible();
  await expect(cancel).toBeVisible();
  await expect(sidebarSignOut).toBeHidden();
  return { cancel, confirm, title };
}

async function readSessionPresence(page: Page) {
  return page.evaluate(() => ({
    accessToken: Boolean(window.localStorage.getItem("fittrack_access_token")),
    refreshToken: Boolean(window.localStorage.getItem("fittrack_refresh_token")),
  }));
}

async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "signout");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = resolve(evidenceRoot, `${safeName}.png`);
  await page.screenshot({ fullPage: true, path });
  await testInfo.attach(`${name}.png`, { path, contentType: "image/png" });
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: SignoutFixtureState,
  name: string,
) {
  const audit = await auditConventionalLayout(page);
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "signout");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const evidence = {
    audit,
    consoleErrorCount: state.consoleErrors.length,
    logoutRequestCount: state.logoutRequests.length,
    observedRequests: state.observedRequests,
    refreshRequests: state.refreshRequests,
    route: await page.url(),
    unhandled: state.unhandled,
  };
  const json = JSON.stringify(evidence, null, 2);
  await writeFile(resolve(evidenceRoot, `${safeName}.layout.json`), json);
  await testInfo.attach(`${name}-layout.json`, {
    body: json,
    contentType: "application/json",
  });
  const screenshotPath = resolve(evidenceRoot, `${safeName}.png`);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach(`${name}.png`, { path: screenshotPath, contentType: "image/png" });
  return audit;
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.squishedText, "squished text").toEqual([]);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

function assertFixtureClosed(state: SignoutFixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.refreshRequests, "logout must not refresh an expired session").toBe(0);
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 10_000 });
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.describe("mobile signout · sidebar and confirmation", () => {
  test("footer is reachable, first tap opens, and cancel allows a clean reopen", async ({ page }, testInfo) => {
    const state = newFixtureState("success");
    await installSignoutFixtures(page, state);
    await enterSettings(page);

    const firstSidebarSignOut = await openSidebar(page);
    await captureScreenshot(page, testInfo, "sidebar-first-tap");
    const firstConfirmation = await openLogoutConfirmation(page, firstSidebarSignOut);
    await captureScreenshot(page, testInfo, "confirmation-first-tap");
    await firstConfirmation.cancel.tap();
    await expect(firstConfirmation.title).toBeHidden();
    await expect(page.getByText(RETRYABLE_ERROR, { exact: true })).toHaveCount(0);

    const reopenedSidebarSignOut = await openSidebar(page);
    const reopenedConfirmation = await openLogoutConfirmation(page, reopenedSidebarSignOut);
    await reopenedConfirmation.cancel.tap();
    await expect(reopenedConfirmation.title).toBeHidden();

    const audit = await captureEvidence(page, testInfo, state, `cancel-reopen-${testInfo.project.name}`);
    assertCleanLayout(audit);
    expect(state.logoutRequests).toEqual([]);
    assertFixtureClosed(state);
  });

  test("successful signout clears both session values and protects reload and back navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState("success");
    await installSignoutFixtures(page, state);
    await enterSettings(page);

    await page.goto(`${MOBILE_BASE_URL}/settings?signoutHistory=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("PREFERENCES", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.goto(`${MOBILE_BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("PREFERENCES", { exact: true })).toBeVisible({ timeout: 20_000 });

    const sidebarSignOut = await openSidebar(page);
    const confirmation = await openLogoutConfirmation(page, sidebarSignOut);
    await confirmation.confirm.tap();
    await expectLoginScreen(page);

    expect(await readSessionPresence(page)).toEqual({ accessToken: false, refreshToken: false });
    expect(state.logoutRequests).toHaveLength(1);
    expect(state.logoutRequests[0]).toEqual({
      hasAuthorization: true,
      hasRefreshToken: true,
      refreshMatchesSentinel: true,
    });
    assertFixtureClosed(state);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectLoginScreen(page);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expectLoginScreen(page);

    const audit = await captureEvidence(page, testInfo, state, "success-login-390");
    assertCleanLayout(audit);
  });

  test("remote 401 clears local session without an auth refresh", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState("unauthorized");
    await installSignoutFixtures(page, state);
    await enterSettings(page);

    const sidebarSignOut = await openSidebar(page);
    const confirmation = await openLogoutConfirmation(page, sidebarSignOut);
    await confirmation.confirm.tap();
    await expectLoginScreen(page);

    expect(await readSessionPresence(page)).toEqual({ accessToken: false, refreshToken: false });
    expect(state.logoutRequests).toHaveLength(1);
    expect(state.logoutRequests[0].hasAuthorization).toBe(true);
    expect(state.logoutRequests[0].refreshMatchesSentinel).toBe(true);
    assertFixtureClosed(state);

    const audit = await captureEvidence(page, testInfo, state, "remote-401-login-390");
    assertCleanLayout(audit);
  });

  test("held remote logout still clears local session within the bounded timeout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState("held");
    await installSignoutFixtures(page, state);
    await enterSettings(page);

    const sidebarSignOut = await openSidebar(page);
    const confirmation = await openLogoutConfirmation(page, sidebarSignOut);
    const startedAt = Date.now();
    await confirmation.confirm.tap();
    try {
      await expect.poll(() => state.holdStarted, { timeout: 5_000 }).toBe(true);
      await expectLoginScreen(page);
      const elapsed = Date.now() - startedAt;
      expect(elapsed, "logout should wait for the bounded transport timeout").toBeGreaterThan(2_500);
      expect(elapsed, "logout should not wait beyond its transport timeout").toBeLessThan(6_500);
      expect(state.holdReleaseRequested, "the held response must still be gated after local cleanup").toBe(false);
      expect(state.holdResponseAttempted, "the held response must not be released before local cleanup").toBe(false);
      expect(await readSessionPresence(page)).toEqual({ accessToken: false, refreshToken: false });
      expect(state.logoutRequests).toHaveLength(1);
      assertFixtureClosed(state);
    } finally {
      state.releaseHeldLogout?.();
    }
    await expect.poll(() => state.holdResponseAttempted, { timeout: 5_000 }).toBe(true);

    const audit = await captureEvidence(page, testInfo, state, "held-remote-login-390");
    assertCleanLayout(audit);
  });

  test("local storage cleanup failure shows a retryable message and the next attempt completes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState("success");
    await installSignoutFixtures(page, state);
    await enterSettings(page);

    const sidebarSignOut = await openSidebar(page);
    const confirmation = await openLogoutConfirmation(page, sidebarSignOut);
    await page.evaluate(() => {
      const storagePrototype = Storage.prototype;
      const nativeRemoveItem = storagePrototype.removeItem;
      (window as unknown as { __fittrackSignoutStorageFault?: boolean }).__fittrackSignoutStorageFault = true;
      storagePrototype.removeItem = function removeItem(key: string) {
        const fault = (window as unknown as { __fittrackSignoutStorageFault?: boolean }).__fittrackSignoutStorageFault;
        if (fault && (key === "fittrack_access_token" || key === "fittrack_refresh_token")) {
          throw new Error("fixture storage fault");
        }
        return nativeRemoveItem.call(this, key);
      };
    });

    await confirmation.confirm.tap();
    await expect(page.getByText(RETRYABLE_ERROR, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(confirmation.title).toBeVisible();
    await expect(confirmation.confirm).toBeVisible();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    expect(await readSessionPresence(page)).toEqual({ accessToken: true, refreshToken: true });
    const remoteAttemptsBeforeRetry = state.logoutRequests.length;
    expect(remoteAttemptsBeforeRetry, "the initial cleanup attempt should try remote revocation").toBeGreaterThan(0);

    await captureScreenshot(page, testInfo, "cleanup-failure-retryable");
    await page.evaluate(() => {
      (window as unknown as { __fittrackSignoutStorageFault?: boolean }).__fittrackSignoutStorageFault = false;
    });
    await confirmation.confirm.tap();
    await expectLoginScreen(page);

    expect(await readSessionPresence(page)).toEqual({ accessToken: false, refreshToken: false });
    expect(
      state.logoutRequests.length,
      "the cached refresh token is cleared before a failed local removal can be retried",
    ).toBe(remoteAttemptsBeforeRetry);
    assertFixtureClosed(state);

    const audit = await captureEvidence(page, testInfo, state, "cleanup-retry-login-390");
    assertCleanLayout(audit);
  });
});
