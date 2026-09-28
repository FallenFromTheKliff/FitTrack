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
        await readFile(resolve(process.cwd(), ".artifacts", manifestName), "utf8"),
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

test.describe("Exercise Lab workflow rail geometry", () => {
  test("keeps the rail and content-height workbench compact on desktop and narrow screens", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAdmin(page);
    await page.goto("/exercise-lab", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /exercise lab/i }),
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("textbox", { name: "Search global exercises" })
      .fill("Dumbbell Biceps Curl");
    await page
      .getByRole("button", { name: "Edit Dumbbell Biceps Curl" })
      .click();

    const rail = page.getByTestId("exercise-lab-step-rail");
    const surface = page.getByTestId("exercise-lab-step-surface");
    await expect(rail).toBeVisible();
    await expect(surface).toBeVisible();
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

    const layout = await rail.evaluate((node) => {
      const rail = node as HTMLElement;
      const shell = rail.closest<HTMLElement>('[data-testid="exercise-lab-workbench"]');
      const surface = shell?.querySelector<HTMLElement>(
        '[data-testid="exercise-lab-step-surface"]',
      );
      const nav = rail.querySelector<HTMLElement>("[data-workflow-step-list]");
      const header = surface?.querySelector<HTMLElement>(
        ".exercise-lab-step-header",
      );
      const body = surface?.querySelector<HTMLElement>(
        ".exercise-lab-step-body",
      );
      const footer = surface?.querySelector<HTMLElement>(
        ".exercise-lab-workbench-footer",
      );
      if (!shell || !surface || !nav || !header || !body || !footer) {
        throw new Error("Exercise Lab geometry contract nodes are missing.");
      }

      const isOverflowing = (element: HTMLElement, axis: "x" | "y") => {
        const style = window.getComputedStyle(element);
        const overflow = axis === "x" ? style.overflowX : style.overflowY;
        const scrollSize = axis === "x" ? element.scrollWidth : element.scrollHeight;
        const clientSize = axis === "x" ? element.clientWidth : element.clientHeight;
        return (
          (overflow === "auto" || overflow === "scroll") &&
          scrollSize > clientSize + 2
        );
      };
      const descendants = Array.from(shell.querySelectorAll<HTMLElement>("*"));
      const horizontalRailScrollOwners = [
        nav,
        ...descendants.filter(
          (element) => rail.contains(element) && element !== nav,
        ),
      ].filter((element) => isOverflowing(element, "x"));
      const verticalScrollOwners = descendants.filter((element) =>
        isOverflowing(element, "y"),
      );
      const controls = Array.from(
        surface.querySelectorAll<HTMLElement>(
          'input:not([type="checkbox"]):not([type="radio"]), select, .exercise-lab-workbench-footer button',
        ),
      ).map((element) => element.getBoundingClientRect().height);
      const pageScrollOwners = document.querySelectorAll(
        ".fit-browser-scrollpane",
      );

      return {
        bodyScrollGap: body.scrollHeight - body.clientHeight,
        controls,
        currentCount: rail.querySelectorAll('[aria-current="step"]').length,
        headerDescriptionCount: header.querySelectorAll(
          ".exercise-lab-step-header-copy > p",
        ).length,
        horizontalOverflow: shell.scrollWidth - shell.clientWidth,
        horizontalRailScrollOwnerCount: horizontalRailScrollOwners.length,
        navClientWidth: nav.clientWidth,
        navOverflowX: window.getComputedStyle(nav).overflowX,
        navOverflowY: window.getComputedStyle(nav).overflowY,
        navScrollWidth: nav.scrollWidth,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        pageScrollOwnerCount: pageScrollOwners.length,
        surfaceHeight: surface.getBoundingClientRect().height,
        surfaceMinHeight: window.getComputedStyle(surface).minHeight,
        verticalScrollOwnerCount: verticalScrollOwners.length,
        viewportWidth: window.innerWidth,
      };
    });

    expect(layout.currentCount).toBe(1);
    expect(layout.headerDescriptionCount).toBe(1);
    expect(layout.pageOverflow).toBeLessThanOrEqual(1);
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(layout.pageScrollOwnerCount).toBe(1);
    expect(layout.verticalScrollOwnerCount).toBe(0);
    expect(layout.bodyScrollGap).toBeLessThanOrEqual(1);
    expect(layout.surfaceMinHeight).not.toBe("100vh");
    expect(layout.surfaceHeight).toBeGreaterThan(0);
    expect(layout.controls.length).toBeGreaterThan(0);
    expect(layout.controls.every((height) => height >= 36)).toBe(true);

    if (layout.viewportWidth <= 920) {
      expect(layout.navOverflowX).toBe("auto");
      expect(layout.navOverflowY).toBe("hidden");
      expect(layout.horizontalRailScrollOwnerCount).toBe(1);
      expect(layout.navScrollWidth).toBeGreaterThan(layout.navClientWidth);
    } else {
      expect(layout.horizontalRailScrollOwnerCount).toBe(0);
      expect(layout.navScrollWidth - layout.navClientWidth).toBeLessThanOrEqual(1);
    }
  });
});
