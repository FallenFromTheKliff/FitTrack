import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFixtureClosed,
  COACH_CLIENT_NAME,
  COACH_ROUTE_MANIFEST,
  COACH_SHARED_ROUTE_MANIFEST,
  AUTH_ROUTE_MANIFEST,
  FACILITY_REGION_NAME,
  FACILITY_IMAGE_ONE,
  installMemberResponsiveFixtures,
  MEMBER_ROUTE_MANIFEST,
  MOBILE_RESPONSIVE_BASE_URL,
  newFixtureState,
  type ResponsiveRole,
} from "./mobile-responsive-fixtures";
import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

type ScrollInspection = {
  after: number;
  bounded: boolean;
  before: number;
  clientHeight: number;
  overflowY: string | null;
  owner: string | null;
  scrollHeight: number;
  visible: boolean;
};

type NonInteractiveOverflow = {
  clientWidth: number;
  rect: { bottom: number; left: number; right: number; top: number };
  scrollWidth: number;
  text: string;
  whiteSpace: string;
};

function evidenceName(testInfo: TestInfo, suffix: string) {
  return `${testInfo.project.name}-${testInfo.testId}-${suffix}`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );
}

async function inspectNonInteractiveText(page: Page): Promise<NonInteractiveOverflow[]> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>("div,p,span"))
      .filter((element) => {
        const text = element.textContent?.trim() ?? "";
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const hasInteractiveAncestor = Boolean(
          element.closest(
            "button,a,input,textarea,select,[role='button'],[role='link'],[role='checkbox'],[role='switch']",
          ),
        );
        return (
          text.length >= 20 &&
          !hasInteractiveAncestor &&
          element.childElementCount === 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || 1) > 0 &&
          element.scrollWidth > element.clientWidth + 2 &&
          style.whiteSpace !== "normal" &&
          style.textOverflow !== "ellipsis"
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          clientWidth: element.clientWidth,
          rect: {
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
          },
          scrollWidth: element.scrollWidth,
          text: element.textContent?.trim().slice(0, 140) ?? "",
          whiteSpace: style.whiteSpace,
        };
      });
  });
}

async function saveEvidence(
  page: Page,
  testInfo: TestInfo,
  state: ReturnType<typeof newFixtureState>,
  routeName: string,
  audit: VisualLayoutAudit,
  scroll: ScrollInspection,
  role: ResponsiveRole = "USER",
  evidenceFolder = "mobile-responsive",
) {
  const root = resolve(process.cwd(), ".artifacts", "playwright", evidenceFolder);
  await mkdir(root, { recursive: true });
  const name = evidenceName(testInfo, routeName);
  const nonInteractiveText = await inspectNonInteractiveText(page);
  const evidence = {
    route: await page.url(),
    role,
    viewport: page.viewportSize(),
    populatedMarker: routeName,
    scroll,
    geometry: audit,
    nonInteractiveText,
    observedRequests: state.observedRequests,
    mutations: state.mutations,
    unhandled: state.unhandled,
    pageErrors: state.pageErrors,
    requestFailures: state.requestFailures,
    artifacts: {
      top: `.artifacts/playwright/${evidenceFolder}/${name}-top.png`,
      middle: `.artifacts/playwright/${evidenceFolder}/${name}-middle.png`,
      bottom: `.artifacts/playwright/${evidenceFolder}/${name}-bottom.png`,
      json: `.artifacts/playwright/${evidenceFolder}/${name}.json`,
    },
  };
  const body = JSON.stringify(evidence, null, 2);
  const jsonPath = resolve(root, `${name}.json`);
  await writeFile(jsonPath, body);
  await testInfo.attach(`${routeName}-layout.json`, {
    body,
    contentType: "application/json",
  });

  await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>(
      '[data-mobile-responsive-scroll-owner="true"]',
    );
    if (owner) owner.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: resolve(root, `${name}-top.png`), fullPage: false });
  await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>(
      '[data-mobile-responsive-scroll-owner="true"]',
    );
    if (owner) owner.scrollTop = Math.max(1, (owner.scrollHeight - owner.clientHeight) / 2);
    else window.scrollTo(0, Math.max(1, document.documentElement.scrollHeight / 2));
  });
  await page.screenshot({ path: resolve(root, `${name}-middle.png`), fullPage: false });
  await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>(
      '[data-mobile-responsive-scroll-owner="true"]',
    );
    if (owner) owner.scrollTop = owner.scrollHeight - owner.clientHeight;
    else window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.screenshot({ path: resolve(root, `${name}-bottom.png`), fullPage: false });
  await testInfo.attach(`${routeName}-top.png`, {
    path: resolve(root, `${name}-top.png`),
    contentType: "image/png",
  });
  await testInfo.attach(`${routeName}-middle.png`, {
    path: resolve(root, `${name}-middle.png`),
    contentType: "image/png",
  });
  await testInfo.attach(`${routeName}-bottom.png`, {
    path: resolve(root, `${name}-bottom.png`),
    contentType: "image/png",
  });
  return evidence;
}

async function inspectAndScroll(page: Page): Promise<ScrollInspection> {
  const initial = await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>('[data-mobile-responsive-scroll-owner="true"]')
      .forEach((node) => node.removeAttribute("data-mobile-responsive-scroll-owner"));
    const visible = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const dialog = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"], [aria-modal="true"], [data-modal="true"]',
      ),
    ).filter(visible).at(-1) ?? null;
    const candidates = [
      ...(dialog ? [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>("*"))] : []),
      ...(dialog ? [] : [document.scrollingElement, ...Array.from(document.querySelectorAll<HTMLElement>("*") )]),
    ].filter((node): node is HTMLElement => Boolean(node));
    const scrollable = candidates
      .filter((node) => {
        if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return (
          ["auto", "scroll", "overlay"].includes(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 4 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1
        );
      })
      .sort(
        (left, right) =>
          right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight),
      )[0];
    if (scrollable) {
      scrollable.scrollTop = 0;
      scrollable.setAttribute("data-mobile-responsive-scroll-owner", "true");
    }
    const rect = scrollable?.getBoundingClientRect();
    const style = scrollable ? window.getComputedStyle(scrollable) : null;
    return {
      bounded: Boolean(
        rect &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0,
      ),
      owner: scrollable?.tagName ?? null,
      before: scrollable ? 0 : window.scrollY,
      clientHeight: scrollable?.clientHeight ?? window.innerHeight,
      overflowY: style?.overflowY ?? null,
      scrollHeight: scrollable?.scrollHeight ?? document.documentElement.scrollHeight,
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
    };
  });
  if (initial.scrollHeight > initial.clientHeight + 4) {
    await page.evaluate(() => {
      const owner = document.querySelector<HTMLElement>(
        '[data-mobile-responsive-scroll-owner="true"]',
      );
      if (owner) owner.scrollTop = owner.scrollHeight - owner.clientHeight;
      else window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const owner = document.querySelector<HTMLElement>(
            '[data-mobile-responsive-scroll-owner="true"]',
          );
          return owner?.scrollTop ?? window.scrollY;
        }),
      )
      .toBeGreaterThan(initial.before + 1);
  }
  const after = await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>(
      '[data-mobile-responsive-scroll-owner="true"]',
    );
    return owner?.scrollTop ?? window.scrollY;
  });
  return { ...initial, after };
}

async function hitTest(locator: Locator, label: string) {
  let latestResult: unknown;
  try {
    await expect.poll(async () => {
      latestResult = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const points = [
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.left + Math.min(3, rect.width / 2), rect.top + rect.height / 2],
          [rect.right - Math.min(3, rect.width / 2), rect.top + rect.height / 2],
          [rect.left + rect.width / 2, rect.top + Math.min(3, rect.height / 2)],
          [rect.left + rect.width / 2, rect.bottom - Math.min(3, rect.height / 2)],
        ];
        const topmost = points.map(([x, y]) => {
          const topmost = document.elementFromPoint(x, y);
          return {
            className: topmost?.getAttribute("class") ?? null,
            id: topmost?.id ?? null,
            role: topmost?.getAttribute("role") ?? null,
            tagName: topmost?.tagName ?? null,
            text: topmost?.textContent?.trim().slice(0, 80) ?? null,
          };
        });
        return {
          hits: points.map(([x, y]) => {
            const top = document.elementFromPoint(x, y);
            return Boolean(top && (top === element || element.contains(top)));
          }),
          rect: {
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
          },
          topmost,
          viewport: { height: window.innerHeight, width: window.innerWidth },
        };
      });
      return latestResult;
    }, `${label} center and padding-edge hit tests`).toMatchObject({
      hits: [true, true, true, true, true],
    });
  } catch (error) {
      throw new Error(
        `${label} strict hit test failed: ${JSON.stringify(latestResult)}\n${String(error)}`,
        { cause: error },
      );
  }
}

async function tapAtPaddingEdge(page: Page, locator: Locator, label: string) {
  await hitTest(locator, label);
  const box = await locator.boundingBox();
  expect(box, `${label} bounds`).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + Math.min(3, box.width / 2), box.y + box.height / 2);
}

async function waitForStableVisibleGeometry(locator: Locator, label: string) {
  await expect.poll(async () => {
    return locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let current: HTMLElement | null = element as HTMLElement;
      let opacity = 1;
      while (current) {
        const style = window.getComputedStyle(current);
        opacity *= Number(style.opacity || 1);
        current = current.parentElement;
      }
      return {
        height: Math.round(rect.height),
        inViewport: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
        opacity: Math.round(opacity * 100) / 100,
        width: Math.round(rect.width),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      };
    });
  }, `${label} visible geometry`).toEqual(expect.objectContaining({ inViewport: true, opacity: 1 }));
}

async function markerLocator(page: Page, routeName: string, marker: string, kind?: "text" | "testId") {
  return kind === "testId"
    ? page.getByTestId(marker)
    : page.getByText(marker, { exact: true }).first();
}

function softAudit(audit: VisualLayoutAudit) {
  expect.soft(audit.horizontalOverflow, "horizontal page overflow").toBe(false);
  // The restored default header deliberately keeps the pre-task badge overhang;
  // only the uniquely marked notification action may report that visual edge.
  const unexplainedSquishedText = audit.squishedText.filter(
    (entry) => !entry.startsWith("button#mobile-responsive-notification-button:"),
  );
  expect.soft(unexplainedSquishedText, "non-ellipsis squished labels").toEqual([]);
  expect.soft(audit.clipping, "clipped text or controls").toEqual([]);
  expect.soft(audit.overlaps, "overlapping interactive controls").toEqual([]);
  const pageNestedScrollbars = audit.nestedScrollbars.filter(
    (entry) => !/^(?:input|textarea)\b/i.test(entry),
  );
  expect.soft(pageNestedScrollbars, "nested page scroll owners").toEqual([]);
}

function coachHeaderName(path: string) {
  if (path === "/home") return "Dashboard";
  if (path.includes("coachView=clients")) return "Clients";
  if (path.includes("coachView=earnings")) return "Earnings";
  return "Sessions";
}

function coachSharedHeaderName(path: string) {
  if (path === "/profile") return "Profile";
  if (path === "/settings") return "Settings";
  return "BrodigyAI";
}

function memberHeaderName(path: string) {
  const pathname = path.split("?", 1)[0];
  if (pathname === "/workout-plans") return null;
  const names: Record<string, string> = {
    "/assessments": "Assessments",
    "/bookings": "Bookings",
    "/chatbot": "BrodigyAI",
    "/chathistory": "BrodigyAI",
    "/facilities": "Gym Facilities",
    "/home": "Home",
    "/mastery": "Muscle Mastery",
    "/nutrition": "Nutrition",
    "/profile": "Profile",
    "/settings": "Settings",
    "/workout": "Workout",
  };
  return names[pathname] ?? null;
}

function coachClientAccessibleName() {
  const escaped = COACH_CLIENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:,|$)`);
}

for (const routeCase of MEMBER_ROUTE_MANIFEST) {
  test(`member ${routeCase.name} populated responsive render`, async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}${routeCase.path}`, {
      waitUntil: "domcontentloaded",
    });
    const marker = await markerLocator(page, routeCase.name, routeCase.marker, routeCase.markerKind);
    await expect(marker, `${routeCase.name} populated primary marker`).toBeVisible({ timeout: 30_000 });
    const expectedHeader = memberHeaderName(routeCase.path);
    if (expectedHeader) {
      await expect(
        page.getByText(expectedHeader, { exact: true }).first(),
        `${routeCase.name} complete header title`,
      ).toBeVisible({ timeout: 30_000 });
    }
    await stabilizeVisualPage(page);
    if (routeCase.name === "bookings") {
      const smallViewport = (page.viewportSize()?.width ?? 0) < 360;
      const venueTitle = page.getByText(FACILITY_REGION_NAME, { exact: true }).first();
      const card = venueTitle.locator("xpath=ancestor::button[1]");
      const status = card.getByText("Confirmed", { exact: true }).first();
      await expect(venueTitle, "bookings full venue title").toHaveText(FACILITY_REGION_NAME);
      await expect(card, "bookings venue card").toBeVisible();
      await expect(status, "bookings venue status").toBeVisible();
      const [cardBox, titleBox, statusBox] = await Promise.all([
        card.boundingBox(),
        venueTitle.boundingBox(),
        status.boundingBox(),
      ]);
      expect(cardBox, "bookings venue card bounds").not.toBeNull();
      expect(titleBox, "bookings full venue title bounds").not.toBeNull();
      expect(statusBox, "bookings venue status bounds").not.toBeNull();
      if (cardBox && titleBox && statusBox) {
        expect(titleBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        if (smallViewport) {
          expect(statusBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
        } else {
          expect(
            Math.abs(statusBox.y - titleBox.y),
            "default booking title and status row alignment",
          ).toBeLessThanOrEqual(4);
        }
      }
    }
    const bottomControl = routeCase.bottomControlKind === "textbox"
      ? page.getByRole("textbox", { name: routeCase.bottomControl, exact: false })
      : page.getByRole("button", { name: routeCase.bottomControl, exact: false });
    const isFixedQuickActionsControl = routeCase.bottomControl === "Open quick actions menu";
    if (routeCase.bottomControlKind === "textbox") {
      await expect(bottomControl, `${routeCase.name} bottom composer`).toBeVisible();
      await bottomControl.fill("Responsive draft check without sending.");
    }
    if (isFixedQuickActionsControl) {
      await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
      await expect(bottomControl, `${routeCase.name} bottom primary control bounds`).toBeInViewport();
      await hitTest(bottomControl, `${routeCase.name} bottom primary control`);
    }
    const scroll = await inspectAndScroll(page);
    if (routeCase.expectedScroll && scroll.scrollHeight > scroll.clientHeight + 4) {
      expect(scroll.after, `${routeCase.name} actual scroll delta`).toBeGreaterThan(scroll.before + 1);
      expect(scroll.visible, `${routeCase.name} scroll owner visible`).toBe(true);
      expect(scroll.bounded, `${routeCase.name} scroll owner bounded`).toBe(true);
      expect(["auto", "scroll", "overlay"], `${routeCase.name} computed scroll owner overflow`).toContain(scroll.overflowY);
    }
    if (isFixedQuickActionsControl && scroll.after > scroll.before + 1) {
      await page.evaluate(() => {
        const owner = document.querySelector<HTMLElement>(
          '[data-mobile-responsive-scroll-owner="true"]',
        );
        if (owner) owner.scrollTop = Math.max(0, owner.scrollTop - 24);
      });
      await expect.poll(async () => {
        const box = await bottomControl.boundingBox();
        return Boolean(box && box.y >= 0 && box.y + box.height <= (page.viewportSize()?.height ?? 0));
      }, `${routeCase.name} quick actions reveal after reverse scroll`).toBe(true);
      await hitTest(bottomControl, `${routeCase.name} bottom primary control after reverse scroll`);
    }
    if (!isFixedQuickActionsControl) {
      await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
      await expect(bottomControl, `${routeCase.name} bottom primary control bounds`).toBeInViewport();
      await hitTest(bottomControl, `${routeCase.name} bottom primary control`);
    }
    const audit = await auditConventionalLayout(page);
    const nonInteractiveText = await inspectNonInteractiveText(page);
    await saveEvidence(page, testInfo, state, routeCase.name, audit, scroll);
    softAudit(audit);
    expect.soft(nonInteractiveText, `${routeCase.name} noninteractive text overflow`).toEqual([]);
    expect(state.unhandled, `${routeCase.name} unexpected API requests`).toEqual([]);
    expect(state.requestFailures, `${routeCase.name} failed API requests`).toEqual([]);
    expect(state.pageErrors, `${routeCase.name} page errors`).toEqual([]);
    expect(state.consoleErrors, `${routeCase.name} console errors`).toEqual([]);
  });
}

test.describe("member shared responsive shell · profile/settings/chat history", () => {
  test("header help, populated notifications, and padded-edge sidebar navigation reach Settings", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("profile-screen")).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const help = page.getByRole("button", { name: "Open page help", exact: true });
    await expect(help).toBeVisible();
    await tapAtPaddingEdge(page, help, "page help button");
    await expect(page.getByText(/^Help - /).first()).toBeVisible();
    const helpClose = page.getByRole("button", { name: "Close help", exact: true });
    await expect(helpClose).toBeVisible();
    await tapAtPaddingEdge(page, helpClose, "close help button");
    await expect(page.getByText(/^Help - /).first()).toBeHidden();

    const notifications = page.getByRole("button", { name: /unread notification/ }).first();
    await expect(notifications).toBeVisible();
    await tapAtPaddingEdge(page, notifications, "notifications button");
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeVisible();
    const notificationDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByText("NOTIFICATION INBOX", { exact: true }) })
      .last();
    await expect(notificationDialog).toBeVisible();
    const notificationOwnerMetrics = await notificationDialog.evaluate((dialog) => {
      document
        .querySelectorAll<HTMLElement>("[data-notification-width-scroll-owner]")
        .forEach((node) => node.removeAttribute("data-notification-width-scroll-owner"));
      const candidates = [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>("*"))];
      const scrollables = candidates
        .filter((node) => {
          const style = getComputedStyle(node);
          return (
            ["auto", "scroll"].includes(style.overflowY) &&
            node.scrollHeight > node.clientHeight + 4 &&
            node.getBoundingClientRect().width > 0 &&
            node.getBoundingClientRect().height > 0
          );
        })
        .sort((left, right) => left.clientHeight - right.clientHeight);
      const owner = scrollables.find((node) => getComputedStyle(node).maxHeight !== "none") ?? scrollables[0];
      if (!owner) throw new Error("Notification list has no bounded scroll owner.");
      owner.setAttribute("data-notification-width-scroll-owner", "true");
      owner.scrollTop = 0;
      const rect = owner.getBoundingClientRect();
      return {
        clientHeight: owner.clientHeight,
        overflowY: getComputedStyle(owner).overflowY,
        scrollHeight: owner.scrollHeight,
        width: Math.round(rect.width),
      };
    });
    const notificationList = page.locator("[data-notification-width-scroll-owner='true']");
    await expect(notificationList).toHaveCount(1);
    expect(notificationOwnerMetrics.overflowY).toMatch(/^(auto|scroll)$/);
    expect(notificationOwnerMetrics.scrollHeight).toBeGreaterThan(
      notificationOwnerMetrics.clientHeight + 4,
    );
    const notificationRows = notificationDialog.getByRole("button", {
      name: /^(Expand|Collapse) notification /,
    });
    await expect(notificationRows).toHaveCount(7);
    const firstNotification = notificationRows.first();
    const itemBefore = await firstNotification.boundingBox();
    expect(itemBefore, "first notification bounds before wrapper removal").not.toBeNull();
    const notificationPhase = process.env.MOBILE_NOTIFICATION_WIDTH_PHASE ?? "after";
    const notificationEvidenceRoot = resolve(
      process.cwd(),
      ".artifacts",
      "playwright",
      "notification-width",
      notificationPhase,
    );
    await mkdir(notificationEvidenceRoot, { recursive: true });
    const notificationEvidenceName = `${testInfo.project.name}-notification-open`;
    await page.screenshot({
      path: resolve(notificationEvidenceRoot, `${notificationEvidenceName}-top.png`),
      fullPage: false,
    });
    await testInfo.attach(`${notificationEvidenceName}-top.png`, {
      path: resolve(notificationEvidenceRoot, `${notificationEvidenceName}-top.png`),
      contentType: "image/png",
    });
    await tapAtPaddingEdge(page, firstNotification, "first notification expand");
    await expect(
      notificationDialog
        .getByText("Your booking update is ready to review.", { exact: true })
        .first(),
    ).toBeVisible();
    const expandedNotification = notificationDialog.getByRole("button", {
      name: /^Collapse notification /,
    }).first();
    await tapAtPaddingEdge(page, expandedNotification, "first notification collapse");
    await expect(
      notificationDialog.getByRole("button", { name: /^Expand notification / }).first(),
    ).toBeVisible();
    const scrollBefore = await notificationList.evaluate((node) => node.scrollTop);
    await expect
      .poll(async () => {
        return notificationList.evaluate((node) => {
          node.scrollTop = node.scrollHeight - node.clientHeight;
          return node.scrollTop;
        });
      })
      .toBeGreaterThan(scrollBefore + 1);
    const scrollAfter = await notificationList.evaluate((node) => node.scrollTop);
    const laterNotification = notificationRows.last();
    await expect
      .poll(async () => {
        const box = await laterNotification.boundingBox();
        const viewportHeight = page.viewportSize()?.height ?? 0;
        return Boolean(box && box.y >= 0 && box.y + box.height <= viewportHeight);
      })
      .toBe(true);
    await page.screenshot({
      path: resolve(notificationEvidenceRoot, `${notificationEvidenceName}-bottom.png`),
      fullPage: false,
    });
    await writeFile(
      resolve(notificationEvidenceRoot, `${notificationEvidenceName}.json`),
      JSON.stringify(
        {
          itemWidth: itemBefore?.width ?? null,
          notificationOwnerMetrics,
          scrollBefore,
          scrollAfter,
          viewport: page.viewportSize(),
        },
        null,
        2,
      ),
    );
    const notificationClose = page.getByRole("button", { name: "Close", exact: true }).last();
    await expect(notificationClose).toBeVisible();
    await notificationClose.scrollIntoViewIfNeeded();
    await tapAtPaddingEdge(page, notificationClose, "close notifications button");
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeHidden();

    const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
    await expect(menu).toBeVisible();
    await tapAtPaddingEdge(page, menu, "navigation menu button");
    const settingsNav = page.getByRole("button", { name: "Settings", exact: true });
    await expect(settingsNav).toBeVisible();
    await settingsNav.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(settingsNav, "sidebar Settings navigation item");
    await tapAtPaddingEdge(page, settingsNav, "sidebar Settings navigation item");
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(page.getByText("PREFERENCES", { exact: true })).toBeVisible({ timeout: 30_000 });

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(
      page,
      testInfo,
      state,
      "shared-shell",
      audit,
      scroll,
      "USER",
      `notification-width/${notificationPhase}`,
    );
    softAudit(audit);
    expect(state.mutations, "shared shell should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("chat history exposes populated sessions and retains a draft-sized viewport owner", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/chathistory`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Progress check-in", { exact: true })).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    const search = page.getByRole("textbox", { name: /Search conversations/ });
    await expect(search).toBeVisible();
    await search.fill("Progress");
    await expect(page.getByText("Progress check-in", { exact: true })).toBeVisible();
    await search.fill("");
    const scroll = await inspectAndScroll(page);
    const audit = await auditConventionalLayout(page);
    await saveEvidence(page, testInfo, state, "chat-history", audit, scroll);
    softAudit(audit);
    expect(state.mutations, "chat history read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });
});

test.describe("member nutrition responsive overlay", () => {
  test("short NutritionLog form keeps fields and footer reachable, then closes without a write", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/nutrition`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("TODAY'S CALORIES", { exact: true })).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const fab = page.getByRole("button", { name: "Open quick actions menu", exact: true });
    await expect(fab).toBeVisible();
    await tapAtPaddingEdge(page, fab, "nutrition quick actions button");
    const logAction = page.getByRole("button", { name: "Log Meal. Add today's food", exact: true });
    await expect(logAction).toBeVisible();
    await tapAtPaddingEdge(page, logAction, "nutrition Log Meal action");
    await expect(page.getByText("Log Meal", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search previous meals", exact: true })).toBeVisible();

    const startNewMeal = page.getByRole("button", { name: "New Log Meal", exact: true });
    await expect(startNewMeal).toBeVisible();
    const nutritionCard = page.getByTestId("nutrition-log-modal-card");
    await expect(nutritionCard, "NutritionLog choice card").toBeVisible();
    const nutritionBox = await nutritionCard.boundingBox();
    const nutritionViewport = page.viewportSize();
    expect(nutritionBox, "NutritionLog choice card bounds").not.toBeNull();
    expect(nutritionViewport, "NutritionLog choice viewport").not.toBeNull();
    if (nutritionBox && nutritionViewport) {
      expect(nutritionBox.x).toBeGreaterThanOrEqual(-1);
      expect(nutritionBox.x + nutritionBox.width).toBeLessThanOrEqual(nutritionViewport.width + 1);
      expect(nutritionBox.y).toBeGreaterThanOrEqual(-1);
      expect(nutritionBox.y + nutritionBox.height).toBeLessThanOrEqual(nutritionViewport.height + 1);
    }
    const choiceScreenshotPath = resolve(
      process.cwd(),
      ".artifacts",
      "playwright",
      "mobile-responsive",
      `${evidenceName(testInfo, "nutrition-log-choice")}.png`,
    );
    await mkdir(resolve(process.cwd(), ".artifacts", "playwright", "mobile-responsive"), { recursive: true });
    await page.screenshot({ path: choiceScreenshotPath, fullPage: false });
    await testInfo.attach("nutrition-log-choice.png", { path: choiceScreenshotPath, contentType: "image/png" });
    await tapAtPaddingEdge(page, startNewMeal, "New Log Meal action");
    await expect(page.getByRole("button", { name: "Meal type: not selected", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Food item", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Calories", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Portion quantity", exact: true })).toBeVisible();

    const back = page.getByRole("button", { name: "Back", exact: true });
    const saveLog = page.getByRole("button", { name: "Save Log", exact: true });
    await expect(back).toBeVisible();
    await expect(saveLog).toBeVisible();
    await expect(back).toBeInViewport();
    await expect(saveLog).toBeInViewport();
    await hitTest(back, "NutritionLog form Back footer");
    await hitTest(saveLog, "NutritionLog form Save Log footer");

    const formAudit = await auditConventionalLayout(page);
    const formScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "nutrition-log-form", formAudit, formScroll);
    softAudit(formAudit);

    await tapAtPaddingEdge(page, back, "NutritionLog form Back footer");
    const cancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await expect(cancel).toBeVisible();
    await tapAtPaddingEdge(page, cancel, "NutritionLog choice Cancel footer");
    await expect(page.getByText("Log Meal", { exact: true })).toBeHidden();
    expect(state.mutations, "NutritionLog close journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });
});

test.describe("member bookings, assessments, and facilities responsive journeys", () => {
  test("booking filters open a future date calendar and cancel without payment", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(FACILITY_REGION_NAME, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const filters = page.getByRole("button", { name: "Open booking filters", exact: true });
    await tapAtPaddingEdge(page, filters, "booking filters button");
    await expect(page.getByText("Status", { exact: true })).toBeVisible();

    const startDate = page.getByRole("button", { name: "Start date: All Dates", exact: true });
    await tapAtPaddingEdge(page, startDate, "booking start date filter");
    await expect(page.getByText("September 2026", { exact: true })).toBeVisible();
    const calendarCard = page.getByTestId("calendar-modal-card");
    await expect(calendarCard, "booking calendar card").toBeVisible();
    const calendarBox = await calendarCard.boundingBox();
    const calendarViewport = page.viewportSize();
    expect(calendarBox, "booking calendar card bounds").not.toBeNull();
    expect(calendarViewport, "booking calendar viewport").not.toBeNull();
    if (calendarBox && calendarViewport) {
      expect(calendarBox.x).toBeGreaterThanOrEqual(-1);
      expect(calendarBox.x + calendarBox.width).toBeLessThanOrEqual(calendarViewport.width + 1);
      expect(calendarBox.y).toBeGreaterThanOrEqual(-1);
      expect(calendarBox.y + calendarBox.height).toBeLessThanOrEqual(calendarViewport.height + 1);
    }
    const previousCalendarPage = page.getByRole("button", { name: "Previous calendar page", exact: true });
    const nextCalendarPage = page.getByRole("button", { name: "Next calendar page", exact: true });
    await hitTest(previousCalendarPage, "booking calendar previous page");
    await tapAtPaddingEdge(page, previousCalendarPage, "booking calendar previous page");
    await expect(page.getByText("August 2026", { exact: true })).toBeVisible();
    await hitTest(nextCalendarPage, "booking calendar next page");
    await tapAtPaddingEdge(page, nextCalendarPage, "booking calendar next page");
    await expect(page.getByText("September 2026", { exact: true })).toBeVisible();
    const calendarOpenPath = resolve(
      process.cwd(),
      ".artifacts",
      "playwright",
      "mobile-responsive",
      `${evidenceName(testInfo, "bookings-calendar-open")}.png`,
    );
    await mkdir(resolve(process.cwd(), ".artifacts", "playwright", "mobile-responsive"), { recursive: true });
    await page.screenshot({ path: calendarOpenPath, fullPage: false });
    await testInfo.attach("bookings-calendar-open.png", { path: calendarOpenPath, contentType: "image/png" });
    const futureDay = page.getByRole("button", { name: "9", exact: true }).last();
    await waitForStableVisibleGeometry(futureDay, "booking future calendar day");
    await tapAtPaddingEdge(page, futureDay, "booking future calendar day");
    await expect(page.getByText("September 2026", { exact: true })).toBeHidden();

    const endDate = page.getByRole("button", { name: /^End date:/, exact: false });
    await tapAtPaddingEdge(page, endDate, "booking end date filter");
    await expect(page.getByText("September 2026", { exact: true })).toBeVisible();
    const calendarCancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await calendarCancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(calendarCancel, "booking calendar Cancel");
    await tapAtPaddingEdge(page, calendarCancel, "booking calendar Cancel");
    await expect(page.getByText("September 2026", { exact: true })).toBeHidden();

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "bookings-filter", audit, scroll);
    softAudit(audit);
    expect(state.mutations, "booking filter journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("completed coach appointment opens the review dialog with reachable stars and cancels without submitting", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(FACILITY_REGION_NAME, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const filters = page.getByRole("button", { name: "Open booking filters", exact: true });
    await tapAtPaddingEdge(page, filters, "review booking filters button");
    const appointments = page.getByRole("tab", { name: "View: Appointments", exact: true });
    await expect(appointments).toBeVisible();
    await tapAtPaddingEdge(page, appointments, "review appointments view");
    const closeFilters = page.getByRole("button", { name: "Close booking filters", exact: true });
    await tapAtPaddingEdge(page, closeFilters, "close review booking filters");

    const appointment = page.getByRole("button", {
      name: /^Coach Alexandria Assessment Review,/,
      exact: false,
    }).first();
    await expect(appointment, "completed unreviewed appointment card").toBeVisible({ timeout: 30_000 });
    await appointment.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(appointment, "completed unreviewed appointment card");
    await tapAtPaddingEdge(page, appointment, "completed unreviewed appointment card");
    await expect(page.getByText("Appointment Details", { exact: true })).toBeVisible();

    const leaveFeedback = page.getByRole("button", { name: "Leave Feedback", exact: true });
    await leaveFeedback.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(leaveFeedback, "Leave Feedback action");
    await tapAtPaddingEdge(page, leaveFeedback, "Leave Feedback action");
    await expect(page.getByText("Leave feedback for your coach", { exact: true })).toBeVisible();

    const stars = page.getByRole("radio", { name: /Rate coach \d out of 5 stars/, exact: true });
    await expect(stars).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      const star = stars.nth(index);
      const box = await star.boundingBox();
      expect(box, `review star ${index + 1} bounds`).not.toBeNull();
      expect(box?.height ?? 0, `review star ${index + 1} height`).toBeGreaterThanOrEqual(44);
      await hitTest(star, `review star ${index + 1}`);
    }
    await tapAtPaddingEdge(page, stars.nth(3), "four-star review selection");
    const comment = page.getByRole("textbox", { name: "Written coach review", exact: true });
    await comment.fill("Responsive review draft only.");
    await expect(comment).toHaveValue("Responsive review draft only.");

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "member-coach-review-open", audit, scroll);
    softAudit(audit);

    const cancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await cancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(cancel, "coach review Cancel");
    await tapAtPaddingEdge(page, cancel, "coach review Cancel");
    await expect(page.getByText("Leave feedback for your coach", { exact: true })).toBeHidden();
    expect(state.mutations, "coach review cancellation should not submit").toEqual([]);
    assertFixtureClosed(state);
  });

  test("assessments filter by record type while keeping populated records visible", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/assessments`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Coach assessment", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const filter = page.getByRole("button", { name: "Filter assessments by record type: All", exact: true });
    await tapAtPaddingEdge(page, filter, "assessment record-type filter");
    const coachAssessments = page.getByRole("button", { name: "Status: Coach assessments", exact: true });
    await waitForStableVisibleGeometry(coachAssessments, "assessment Coach assessments filter");
    await tapAtPaddingEdge(page, coachAssessments, "assessment Coach assessments filter");
    await expect(page.getByText("Coach assessment", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Assessment report:/).first()).toBeVisible();

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "assessments-filter", audit, scroll);
    softAudit(audit);
    expect(state.mutations, "assessment filter journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("facilities exposes a populated region details modal that closes", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "USER", {
      feedbackHistoryCount: 12,
      feedbackPostDelayMs: 100,
    });
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/facilities`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(FACILITY_REGION_NAME, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Fit facility map", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Entrance", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Exit", exact: true })).toBeVisible();
    await stabilizeVisualPage(page);

    const region = page.getByRole("button", { name: `Open ${FACILITY_REGION_NAME} details`, exact: true });
    await tapAtPaddingEdge(page, region, "facility region details");
    await expect(page.getByText("Description", { exact: true })).toBeVisible();
    await expect(page.getByText("Operating Hours", { exact: true })).toBeVisible();
    await expect(page.getByText("6:00 AM – 10:00 PM", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Saturday", { exact: true })).toBeVisible();
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();
    await expect(page.getByText("Photo 1 of 2", { exact: true })).toBeVisible();

    const nextImage = page.getByRole("button", {
      name: `Next image for ${FACILITY_REGION_NAME}`,
      exact: true,
    });
    const previousImage = page.getByRole("button", {
      name: `Previous image for ${FACILITY_REGION_NAME}`,
      exact: true,
    });
    await nextImage.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(nextImage, "facility next image");
    await tapAtPaddingEdge(page, nextImage, "facility next image");
    await expect(page.getByText("Photo 2 of 2", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, nextImage, "facility next image circular boundary");
    await expect(page.getByText("Photo 1 of 2", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, previousImage, "facility previous image circular boundary");
    await expect(page.getByText("Photo 2 of 2", { exact: true })).toBeVisible();

    const viewAllFeedback = page.getByRole("button", {
      name: "View all feedback",
      exact: true,
    });
    await viewAllFeedback.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(viewAllFeedback, "view all venue feedback");
    await tapAtPaddingEdge(page, viewAllFeedback, "view all venue feedback");
    await expect(page.getByText("All venue feedback", { exact: true })).toBeVisible();
    await expect(page.getByText("Feedback Member 1", { exact: true })).toBeVisible();
    const loadMoreFeedback = page.getByRole("button", {
      name: "Load more feedback",
      exact: true,
    });
    await loadMoreFeedback.scrollIntoViewIfNeeded();
    await tapAtPaddingEdge(page, loadMoreFeedback, "load more venue feedback");
    await expect(page.getByText("Feedback Member 12", { exact: true })).toBeVisible();
    await expect(page.getByText("No written comment.", { exact: true })).toBeVisible();
    const backToVenueDetails = page.getByRole("button", {
      name: "Back to venue details",
      exact: true,
    });
    await tapAtPaddingEdge(page, backToVenueDetails, "back to venue details");
    await expect(page.getByText("Description", { exact: true })).toBeVisible();

    const feedbackComment = page.getByRole("textbox", {
      name: "Optional note about this venue",
      exact: true,
    });
    await feedbackComment.fill("A clear and useful facility.");
    const feedbackButton = page.getByRole("button", { name: "Leave Feedback", exact: true });
    await feedbackButton.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(feedbackButton, "venue feedback submit");
    await expect(feedbackButton).toBeEnabled();
    const feedbackResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/bookings/amenities/") &&
        response.url().endsWith("/feedback"),
    );
    await feedbackButton.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await feedbackResponse;
    await expect(page.getByText("Venue feedback submitted.", { exact: true })).toBeVisible();
    await expect(page.getByText("Alexandria Responsive · 5/5", { exact: true })).toBeVisible();
    await expect(page.getByText("A clear and useful facility.", { exact: true })).toBeVisible();
    expect(
      state.mutations.filter(
        (mutation) => mutation.method === "POST" && mutation.path.endsWith("/feedback"),
      ),
      "feedback submit should send exactly one request while pending",
    ).toHaveLength(1);
    expect(
      state.observedRequests.some((request) => request.includes("/bookings/amenity/my")),
      "feedback eligibility should not require booking history",
    ).toBe(false);

    const close = page.getByRole("button", { name: "Close", exact: true }).last();
    await close.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(close, "facility details Close");
    await tapAtPaddingEdge(page, close, "facility details Close");
    await expect(page.getByText("Description", { exact: true })).toBeHidden();

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "facilities-details", audit, scroll);
    softAudit(audit);
    expect(
      state.mutations.filter((mutation) => mutation.method !== "POST" || !mutation.path.endsWith("/feedback")),
      "facility details journey should only write the requested feedback",
    ).toEqual([]);
    assertFixtureClosed(state);
  });

  test("facilities shows truthful empty gallery and hours states", async ({ page }) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "USER", {
      facilityGallery: [],
      operatingHours: [],
    });
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/facilities`, { waitUntil: "domcontentloaded" });
    const region = page.getByRole("button", { name: `Open ${FACILITY_REGION_NAME} details`, exact: true });
    await expect(region).toBeVisible({ timeout: 30_000 });
    await tapAtPaddingEdge(page, region, "empty facility region details");
    await expect(page.getByText("Gym operating hours have not been published yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("No venue images have been published yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("Photo 1 of 1", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Leave Feedback", exact: true })).toBeEnabled();
    const viewportWidth = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(viewportWidth.page).toBeLessThanOrEqual(viewportWidth.viewport + 1);
    assertFixtureClosed(state);
  });

  test("facilities keeps a single gallery image accessible without carousel controls", async ({ page }) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "USER", {
      facilityGallery: [FACILITY_IMAGE_ONE],
    });
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/facilities`, { waitUntil: "domcontentloaded" });
    const region = page.getByRole("button", { name: `Open ${FACILITY_REGION_NAME} details`, exact: true });
    await tapAtPaddingEdge(page, region, "single-image facility region details");
    await expect(page.getByText("Photo 1 of 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Next image for ${FACILITY_REGION_NAME}`, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Open image 1 of 1 for ${FACILITY_REGION_NAME}`, exact: true })).toBeVisible();
    assertFixtureClosed(state);
  });

  test("facilities isolates a failed gallery image while retaining the next image", async ({ page }) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "USER", {
      facilityGallery: ["data:image/png;base64,not-a-valid-image", FACILITY_IMAGE_ONE],
    });
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/facilities`, { waitUntil: "domcontentloaded" });
    const region = page.getByRole("button", { name: `Open ${FACILITY_REGION_NAME} details`, exact: true });
    await tapAtPaddingEdge(page, region, "failed-image facility region details");
    await expect(page.getByText("Image unavailable", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Photo 1 of 2", { exact: true })).toBeVisible();
    const nextImage = page.getByRole("button", { name: `Next image for ${FACILITY_REGION_NAME}`, exact: true });
    await nextImage.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(nextImage, "failed-image next facility image");
    await tapAtPaddingEdge(page, nextImage, "failed-image next facility image");
    await expect(page.getByText("Photo 2 of 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Open image 2 of 2 for ${FACILITY_REGION_NAME}`, exact: true }).first()).toBeVisible();
    expect(state.unhandled, "failed image fixture should not make unhandled API calls").toEqual([]);
    expect(state.requestFailures, "failed image fixture should stay within the image component").toEqual([]);
    expect(state.pageErrors, "failed image fixture should not crash the page").toEqual([]);
    expect(
      state.consoleErrors.filter((error) => !error.includes("ERR_INVALID_URL")),
      "failed image fixture should only report the expected browser image error",
    ).toEqual([]);
  });
});

test.describe("member workout and BrodigyAI responsive journeys", () => {
  test("workout renders the current Tuesday queue and progression suggestion without writing", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/workout`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Today's workout", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("WORKOUT QUEUE", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Long Name Goblet Squat", { exact: true }).first()).toBeVisible();
    await stabilizeVisualPage(page);

    const suggestionButton = page.getByRole("button", {
      name: "View progression suggestion",
      exact: true,
    });
    await expect(suggestionButton).toBeVisible();
    await tapAtPaddingEdge(page, suggestionButton, "workout progression suggestion");
    await expect(page.getByText(/Suggested next target:/, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/small load increase is ready/, { exact: false })).toBeVisible();

    const setControl = page.getByRole("button", {
      name: /Complete Long Name Goblet Squat set 2/,
      exact: true,
    });
    await expect(setControl).toBeVisible();
    await setControl.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(setControl, "workout current set control");
    await expect(setControl).toBeInViewport();
    await hitTest(setControl, "workout current set control");

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "workout-queue", audit, scroll);
    softAudit(audit);
    expect(state.mutations, "workout read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("workout presents a progression load failure as a retryable error", async ({ page }) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "USER", {
      progressionSuggestionError: true,
    });
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/workout`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Today's workout", { exact: true })).toBeVisible({ timeout: 30_000 });

    const suggestionButton = page.getByRole("button", {
      name: "View progression suggestion",
      exact: true,
    });
    await tapAtPaddingEdge(page, suggestionButton, "workout progression error");
    await expect(
      page.getByText("Unable to load the progression suggestion. Try again.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/No history-based progression suggestion is available/, {
        exact: false,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Retry suggestion", exact: true }),
    ).toBeEnabled();

    const viewport = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth + 1);
    expect(
      state.consoleErrors.every((error) =>
        error.includes("status of 503 (Service Unavailable)"),
      ),
      "the fixture failure should be the only console error",
    ).toBe(true);
    state.consoleErrors.length = 0;
    assertFixtureClosed(state);
  });

  test("workout plans opens a draft editor, exposes day pills and set controls, then cancels", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/workout-plans`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Workout plans", { exact: true })).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    const smallViewport = (page.viewportSize()?.width ?? 0) < 360;

    const pageBack = page.getByRole("button", { name: "Back to today's workout", exact: true });
    const pageBackBox = await pageBack.boundingBox();
    expect(pageBackBox, "workout plans back bounds").not.toBeNull();
    if (smallViewport) {
      expect(pageBackBox?.width ?? 0, "small workout plans back width").toBeGreaterThanOrEqual(44);
      expect(pageBackBox?.height ?? 0, "small workout plans back height").toBeGreaterThanOrEqual(44);
    } else {
      expect(pageBackBox?.width ?? 0, "default workout plans back width").toBeCloseTo(38, 0);
      expect(pageBackBox?.height ?? 0, "default workout plans back height").toBeCloseTo(38, 0);
    }

    const create = page.getByRole("button", { name: "Create Personal Plan", exact: true });
    await expect(create).toBeVisible();
    await tapAtPaddingEdge(page, create, "create personal workout plan");
    await expect(page.getByText("Create plan", { exact: true })).toBeVisible();

    const monday = page.getByRole("button", { name: "Mon selected", exact: true });
    const tuesday = page.getByRole("button", { name: "Tue not selected", exact: true });
    await expect(monday).toBeVisible();
    await expect(tuesday).toBeVisible();
    const dayPills = page.getByRole("button", {
      name: /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:selected|not selected)$/,
      exact: true,
    });
    await expect(dayPills, "all workout plan day pills").toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      const box = await dayPills.nth(index).boundingBox();
      expect(box, `workout plan day pill ${index + 1} bounds`).not.toBeNull();
      if (smallViewport) {
        expect(box?.width ?? 0, `workout plan day pill ${index + 1} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `workout plan day pill ${index + 1} height`).toBeGreaterThanOrEqual(44);
      } else {
        expect(box?.height ?? 0, `default workout plan day pill ${index + 1} height`).toBeCloseTo(38, 0);
      }
    }
    await hitTest(monday, "selected Monday day pill");
    await hitTest(tuesday, "unselected Tuesday day pill");
    await tapAtPaddingEdge(page, tuesday, "Tuesday day pill");

    const search = page.getByRole("textbox", { name: "Search exercise catalog", exact: true });
    await expect(search).toBeVisible();
    await search.fill("Goblet");
    const exercise = page.getByRole("button", { name: /Add Long Name Goblet Squat/, exact: true });
    await expect(exercise).toBeVisible();
    await tapAtPaddingEdge(page, exercise, "draft exercise catalog item");
    await expect(page.getByText("Long Name Goblet Squat", { exact: true }).last()).toBeVisible();

    const stepperLabels = ["Increase Sets", "Decrease Sets", "Increase Reps", "Decrease Reps"];
    for (const label of stepperLabels) {
      const control = page.getByRole("button", { name: label, exact: true });
      await expect(control, `${label} visible`).toBeVisible();
      await control.scrollIntoViewIfNeeded();
      await waitForStableVisibleGeometry(control, `${label} geometry`);
      const box = await control.boundingBox();
      expect(box, `${label} bounds`).not.toBeNull();
      if (smallViewport) {
        expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(44);
      } else {
        expect(box?.width ?? 0, `default ${label} width`).toBeCloseTo(14, 0);
        expect(box?.height ?? 0, `default ${label} height`).toBeCloseTo(14, 0);
      }
      await hitTest(control, `draft exercise ${label}`);
    }
    const increaseSets = page.getByRole("button", { name: "Increase Sets", exact: true });
    const decreaseSets = page.getByRole("button", { name: "Decrease Sets", exact: true });
    const increaseReps = page.getByRole("button", { name: "Increase Reps", exact: true });
    const decreaseReps = page.getByRole("button", { name: "Decrease Reps", exact: true });
    await expect(page.getByText("3 Sets", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, increaseSets, "draft exercise Increase Sets state change");
    await expect(page.getByText("4 Sets", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, decreaseSets, "draft exercise Decrease Sets state restore");
    await expect(page.getByText("3 Sets", { exact: true })).toBeVisible();
    await expect(page.getByText("10 Reps", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, increaseReps, "draft exercise Increase Reps state change");
    await expect(page.getByText("11 Reps", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, decreaseReps, "draft exercise Decrease Reps state restore");
    await expect(page.getByText("10 Reps", { exact: true })).toBeVisible();
    const setsText = page.getByText("3 Sets", { exact: true });
    const setsFontSize = await setsText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(setsFontSize, "workout plan stepper text size").toBeCloseTo(smallViewport ? 12 : 9.5, 1);
    if (!smallViewport) {
      const rest = page.getByRole("button", { name: /Edit Long Name Goblet Squat rest timer/, exact: true });
      const rowBoxes = await Promise.all([
        increaseSets.locator("xpath=..").boundingBox(),
        increaseReps.locator("xpath=..").boundingBox(),
        rest.boundingBox(),
      ]);
      const rowTops = rowBoxes.filter((box): box is NonNullable<typeof box> => Boolean(box)).map((box) => box.y);
      expect(rowTops, "default workout controls row grouping").toHaveLength(3);
      expect(Math.max(...rowTops) - Math.min(...rowTops), "default workout controls stay on one row").toBeLessThanOrEqual(1);
    }

    const openAudit = await auditConventionalLayout(page);
    const openScroll = await inspectAndScroll(page);
    const stepperGeometry = await page.locator("[aria-label]").evaluateAll((elements) =>
      elements
        .map((element) => {
          const label = element.getAttribute("aria-label") ?? "";
          const rect = element.getBoundingClientRect();
          return {
            height: Math.round(rect.height),
            label,
            width: Math.round(rect.width),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
          };
        })
        .filter(({ label }) => /^(?:Increase|Decrease) (?:Sets|Reps)$/.test(label)),
    );
    expect(stepperGeometry, "workout plan stepper controls collected").toHaveLength(4);
    for (const control of stepperGeometry) {
      if (smallViewport) {
        expect(control.width, `${control.label} recorded width`).toBeGreaterThanOrEqual(44);
        expect(control.height, `${control.label} recorded height`).toBeGreaterThanOrEqual(44);
      } else {
        expect(control.width, `default ${control.label} recorded width`).toBeCloseTo(14, 0);
        expect(control.height, `default ${control.label} recorded height`).toBeCloseTo(14, 0);
      }
    }
    const stepperEvidence = JSON.stringify(
      {
        route: await page.url(),
        viewport: page.viewportSize(),
        controls: stepperGeometry,
        minimumRecommendedTouchTarget: smallViewport ? 44 : null,
      },
      null,
      2,
    );
    const stepperEvidencePath = resolve(
      process.cwd(),
      ".artifacts",
      "playwright",
      "mobile-responsive",
      `${evidenceName(testInfo, "workout-plan-stepper-geometry")}.json`,
    );
    await mkdir(resolve(process.cwd(), ".artifacts", "playwright", "mobile-responsive"), {
      recursive: true,
    });
    await writeFile(stepperEvidencePath, stepperEvidence);
    await testInfo.attach("workout-plan-stepper-geometry.json", {
      body: stepperEvidence,
      contentType: "application/json",
    });
    await saveEvidence(page, testInfo, state, "workout-plans-editor-open", openAudit, openScroll);
    softAudit(openAudit);

    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toBeVisible();
    await cancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(cancel, "workout plan editor Cancel");
    await tapAtPaddingEdge(page, cancel, "workout plan editor Cancel");
    await expect(page.getByText("Workout plans", { exact: true })).toBeVisible();
    expect(state.mutations, "workout plan draft journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("chatbot loads a populated session and keeps an editable draft without sending", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state);
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/chatbot?sessionId=44444444-4444-4444-8444-444444444444`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Progress check-in", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Nice work\. Keep your next session steady/, { exact: false })).toBeVisible();
    await stabilizeVisualPage(page);

    const input = page.getByRole("textbox", { name: "Type a message", exact: true });
    await expect(input).toBeVisible();
    await input.fill("Please review my long responsive strength plan before tomorrow's session.");
    await expect(input).toHaveValue("Please review my long responsive strength plan before tomorrow's session.");
    const send = page.getByRole("button", { name: "Send message", exact: true });
    await expect(send).toBeVisible();
    await expect(send).toBeEnabled();
    await hitTest(send, "BrodigyAI Send message draft control");

    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "chatbot-draft", audit, scroll);
    softAudit(audit);
    expect(state.mutations, "chatbot draft journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });
});

for (const routeCase of COACH_ROUTE_MANIFEST) {
  test(`coach ${routeCase.name} populated responsive render`, async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}${routeCase.path}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(coachHeaderName(routeCase.path), { exact: true }).first(),
      `${routeCase.name} complete header title`,
    ).toBeVisible({ timeout: 30_000 });
    const marker = page.getByText(routeCase.marker, { exact: true }).first();
    await expect(marker, `${routeCase.name} populated primary marker`).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const scroll = await inspectAndScroll(page);
    const bottomControl = page.getByRole("button", {
      name:
        routeCase.bottomControl === COACH_CLIENT_NAME
          ? coachClientAccessibleName()
          : routeCase.bottomControl,
      exact: routeCase.bottomControl !== COACH_CLIENT_NAME,
    }).first();
    await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
    await bottomControl.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(bottomControl, `${routeCase.name} bottom primary control`);
    await expect(bottomControl, `${routeCase.name} bottom primary control bounds`).toBeInViewport();
    await hitTest(bottomControl, `${routeCase.name} bottom primary control`);

    if (routeCase.expectedScroll && scroll.scrollHeight > scroll.clientHeight + 4) {
      expect(scroll.after, `${routeCase.name} actual scroll delta`).toBeGreaterThan(scroll.before + 1);
      expect(scroll.visible, `${routeCase.name} scroll owner visible`).toBe(true);
      expect(scroll.bounded, `${routeCase.name} scroll owner bounded`).toBe(true);
      expect(["auto", "scroll", "overlay"], `${routeCase.name} computed scroll owner overflow`).toContain(scroll.overflowY);
    }

    const audit = await auditConventionalLayout(page);
    const nonInteractiveText = await inspectNonInteractiveText(page);
    await saveEvidence(page, testInfo, state, routeCase.name, audit, scroll, "COACH");
    softAudit(audit);
    expect.soft(nonInteractiveText, `${routeCase.name} noninteractive text overflow`).toEqual([]);
    expect(state.unhandled, `${routeCase.name} unexpected API requests`).toEqual([]);
    expect(state.requestFailures, `${routeCase.name} failed API requests`).toEqual([]);
    expect(state.pageErrors, `${routeCase.name} page errors`).toEqual([]);
    expect(state.consoleErrors, `${routeCase.name} console errors`).toEqual([]);
  });
}

test.describe("coach core responsive journeys", () => {
  test("coach appointments opens a populated session detail and closes without a write", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings?coachView=appointments`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Sessions", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    const appointment = page.getByRole("button", { name: coachClientAccessibleName() }).first();
    await expect(appointment).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    await tapAtPaddingEdge(page, appointment, "coach appointment card");
    await expect(page.getByText("Coach Session Details", { exact: true })).toBeVisible();
    await expect(page.getByText(/SESSION REPORT|PAYMENT/, { exact: false }).first()).toBeVisible();
    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-appointment-detail", audit, scroll, "COACH");
    softAudit(audit);

    const close = page.getByRole("button", { name: "Close", exact: true }).last();
    await close.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(close, "coach appointment detail Close");
    await tapAtPaddingEdge(page, close, "coach appointment detail Close");
    await expect(page.getByText("Coach Session Details", { exact: true })).toBeHidden();
    expect(state.mutations, "coach appointment detail read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("coach client detail exposes four tabs and existing program editor without saving", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings?coachView=clients`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Clients", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    const clientCard = page.getByRole("button", { name: coachClientAccessibleName() }).first();
    await expect(clientCard).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    await tapAtPaddingEdge(page, clientCard, "coach client card");
    await expect(page.getByText(COACH_CLIENT_NAME, { exact: true }).last()).toBeVisible();

    const tabNames = ["Overview", "Schedule", "Workout", "Feedback"] as const;
    const tabContent: Record<(typeof tabNames)[number], string> = {
      Overview: "COACHING OVERVIEW",
      Schedule: "CLIENT PAID SESSIONS",
      Workout: "CLIENT WORKOUT PROGRAMS",
      Feedback: "CLIENT FEEDBACK",
    };
    const tabGeometry: Array<{ height: number; label: string; width: number; x: number; y: number }> = [];
    for (const tabName of tabNames) {
      const tab = page.getByRole("tab", { name: `${tabName} client detail tab`, exact: true });
      await expect(tab).toBeVisible();
      await tab.scrollIntoViewIfNeeded();
      await waitForStableVisibleGeometry(tab, `${tabName} client detail tab`);
      await tapAtPaddingEdge(page, tab, `${tabName} client detail tab`);
      await expect(page.getByText(tabContent[tabName], { exact: true })).toBeVisible();
      const box = await tab.boundingBox();
      expect(box, `${tabName} client detail tab bounds`).not.toBeNull();
      if (box) {
        tabGeometry.push({
          height: Math.round(box.height),
          label: tabName,
          width: Math.round(box.width),
          x: Math.round(box.x),
          y: Math.round(box.y),
        });
      }
      const tabPath = resolve(
        process.cwd(),
        ".artifacts",
        "playwright",
        "mobile-responsive",
        `${evidenceName(testInfo, `coach-client-${tabName.toLowerCase()}`)}.png`,
      );
      await mkdir(resolve(process.cwd(), ".artifacts", "playwright", "mobile-responsive"), {
        recursive: true,
      });
      await page.screenshot({ path: tabPath, fullPage: false });
      await testInfo.attach(`coach-client-${tabName.toLowerCase()}.png`, {
        path: tabPath,
        contentType: "image/png",
      });
    }

    const smallViewport = (page.viewportSize()?.width ?? 0) < 360;
    const allTabs = tabNames.map((tabName) =>
      page.getByRole("tab", { name: `${tabName} client detail tab`, exact: true }),
    );
    await allTabs[0].scrollIntoViewIfNeeded();
    const layoutBoxes = await Promise.all(allTabs.map((tab) => tab.boundingBox()));
    const tabRows = new Set(
      layoutBoxes
        .filter((box): box is NonNullable<typeof box> => Boolean(box))
        .map((box) => Math.round(box.y)),
    );
    if (smallViewport) {
      expect(tabRows.size, "compact client detail tabs wrap into rows").toBeGreaterThan(1);
      for (const [index, box] of layoutBoxes.entries()) {
        expect(box, `${tabNames[index]} compact tab bounds`).not.toBeNull();
        expect(box?.width ?? 0, `${tabNames[index]} compact tab width`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `${tabNames[index]} compact tab height`).toBeGreaterThanOrEqual(44);
      }
    } else {
      expect(tabRows.size, "default client detail tabs stay on one row").toBe(1);
      for (const [index, box] of layoutBoxes.entries()) {
        expect(box, `${tabNames[index]} default tab bounds`).not.toBeNull();
        expect(box?.height ?? 0, `${tabNames[index]} default tab height`).toBeCloseTo(42, 0);
      }
    }

    const tabEvidence = JSON.stringify(
      { route: await page.url(), role: "COACH", tabs: tabGeometry },
      null,
      2,
    );
    await testInfo.attach("coach-client-tabs.json", {
      body: tabEvidence,
      contentType: "application/json",
    });

    const workoutTab = page.getByRole("tab", { name: "Workout client detail tab", exact: true });
    await tapAtPaddingEdge(page, workoutTab, "Workout client detail tab");
    await expect(page.getByText("CLIENT WORKOUT PROGRAMS", { exact: true })).toBeVisible();
    const editProgram = page.getByRole("button", {
      name: "Edit Jordan's Long Responsive Coach Assigned Program",
      exact: true,
    });
    await expect(editProgram).toBeVisible();
    await tapAtPaddingEdge(page, editProgram, "existing client workout program");
    await expect(page.getByText("Edit client program", { exact: true })).toBeVisible();
    const dayPills = page.getByRole("button", {
      name: /^(?:Week \d+ )?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:selected|not selected)$/,
      exact: true,
    });
    await expect(dayPills, "all coach program day pills").toHaveCount(7);
    await dayPills.first().scrollIntoViewIfNeeded();
    for (let index = 0; index < 7; index += 1) {
      const box = await dayPills.nth(index).boundingBox();
      expect(box, `coach program day pill ${index + 1} bounds`).not.toBeNull();
      if (smallViewport) {
        expect(box?.width ?? 0, `coach program day pill ${index + 1} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `coach program day pill ${index + 1} height`).toBeGreaterThanOrEqual(44);
      } else {
        expect(box?.height ?? 0, `default coach program day pill ${index + 1} height`).toBeCloseTo(36, 0);
      }
    }
    const stepperLabels = ["Increase Sets", "Decrease Sets", "Increase Reps", "Decrease Reps"];
    const stepperGeometry = [] as Array<{ height: number; label: string; width: number; x: number; y: number }>;
    for (const label of stepperLabels) {
      const control = page.getByRole("button", { name: label, exact: true });
      await expect(control).toBeVisible();
      await control.scrollIntoViewIfNeeded();
      await waitForStableVisibleGeometry(control, `${label} geometry`);
      const box = await control.boundingBox();
      expect(box, `${label} bounds`).not.toBeNull();
      if (smallViewport) {
        expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(44);
      } else {
        expect(box?.width ?? 0, `default ${label} width`).toBeCloseTo(18, 0);
        expect(box?.height ?? 0, `default ${label} height`).toBeCloseTo(18, 0);
      }
      await hitTest(control, `coach program ${label}`);
      if (box) {
        stepperGeometry.push({
          height: Math.round(box.height),
          label,
          width: Math.round(box.width),
          x: Math.round(box.x),
          y: Math.round(box.y),
        });
      }
    }
    expect(stepperGeometry).toHaveLength(4);
    const increaseSets = page.getByRole("button", { name: "Increase Sets", exact: true });
    const decreaseSets = page.getByRole("button", { name: "Decrease Sets", exact: true });
    const increaseReps = page.getByRole("button", { name: "Increase Reps", exact: true });
    const decreaseReps = page.getByRole("button", { name: "Decrease Reps", exact: true });
    await expect(page.getByText("3 Sets", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, increaseSets, "coach program Increase Sets state change");
    await expect(page.getByText("4 Sets", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, decreaseSets, "coach program Decrease Sets state restore");
    await expect(page.getByText("3 Sets", { exact: true })).toBeVisible();
    await expect(page.getByText("10 Reps", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, increaseReps, "coach program Increase Reps state change");
    await expect(page.getByText("11 Reps", { exact: true })).toBeVisible();
    await tapAtPaddingEdge(page, decreaseReps, "coach program Decrease Reps state restore");
    await expect(page.getByText("10 Reps", { exact: true })).toBeVisible();
    const coachSetsText = page.getByText("3 Sets", { exact: true });
    const coachSetsFontSize = await coachSetsText.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(coachSetsFontSize, "coach program stepper text size").toBeCloseTo(smallViewport ? 12 : 9.5, 1);
    if (!smallViewport) {
      const rest = page.getByRole("button", { name: /Edit Long Name Goblet Squat rest timer/, exact: true });
      const rowBoxes = await Promise.all([
        increaseSets.locator("xpath=..").boundingBox(),
        increaseReps.locator("xpath=..").boundingBox(),
        rest.boundingBox(),
      ]);
      const rowTops = rowBoxes.filter((box): box is NonNullable<typeof box> => Boolean(box)).map((box) => box.y);
      expect(rowTops, "default coach controls row grouping").toHaveLength(3);
      expect(Math.max(...rowTops) - Math.min(...rowTops), "default coach controls stay on one row").toBeLessThanOrEqual(1);
    }
    const editorEvidence = JSON.stringify(
      {
        route: await page.url(),
        role: "COACH",
        controls: stepperGeometry,
        minimumRecommendedTouchTarget: smallViewport ? 44 : null,
      },
      null,
      2,
    );
    await testInfo.attach("coach-client-program-stepper-geometry.json", {
      body: editorEvidence,
      contentType: "application/json",
    });
    const editorAudit = await auditConventionalLayout(page);
    const editorScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-client-program-editor", editorAudit, editorScroll, "COACH");
    softAudit(editorAudit);

    const back = page.getByRole("button", { name: "Back from workout program editor", exact: true });
    await back.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(back, "coach workout program editor Back");
    await tapAtPaddingEdge(page, back, "coach workout program editor Back");
    await expect(page.getByText("CLIENT WORKOUT PROGRAMS", { exact: true })).toBeVisible();
    const close = page.getByRole("button", { name: "Close client details", exact: true });
    await close.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(close, "coach client detail CLOSE");
    await tapAtPaddingEdge(page, close, "coach client detail CLOSE");
    await expect(page.getByText("CLIENT WORKOUT PROGRAMS", { exact: true })).toBeHidden();
    expect(state.mutations, "coach client detail read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("coach earnings keeps populated totals and resolved sessions readable", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/bookings?coachView=earnings`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Earnings", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("EARNINGS SUMMARY", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Total Earnings This Month", { exact: true })).toBeVisible();
    await expect(page.getByText(/PHP\s+[1-9]/).first()).toBeVisible();
    await expect(page.getByText(COACH_CLIENT_NAME, { exact: true }).first()).toBeVisible();
    await stabilizeVisualPage(page);
    const scroll = await inspectAndScroll(page);
    const bottomControl = page.getByRole("button", { name: coachClientAccessibleName() }).first();
    await bottomControl.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(bottomControl, "coach earnings resolved session");
    await hitTest(bottomControl, "coach earnings resolved session");
    const audit = await auditConventionalLayout(page);
    await saveEvidence(page, testInfo, state, "coach-earnings-summary", audit, scroll, "COACH");
    softAudit(audit);
    expect(state.mutations, "coach earnings read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });
});

for (const routeCase of COACH_SHARED_ROUTE_MANIFEST) {
  test(`coach shared ${routeCase.name} populated responsive render`, async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}${routeCase.path}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(coachSharedHeaderName(routeCase.path), { exact: true }).first(),
      `${routeCase.name} complete header title`,
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(routeCase.marker, { exact: true }).first(),
      `${routeCase.name} populated primary marker`,
    ).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const bottomControl = routeCase.bottomControl === "Type a message"
      ? page.getByRole("textbox", { name: routeCase.bottomControl, exact: true })
      : page.getByRole("button", { name: routeCase.bottomControl, exact: false }).first();
    const isFixedQuickActionsControl = routeCase.bottomControl === "Open quick actions menu";
    if (isFixedQuickActionsControl) {
      await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
      await expect(bottomControl, `${routeCase.name} bottom primary control bounds`).toBeInViewport();
      await hitTest(bottomControl, `${routeCase.name} bottom primary control`);
    } else {
      await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
      await bottomControl.scrollIntoViewIfNeeded();
      await waitForStableVisibleGeometry(bottomControl, `${routeCase.name} bottom primary control`);
      await expect(bottomControl, `${routeCase.name} bottom primary control bounds`).toBeInViewport();
    }
    if (routeCase.bottomControl === "Type a message") {
      await bottomControl.fill("Coach shared responsive draft without sending.");
      await expect(bottomControl).toHaveValue("Coach shared responsive draft without sending.");
    }
    if (!isFixedQuickActionsControl) {
      await hitTest(bottomControl, `${routeCase.name} bottom primary control`);
    }

    const scroll = await inspectAndScroll(page);
    if (routeCase.expectedScroll && scroll.scrollHeight > scroll.clientHeight + 4) {
      expect(scroll.after, `${routeCase.name} actual scroll delta`).toBeGreaterThan(scroll.before + 1);
      expect(scroll.visible, `${routeCase.name} scroll owner visible`).toBe(true);
      expect(scroll.bounded, `${routeCase.name} scroll owner bounded`).toBe(true);
      expect(["auto", "scroll", "overlay"], `${routeCase.name} computed scroll owner overflow`).toContain(scroll.overflowY);
    }
    if (isFixedQuickActionsControl && scroll.after > scroll.before + 1) {
      await page.evaluate(() => {
        const owner = document.querySelector<HTMLElement>(
          '[data-mobile-responsive-scroll-owner="true"]',
        );
        if (owner) owner.scrollTop = Math.max(0, owner.scrollTop - 24);
      });
      await expect.poll(async () => {
        const box = await bottomControl.boundingBox();
        return Boolean(box && box.y >= 0 && box.y + box.height <= (page.viewportSize()?.height ?? 0));
      }, `${routeCase.name} quick actions reveal after reverse scroll`).toBe(true);
      await hitTest(bottomControl, `${routeCase.name} bottom primary control after reverse scroll`);
    }

    const audit = await auditConventionalLayout(page);
    const nonInteractiveText = await inspectNonInteractiveText(page);
    await saveEvidence(page, testInfo, state, routeCase.name, audit, scroll, "COACH");
    softAudit(audit);
    expect.soft(nonInteractiveText, `${routeCase.name} noninteractive text overflow`).toEqual([]);
    expect(state.unhandled, `${routeCase.name} unexpected API requests`).toEqual([]);
    expect(state.requestFailures, `${routeCase.name} failed API requests`).toEqual([]);
    expect(state.pageErrors, `${routeCase.name} page errors`).toEqual([]);
    expect(state.consoleErrors, `${routeCase.name} console errors`).toEqual([]);
  });
}

for (const routeCase of AUTH_ROUTE_MANIFEST) {
  test(`auth ${routeCase.name} populated draft responsive render`, async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "ANON");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}${routeCase.path}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(routeCase.marker, { exact: true }).first(),
      `${routeCase.name} primary marker`,
    ).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);

    const configuredViewport = page.viewportSize();
    expect(configuredViewport, `${routeCase.name} configured viewport`).not.toBeNull();
    if (configuredViewport) {
      await page.setViewportSize({ width: configuredViewport.width, height: 360 });
      const focusedDraft = routeCase.name === "login"
        ? page.getByRole("textbox", { name: "Email", exact: true }).first()
        : page.getByRole("textbox", { name: "First Name", exact: true });
      await focusedDraft.fill(routeCase.name === "login" ? "responsive-member@fittrack.test" : "Jordan");
      await focusedDraft.scrollIntoViewIfNeeded();
      await expect(focusedDraft).toBeInViewport();
      await expect(focusedDraft).toBeEditable();
      await page.setViewportSize(configuredViewport);
      await expect(focusedDraft).toHaveValue(routeCase.name === "login" ? "responsive-member@fittrack.test" : "Jordan");
    }

    if (routeCase.name === "login") {
      await page.getByLabel("Password", { exact: true }).fill("FitTrack#2026");
    } else {
      await page.getByRole("textbox", { name: "Last Name", exact: true }).fill("Responsive");
      await page.getByRole("textbox", { name: "Email", exact: true }).fill("register-responsive@fittrack.test");
      await page.getByRole("textbox", { name: "Phone Number", exact: true }).fill("9171234567");
      await page.getByLabel("Password", { exact: true }).fill("FitTrack#2026");
      await expect(page.getByText("Password Requirements:", { exact: true }).first()).toBeVisible();
      await page.getByLabel("Confirm Password", { exact: true }).fill("FitTrack#2026");
    }

    const scroll = await inspectAndScroll(page);
    const bottomControl = page.getByRole("button", { name: routeCase.bottomControl, exact: true });
    await expect(bottomControl, `${routeCase.name} bottom primary control`).toBeVisible();
    await bottomControl.scrollIntoViewIfNeeded();
    if (await bottomControl.isEnabled()) {
      await waitForStableVisibleGeometry(bottomControl, `${routeCase.name} bottom primary control`);
    }
    await expect(bottomControl).toBeInViewport();
    if (await bottomControl.isEnabled()) {
      await hitTest(bottomControl, `${routeCase.name} bottom primary control`);
    }
    const audit = await auditConventionalLayout(page);
    const nonInteractiveText = await inspectNonInteractiveText(page);
    await saveEvidence(page, testInfo, state, routeCase.name, audit, scroll, "ANON");
    softAudit(audit);
    expect.soft(nonInteractiveText, `${routeCase.name} noninteractive text overflow`).toEqual([]);
    expect(state.mutations, `${routeCase.name} draft journey should not write`).toEqual([]);
    expect(state.unhandled, `${routeCase.name} unexpected API requests`).toEqual([]);
    expect(state.requestFailures, `${routeCase.name} failed API requests`).toEqual([]);
    expect(state.pageErrors, `${routeCase.name} page errors`).toEqual([]);
    expect(state.consoleErrors, `${routeCase.name} console errors`).toEqual([]);
  });
}

test.describe("coach shared profile and auth overlays", () => {
  test("coach profile edit and availability dialogs expose fields and reachable cancel actions", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "COACH");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Profile", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("COACH SUMMARY", { exact: true })).toBeVisible();
    await stabilizeVisualPage(page);

    const edit = page.getByRole("button", { name: /^Edit Coach Profile/ }).first();
    await expect(edit).toBeVisible();
    await edit.scrollIntoViewIfNeeded();
    await tapAtPaddingEdge(page, edit, "Edit Coach Profile");
    const coachTab = page.getByRole("tab", { name: "Coach profile tab", exact: true });
    await expect(coachTab).toBeVisible();
    await tapAtPaddingEdge(page, coachTab, "Coach profile tab");
    await expect(page.getByRole("textbox", { name: "Hourly Rate", exact: true })).toHaveValue("1200");
    await expect(page.getByRole("textbox", { name: "Certifications", exact: true })).toHaveValue("NSCA-CPT, Mobility Specialist");
    await expect(page.getByRole("textbox", { name: "Bio", exact: true })).toHaveValue(/Part-time coach/);
    const specialtySearch = page.getByRole("textbox", { name: "Search or add coach specialties", exact: true });
    await specialtySearch.fill("Strength");
    await expect(page.getByRole("button", { name: /^Strength Coaching With A Long Specialty Name/ })).toBeVisible();
    const editAudit = await auditConventionalLayout(page);
    const editScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-profile-edit", editAudit, editScroll, "COACH");
    softAudit(editAudit);
    const editCancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await editCancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(editCancel, "coach profile edit Cancel");
    await tapAtPaddingEdge(page, editCancel, "coach profile edit Cancel");
    await expect(page.getByRole("tab", { name: "Coach profile tab", exact: true })).toBeHidden();

    const addAvailability = page.getByRole("button", { name: "Add availability slot", exact: true });
    await addAvailability.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(addAvailability, "Add availability slot");
    await tapAtPaddingEdge(page, addAvailability, "Add availability slot");
    await expect(page.getByText("Add Availability", { exact: true })).toBeVisible();
    const tue = page.getByText("Tue", { exact: true }).last().locator("..");
    await tue.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(tue, "availability Tuesday");
    const tueBox = await tue.boundingBox();
    expect(tueBox, "availability Tuesday touch target bounds").not.toBeNull();
    const smallViewport = (page.viewportSize()?.width ?? 0) < 360;
    if (smallViewport) {
      expect(tueBox?.height ?? 0, "availability Tuesday touch target height").toBeGreaterThanOrEqual(44);
    } else {
      expect(tueBox?.height ?? 0, "default availability Tuesday height").toBeCloseTo(37, 0);
    }
    await tapAtPaddingEdge(page, tue, "availability Tuesday");
    const addAvailabilityAudit = await auditConventionalLayout(page);
    const addAvailabilityScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-add-availability", addAvailabilityAudit, addAvailabilityScroll, "COACH");
    const startTime = page.getByRole("button", { name: "Start Time", exact: true });
    await tapAtPaddingEdge(page, startTime, "availability Start Time");
    await expect(page.getByText("Choose Availability Time", { exact: true })).toBeVisible();
    const timeAudit = await auditConventionalLayout(page);
    const timeScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-availability-time-picker", timeAudit, timeScroll, "COACH");
    softAudit(timeAudit);
    const timeClose = page.getByRole("button", { name: "Close Choose Availability Time", exact: true });
    await timeClose.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(timeClose, "availability time Close");
    await tapAtPaddingEdge(page, timeClose, "availability time Close");
    await expect(page.getByText("Choose Availability Time", { exact: true })).toBeHidden();
    const availabilityCancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await availabilityCancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(availabilityCancel, "new availability Cancel");
    await tapAtPaddingEdge(page, availabilityCancel, "new availability Cancel");
    await expect(page.getByText("Add Availability", { exact: true })).toBeHidden();

    const existingSlot = page.getByRole("button", {
      name: /^Tue,\s+08:00 AM - 12:00 PM,\s+Active/,
      exact: false,
    });
    await existingSlot.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(existingSlot, "existing availability slot");
    await tapAtPaddingEdge(page, existingSlot, "existing availability slot");
    await expect(page.getByText("Edit Availability", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Update", exact: true })).toBeVisible();
    const editAvailabilityAudit = await auditConventionalLayout(page);
    const editAvailabilityScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "coach-edit-availability", editAvailabilityAudit, editAvailabilityScroll, "COACH");
    const existingCancel = page.getByRole("button", { name: "Cancel", exact: true }).last();
    await existingCancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(existingCancel, "existing availability Cancel");
    await tapAtPaddingEdge(page, existingCancel, "existing availability Cancel");
    expect(state.mutations, "coach profile availability read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("login keeps credentials editable, toggles password visibility, and cancels forgot password", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "ANON");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("FitTrack", { exact: true })).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    const email = page.getByRole("textbox", { name: "Email", exact: true }).first();
    const password = page.getByLabel("Password", { exact: true }).first();
    await email.fill("forgot-responsive@fittrack.test");
    await password.fill("FitTrack#2026");
    const showPassword = page.getByRole("button", { name: "Show password", exact: true });
    await tapAtPaddingEdge(page, showPassword, "login Show password");
    await expect(page.getByRole("button", { name: "Hide password", exact: true })).toBeVisible();
    const forgot = page.getByRole("button", { name: "Forgot Password?", exact: true });
    await tapAtPaddingEdge(page, forgot, "Forgot Password");
    await expect(page.getByText("Forgot Password", { exact: true })).toBeVisible();
    const forgotEmail = page.getByRole("textbox", { name: "Email", exact: true }).last();
    await forgotEmail.fill("forgot-responsive@fittrack.test");
    const forgotAudit = await auditConventionalLayout(page);
    const forgotScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "login-forgot-password-open", forgotAudit, forgotScroll, "ANON");
    const forgotCancel = page.getByRole("button", { name: "CANCEL", exact: true });
    await forgotCancel.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(forgotCancel, "Forgot Password CANCEL");
    await tapAtPaddingEdge(page, forgotCancel, "Forgot Password CANCEL");
    await expect(page.getByText("Forgot Password", { exact: true })).toBeHidden();
    const audit = await auditConventionalLayout(page);
    const scroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "login-forgot-password", audit, scroll, "ANON");
    softAudit(audit);
    expect(state.mutations, "login forgot password read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });

  test("register exposes password requirements and scrollable terms that close with NOT NOW", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMemberResponsiveFixtures(page, state, "ANON");
    await page.goto(`${MOBILE_RESPONSIVE_BASE_URL}/register`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Create Account", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await stabilizeVisualPage(page);
    await page.getByRole("textbox", { name: "First Name", exact: true }).fill("Jordan");
    await page.getByRole("textbox", { name: "Last Name", exact: true }).fill("Responsive");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("register-responsive@fittrack.test");
    await page.getByLabel("Password", { exact: true }).fill("FitTrack#2026");
    await expect(page.getByText("Password Requirements:", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Confirm Password", { exact: true }).fill("FitTrack#2026");
    const termsLink = page.getByRole("button", { name: "Terms of Service", exact: true });
    await termsLink.scrollIntoViewIfNeeded();
    await tapAtPaddingEdge(page, termsLink, "register Terms of Service");
    await expect(page.getByText("Terms & Data Privacy", { exact: true })).toBeVisible();
    const privacyNotice = page.getByText(/^Philippine Data Privacy Notice$/i).first();
    await privacyNotice.scrollIntoViewIfNeeded();
    await expect(privacyNotice).toBeVisible();
    const termsAudit = await auditConventionalLayout(page);
    const termsScroll = await inspectAndScroll(page);
    await saveEvidence(page, testInfo, state, "register-terms-open", termsAudit, termsScroll, "ANON");
    const notNow = page.getByRole("button", { name: "NOT NOW", exact: true });
    await notNow.scrollIntoViewIfNeeded();
    await waitForStableVisibleGeometry(notNow, "register terms NOT NOW");
    await expect(notNow).toBeInViewport();
    await tapAtPaddingEdge(page, notNow, "register terms NOT NOW");
    await expect(page.getByText("Terms & Data Privacy", { exact: true })).toBeHidden();
    const audit = await auditConventionalLayout(page);
    await saveEvidence(page, testInfo, state, "register-terms", audit, termsScroll, "ANON");
    softAudit(audit);
    expect(state.mutations, "register terms read journey should not write").toEqual([]);
    assertFixtureClosed(state);
  });
});
