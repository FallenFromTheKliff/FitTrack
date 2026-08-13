import type { Locator, Page } from "@playwright/test";

export type VisualLayoutAudit = {
  awkwardProportions: string[];
  clipping: string[];
  horizontalOverflow: boolean;
  nestedScrollbars: string[];
  overlaps: string[];
  squishedText: string[];
};

const STABILITY_STYLE = `
  html { scroll-behavior: auto !important; }
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

export async function stabilizeVisualPage(
  page: Page,
  maskSelectors: readonly string[] = [],
): Promise<Locator[]> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: STABILITY_STYLE });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  return maskSelectors.map((selector) => page.locator(selector));
}

export function getVolatileTextMasks(
  page: Page,
  patterns: readonly string[] = [],
): Locator[] {
  const masks: Locator[] = [];
  if (patterns.includes("clock")) {
    masks.push(page.getByText(/\|\s*\d{1,2}:\d{2}\s*(?:AM|PM)/));
  }
  if (patterns.includes("exp")) {
    masks.push(page.getByText(/^\d+(?:\.\d+)?K$/));
  }
  return masks;
}

export async function auditConventionalLayout(
  page: Page,
): Promise<VisualLayoutAudit> {
  return page.evaluate(() => {
    const ignored = (element: Element) =>
      Boolean(element.closest("[data-visual-ignore-layout]"));
    const visible = (element: Element) => {
      if (ignored(element)) return false;
      if (element.closest('[aria-hidden="true"], [inert]')) return false;
      const node = element as HTMLElement;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        style.pointerEvents !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const label = (element: Element) => {
      const node = element as HTMLElement;
      const text = (node.innerText || node.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${text ? `:${text}` : ""}`;
    };
    const hitTestVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      if (
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= window.innerWidth ||
        rect.top >= window.innerHeight
      ) {
        return false;
      }
      const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
      const topmost = document.elementFromPoint(x, y);
      return Boolean(topmost && (topmost === element || element.contains(topmost)));
    };
    const textCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "h1,h2,h3,h4,h5,button,a,[role=button],[role=link],[role=tab],label",
      ),
    )
      .filter(visible)
      .filter(hitTestVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const viewportArea = window.innerWidth * window.innerHeight;
        return rect.width * rect.height < viewportArea * 0.15;
      });
    const interactiveCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button,a,input,select,textarea,[role=button],[role=link],[role=tab]",
      ),
    )
      .filter(visible)
      .filter(hitTestVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const viewportArea = window.innerWidth * window.innerHeight;
        return rect.width * rect.height < viewportArea * 0.15;
      });

    const squishedText = textCandidates
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          element.scrollWidth > element.clientWidth + 2 &&
          style.textOverflow !== "ellipsis" &&
          !["hidden", "clip"].includes(style.overflowX)
        );
      })
      .map(label);

    const clipping = textCandidates
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const outsideViewport =
          rect.left < -1 || rect.right > window.innerWidth + 1;
        const verticallyClipped =
          element.scrollHeight > element.clientHeight + 2 &&
          !["visible", "auto", "scroll", "overlay"].includes(style.overflowY);
        return outsideViewport || verticallyClipped;
      })
      .map(label);

    const overlaps: string[] = [];
    for (let index = 0; index < interactiveCandidates.length; index += 1) {
      const first = interactiveCandidates[index];
      const firstRect = first.getBoundingClientRect();
      const firstArea = firstRect.width * firstRect.height;
      for (let otherIndex = index + 1; otherIndex < interactiveCandidates.length; otherIndex += 1) {
        const second = interactiveCandidates[otherIndex];
        if (first.parentElement !== second.parentElement) continue;
        if (first.contains(second) || second.contains(first)) continue;
        const secondRect = second.getBoundingClientRect();
        const intersectionWidth = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
        const intersectionHeight = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
        const intersectionArea = intersectionWidth * intersectionHeight;
        const secondArea = secondRect.width * secondRect.height;
        const intersectionPoint = document.elementFromPoint(
          Math.max(firstRect.left, secondRect.left) + intersectionWidth / 2,
          Math.max(firstRect.top, secondRect.top) + intersectionHeight / 2,
        );
        if (
          !intersectionPoint ||
          (!first.contains(intersectionPoint) && !second.contains(intersectionPoint))
        ) {
          continue;
        }
        if (intersectionArea > 16 && intersectionArea > Math.min(firstArea, secondArea) * 0.25) {
          overlaps.push(`${label(first)} <> ${label(second)}`);
        }
      }
    }

    const scrollables = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter(visible)
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          ["auto", "scroll", "overlay"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 4
        );
      });
    const nestedScrollbars = scrollables
      .filter((element) => {
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          if (scrollables.includes(parent)) return true;
          parent = parent.parentElement;
        }
        return false;
      })
      .map(label);

    const awkwardProportions = interactiveCandidates
      .filter((element) => {
        const text = (element.innerText || "").trim();
        if (text.length < 3) return false;
        const rect = element.getBoundingClientRect();
        const ratio = rect.width / Math.max(rect.height, 1);
        return rect.width < 44 || rect.height < 28 || ratio > 18 || ratio < 0.45;
      })
      .map(label);

    return {
      awkwardProportions,
      clipping,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      nestedScrollbars,
      overlaps,
      squishedText,
    };
  });
}
