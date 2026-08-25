import type { FacilityGridCell } from "@fittrack/types";

export const FACILITY_MAP_MIN_SCALE = 0.25;
export const FACILITY_MAP_MAX_SCALE = 3;

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
    translateX:
      (viewport.width - contentWidth * scale) / 2 -
      (bounds.column - 1) * cellSize * scale,
    translateY:
      (viewport.height - contentHeight * scale) / 2 -
      (bounds.row - 1) * cellSize * scale,
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
  const left = (bounds.column - 1) * cellSize * normalizedScale;
  const top = (bounds.row - 1) * cellSize * normalizedScale;
  const right = (bounds.column - 1 + bounds.width) * cellSize * normalizedScale;
  const bottom = (bounds.row - 1 + bounds.height) * cellSize * normalizedScale;
  const minX = viewport.width - padding - right;
  const maxX = padding - left;
  const minY = viewport.height - padding - bottom;
  const maxY = padding - top;
  const centeredX = (viewport.width - (right - left)) / 2 - left;
  const centeredY = (viewport.height - (bottom - top)) / 2 - top;
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
