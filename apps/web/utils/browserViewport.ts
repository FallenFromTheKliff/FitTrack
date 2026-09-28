"use client";

const RESIZE_COLUMN_THRESHOLD = 0.9;

let baselineViewportWidth: number | null = null;

export function getBrowserViewportState() {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const outerWidth = window.outerWidth || viewportWidth;
  const outerHeight = window.outerHeight || window.innerHeight;
  const availableWidth = window.screen?.availWidth || outerWidth;
  const availableHeight = window.screen?.availHeight || outerHeight;
  const maximizedTolerance = 16;
  const isWindowMaximized =
    outerWidth >= availableWidth - maximizedTolerance &&
    outerHeight >= availableHeight - maximizedTolerance;
  const nextBaseline =
    baselineViewportWidth == null
      ? viewportWidth
      : Math.max(baselineViewportWidth, viewportWidth);

  baselineViewportWidth = nextBaseline;

  const viewportWidthRatio =
    nextBaseline > 0 ? viewportWidth / nextBaseline : 1;
  const isBelowResizeThreshold =
    viewportWidthRatio <= RESIZE_COLUMN_THRESHOLD;

  return {
    isBrowserWindowResized: isBelowResizeThreshold,
    isBelowResizeThreshold,
    isWindowMaximized,
    viewportWidthRatio,
    viewportWidth,
  };
}
