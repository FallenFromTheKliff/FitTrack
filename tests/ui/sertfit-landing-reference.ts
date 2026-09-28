import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";

import { auditConventionalLayout, stabilizeVisualPage, type VisualLayoutAudit } from "./visual-stabilizer";

export const SERTFIT_REFERENCE_PROVENANCE = {
  figmaMakeFileKey: "DDunjxGvy0bVeYGCHCHFiB",
  figmaNodeId: "0:1",
  sourcePath: ".artifacts/sertfit-landing-20260910/reference/source/src",
  screenshotPath: ".artifacts/sertfit-landing-20260910/reference/screenshots",
  publicAssetPrefix: "/landing/sertfit",
} as const;

export const SERTFIT_REGIONS = [
  "navigation",
  "hero",
  "training",
  "spaces",
  "team",
  "start",
  "visit",
  "footer",
] as const;

export const SERTFIT_HYDRATED_SELECTOR =
  '.sertfit-landing[data-sertfit-hydrated="true"]';

const waitForRenderedHero = async (page: Page) => {
  await page.waitForFunction(() => {
    const hero = document.querySelector<HTMLElement>("[data-landing-region='hero']");
    if (!hero) return false;

    const animatedElements = Array.from(
      hero.querySelectorAll<HTMLElement>("[style*='opacity'], [style*='transform']"),
    );
    const requiredElements = [
      hero.querySelector<HTMLElement>("h1"),
      hero.querySelector<HTMLImageElement>("img"),
      ...animatedElements,
    ].filter((element): element is HTMLElement => Boolean(element));

    const effectiveOpacity = (element: HTMLElement) => {
      let opacity = 1;
      let current: HTMLElement | null = element;
      while (current && current !== document.documentElement) {
        opacity *= Number.parseFloat(getComputedStyle(current).opacity);
        if (opacity < 0.999) return opacity;
        current = current.parentElement;
      }
      return opacity;
    };

    const settledTransform = (element: HTMLElement) => {
      const transform = getComputedStyle(element).transform;
      if (transform === "none") return true;
      try {
        const matrix = new DOMMatrixReadOnly(transform);
        return (
          Math.abs(matrix.m41) < 0.5 &&
          Math.abs(matrix.m42) < 0.5 &&
          Math.abs(matrix.a - 1) < 0.01 &&
          Math.abs(matrix.d - 1) < 0.01
        );
      } catch {
        return false;
      }
    };

    return requiredElements.every(
      (element) => effectiveOpacity(element) >= 0.999 && settledTransform(element),
    );
  }, undefined, { timeout: 15000, polling: 50 });
};

export async function waitForSertFitHydrated(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(SERTFIT_HYDRATED_SELECTOR, { state: "attached" });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForFunction(() => document.querySelector("[data-landing-region='hero']") !== null);
  await waitForRenderedHero(page);
}

export async function waitForSertFitReady(page: Page) {
  await waitForSertFitHydrated(page);

  const images = page.locator("img");
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => {
      if (element instanceof HTMLImageElement && !element.complete) {
        return new Promise<void>((resolve, reject) => {
          element.addEventListener("load", () => resolve(), { once: true });
          element.addEventListener("error", () => reject(new Error(`Image failed: ${element.currentSrc || element.src}`)), { once: true });
        });
      }
      return undefined;
    });
    await image.evaluate((element) => {
      const image = element as HTMLImageElement;
      if (!image.complete || image.naturalWidth <= 0) {
        throw new Error(`Image has no decoded pixels: ${image.currentSrc || image.src}`);
      }
    });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function captureSertFitEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
  metadata: Record<string, unknown> = {},
) {
  await stabilizeVisualPage(page);
  const audit = await auditConventionalLayout(page);
  const screenshotPath = testInfo.outputPath(`${label}.png`);
  const auditPath = testInfo.outputPath(`${label}.json`);
  await mkdir(resolve(testInfo.outputDir), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const evidence = {
    route: page.url(),
    project: testInfo.project.name,
    viewport: page.viewportSize(),
    provenance: SERTFIT_REFERENCE_PROVENANCE,
    audit,
    ...metadata,
    artifacts: { screenshotPath, auditPath },
  };
  await writeFile(auditPath, JSON.stringify(evidence, null, 2));
  await testInfo.attach(`${label}-screenshot`, { path: screenshotPath, contentType: "image/png" });
  await testInfo.attach(`${label}-audit`, { path: auditPath, contentType: "application/json" });
  return audit;
}

export function assertCleanLayout(audit: VisualLayoutAudit) {
  return {
    clipping: audit.clipping,
    horizontalOverflow: audit.horizontalOverflow,
    nestedScrollbars: audit.nestedScrollbars,
    overlaps: audit.overlaps,
    squishedText: audit.squishedText,
  };
}
