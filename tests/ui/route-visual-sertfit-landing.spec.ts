import { expect, test } from "@playwright/test";

import {
  assertCleanLayout,
  captureSertFitEvidence,
  SERTFIT_HYDRATED_SELECTOR,
  SERTFIT_REGIONS,
  waitForSertFitHydrated,
  waitForSertFitReady,
} from "./sertfit-landing-reference";

const SECTION_ANCHORS = ["#training", "#spaces", "#team", "#start", "#visit"] as const;

test.describe("public SertFit landing", () => {
  test("renders the complete public route with loaded assets and bounded layout", async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-landing-region='hero']")).toBeVisible();

    for (const region of SERTFIT_REGIONS) {
      await expect(
        page.locator(`[data-landing-region='${region}']`),
        `expected one SertFit ${region} region`,
      ).toHaveCount(1);
    }

    const images = await page.locator("img").evaluateAll((elements) =>
      elements.map((element) => ({ src: (element as HTMLImageElement).currentSrc || element.getAttribute("src") || "", complete: (element as HTMLImageElement).complete, naturalWidth: (element as HTMLImageElement).naturalWidth })),
    );
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((image) => image.complete && image.naturalWidth > 0), JSON.stringify(images)).toBe(true);

    for (const hash of SECTION_ANCHORS) {
      await expect(page.locator(`a[href='${hash}']`).first(), `${hash} anchor`).toBeAttached();
    }
    await expect(page.locator("a[href='/member-login']").first()).toBeAttached();
    await expect(page.locator("footer a[href='/login']")).toHaveCount(1);

    const audit = await captureSertFitEvidence(page, testInfo, "public-route");
    expect(assertCleanLayout(audit)).toEqual({
      clipping: [],
      horizontalOverflow: false,
      nestedScrollbars: [],
      overlaps: [],
      squishedText: [],
    });
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("keeps facility selection and FAQ state one-at-a-time without writes", async ({ page }, testInfo) => {
    const nonGetRequests: string[] = [];
    page.on("request", (request) => {
      if (!request.isNavigationRequest() && request.method() !== "GET") nonGetRequests.push(`${request.method()} ${request.url()}`);
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitReady(page);

    const facilityNames = [
      "Strength Floor",
      "Basketball Court",
      "Boxing Ring",
      "Yoga Room",
      "Recovery Corner",
    ];
    for (const [index, name] of facilityNames.entries()) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^0${index + 1}\\s+${name}$`) }),
        `facility ${name}`,
      ).toHaveCount(1);
    }
    const strength = page.getByRole("button", { name: /^01\s+Strength Floor$/ });
    const court = page.getByRole("button", { name: /^02\s+Basketball Court$/ });
    await expect(strength).toHaveAttribute("aria-pressed", "true");
    await court.click();
    await expect(court).toHaveAttribute("aria-pressed", "true");
    await expect(strength).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-landing-region='spaces'] img")).toHaveAttribute("alt", "Indoor basketball court prepared for training.");
    await strength.click();
    await expect(strength).toHaveAttribute("aria-pressed", "true");

    const firstFaq = page.getByRole("button", { name: "What training spaces are available?", exact: true });
    const secondFaq = page.getByRole("button", { name: "How can I ask about membership options?", exact: true });
    await expect(firstFaq).toHaveAttribute("aria-expanded", "true");
    await secondFaq.click();
    await expect(firstFaq).toHaveAttribute("aria-expanded", "false");
    await expect(secondFaq).toHaveAttribute("aria-expanded", "true");
    await secondFaq.click();
    await expect(secondFaq).toHaveAttribute("aria-expanded", "false");

    const audit = await captureSertFitEvidence(page, testInfo, "selection-and-faq");
    expect(assertCleanLayout(audit).horizontalOverflow).toBe(false);
    expect(nonGetRequests).toEqual([]);
  });

  test("supports public anchors and mobile menu focus, selection, escape, backdrop, and resize", async ({ page }, testInfo) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitReady(page);

    for (const hash of SECTION_ANCHORS) {
      await page.goto(`/${hash}`, { waitUntil: "domcontentloaded" });
      await waitForSertFitHydrated(page);
      await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
      const target = page.locator(hash);
      await expect(target).toBeVisible();
      const targetBox = await target.boundingBox();
      const headerBox = await page.locator("[data-landing-region='navigation']").boundingBox();
      expect(targetBox).not.toBeNull();
      expect(targetBox?.y ?? -1).toBeGreaterThanOrEqual((headerBox?.height ?? 68) - 1);
    }
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitReady(page);

    if ((page.viewportSize()?.width ?? 1024) >= 768) {
      const audit = await captureSertFitEvidence(page, testInfo, "desktop-anchor-state");
      expect(assertCleanLayout(audit).horizontalOverflow).toBe(false);
      return;
    }

    const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
    await openMenu.click();
    const dialog = page.getByRole("dialog", { name: "Menu", exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Close menu", exact: true })).toHaveCount(1);
    await expect(dialog.locator("a,button").first()).toBeFocused();

    await dialog.getByRole("link", { name: "Training", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#training$/);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitReady(page);
    await openMenu.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openMenu).toBeFocused();

    await openMenu.click();
    await expect(dialog).toBeVisible();
    const backdrop = page.locator("[data-landing-region='mobile-navigation'] [data-sertfit-menu-backdrop]");
    await expect(backdrop).toHaveCount(1);
    await backdrop.click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();

    await openMenu.click();
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    await page.setViewportSize({ width: 1024, height: viewport?.height ?? 844 });
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
    await page.setViewportSize(viewport ?? { width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeVisible();

    const audit = await captureSertFitEvidence(page, testInfo, "mobile-menu-state");
    expect(assertCleanLayout(audit).horizontalOverflow).toBe(false);
  });

  test("renders visible hydrated content under OS reduced motion", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForSertFitHydrated(page);
    await expect(page.locator(SERTFIT_HYDRATED_SELECTOR)).toBeAttached();
    await expect(page.locator("[data-landing-region='hero'] h1")).toBeVisible();
    await expect(page.locator("[data-landing-region='spaces'] button").first()).toBeVisible();

    const reducedMotionState = await page.locator(SERTFIT_HYDRATED_SELECTOR).evaluate((root) => {
      const effectiveOpacity = (element: HTMLElement) => {
        let opacity = 1;
        let current: HTMLElement | null = element;
        while (current && current !== document.documentElement) {
          opacity *= Number.parseFloat(getComputedStyle(current).opacity);
          current = current.parentElement;
        }
        return opacity;
      };
      const identityTransform = (element: HTMLElement) => {
        const transform = getComputedStyle(element).transform;
        if (transform === "none") return true;
        try {
          const matrix = new DOMMatrixReadOnly(transform);
          return (
            Math.abs(matrix.m41) < 0.01 &&
            Math.abs(matrix.m42) < 0.01 &&
            Math.abs(matrix.a - 1) < 0.01 &&
            Math.abs(matrix.d - 1) < 0.01
          );
        } catch {
          return false;
        }
      };
      const revealNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-landing-reveal]"));
      const peopleItems = Array.from(
        root.querySelectorAll<HTMLElement>("[data-landing-region='team'] li[data-landing-reveal]"),
      );
      const describe = (element: HTMLElement) => ({
        opacity: effectiveOpacity(element),
        identityTransform: identityTransform(element),
      });
      return {
        scrollY: window.scrollY,
        revealNodes: revealNodes.map(describe),
        peopleItems: peopleItems.map(describe),
      };
    });
    expect(reducedMotionState.scrollY).toBe(0);
    expect(reducedMotionState.revealNodes).not.toHaveLength(0);
    expect(reducedMotionState.revealNodes.every((node) => node.opacity >= 0.999 && node.identityTransform)).toBe(true);
    expect(reducedMotionState.peopleItems).toHaveLength(3);
    expect(reducedMotionState.peopleItems.every((item) => item.opacity >= 0.999 && item.identityTransform)).toBe(true);
    if ((page.viewportSize()?.width ?? 1024) < 768) {
      const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
      await openMenu.click();
      await expect(page.getByRole("dialog", { name: "Menu", exact: true })).toBeVisible();
    }
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
