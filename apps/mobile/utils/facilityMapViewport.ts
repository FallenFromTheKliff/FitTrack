import type { FacilityGridCell } from "@fittrack/types";

export const FACILITY_MAP_MIN_SCALE = 0.25;
export const FACILITY_MAP_MAX_SCALE = 3;
export const FACILITY_NODE_PREVIEW_HOLD_MS = 100;

export type FacilityMapViewportSize = { width: number; height: number };
export type FacilityMapTranslation = { x: number; y: number };

export function getFacilityMapFootprintBounds(cells: FacilityGridCell[]) {
  "worklet";
  if (cells.length === 0) return { column: 1, row: 1, width: 14, height: 10 };
  let minColumn = cells[0].column;
  let maxColumn = cells[0].column;
  let minRow = cells[0].row;
  let maxRow = cells[0].row;
  for (const cell of cells) {
    minColumn = Math.min(minColumn, cell.column);
    maxColumn = Math.max(maxColumn, cell.column);
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
  }
  return {
    column: minColumn,
    row: minRow,
    width: maxColumn - minColumn + 1,
    height: maxRow - minRow + 1,
  };
}

export function clampFacilityMapScale(scale: number) {
  "worklet";
  return Math.max(FACILITY_MAP_MIN_SCALE, Math.min(FACILITY_MAP_MAX_SCALE, scale));
}

export function computeFacilityMapFit(
  cells: FacilityGridCell[],
  viewport: FacilityMapViewportSize,
  cellSize = 40,
  padding = 24,
) {
  const bounds = getFacilityMapFootprintBounds(cells);
  const contentWidth = bounds.width * cellSize;
  const contentHeight = bounds.height * cellSize;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = clampFacilityMapScale(
    Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
  );
  return {
    scale,
    // The native renderer normalizes the sparse map to its content bounds,
    // so distant source coordinates do not create a giant native view.
    translateX: (viewport.width - contentWidth * scale) / 2,
    translateY: (viewport.height - contentHeight * scale) / 2,
  };
}

export function constrainFacilityMapTranslation(
  translation: FacilityMapTranslation,
  viewport: FacilityMapViewportSize,
  scale: number,
  cells: FacilityGridCell[],
  cellSize = 40,
  padding = 24,
) {
  "worklet";
  const bounds = getFacilityMapFootprintBounds(cells);
  const normalizedScale = clampFacilityMapScale(scale);
  const contentWidth = bounds.width * cellSize * normalizedScale;
  const contentHeight = bounds.height * cellSize * normalizedScale;
  const minX = viewport.width - padding - contentWidth;
  const maxX = padding;
  const minY = viewport.height - padding - contentHeight;
  const maxY = padding;
  const centeredX = (viewport.width - contentWidth) / 2;
  const centeredY = (viewport.height - contentHeight) / 2;
  return {
    x:
      minX > maxX
        ? centeredX
        : Math.max(minX, Math.min(maxX, translation.x)),
    y:
      minY > maxY
        ? centeredY
        : Math.max(minY, Math.min(maxY, translation.y)),
  };
}

export function computeFacilityMapFocalTranslation(args: {
  focalX: number;
  focalY: number;
  nextScale: number;
  startScale: number;
  startX: number;
  startY: number;
}) {
  "worklet";
  const ratio = clampFacilityMapScale(args.nextScale) / args.startScale;
  return {
    x: args.focalX - (args.focalX - args.startX) * ratio,
    y: args.focalY - (args.focalY - args.startY) * ratio,
  };
}

export function shouldLockFacilityParentScroll(isGestureActive: boolean) {
  return isGestureActive;
}

export function resolveFacilityRegionPress(previewOpened: boolean) {
  return previewOpened ? "consume-preview" : "select-region";
}

export function computeFacilityPreviewOffset(
  point: { x: number; y: number },
  viewport: FacilityMapViewportSize,
): FacilityMapTranslation {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const horizontalRatio = centerX === 0 ? 0 : (point.x - centerX) / centerX;
  const verticalRatio = centerY === 0 ? 0 : (point.y - centerY) / centerY;

  return {
    x: Math.max(-16, Math.min(16, horizontalRatio * 16)),
    y: Math.max(-12, Math.min(12, verticalRatio * 12)),
  };
}
