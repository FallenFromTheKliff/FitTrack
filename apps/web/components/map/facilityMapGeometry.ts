import type { FacilityGridCell } from "@fittrack/types";

import { FACILITY_MAP_LOGICAL_ORIGIN } from "@fittrack/utils";

export { FACILITY_MAP_LOGICAL_ORIGIN };

export const FACILITY_MAP_MIN_ZOOM = 0.4;
export const FACILITY_MAP_MAX_ZOOM = 1.25;
export const FACILITY_MAP_ZOOM_STEP = 0.05;
/** Keep the virtual-cell pass bounded even when a tiny zoom exposes the full world. */
export const FACILITY_MAP_MAX_VISIBLE_CELLS = 25_000;

export type FacilityContentBounds = {
  column: number;
  row: number;
  width: number;
  height: number;
};

/**
 * The map can be fed by partially populated API records while an administrator
 * is editing a floor.  Keep the envelope input deliberately serializable and
 * permissive; the resolver below validates each coordinate before using it.
 */
export type FacilityMapGridCellInput = {
  column?: unknown;
  row?: unknown;
};

export type FacilityMapLayoutRectInput = {
  gridColumn?: unknown;
  gridHeight?: unknown;
  gridRow?: unknown;
  gridWidth?: unknown;
  isMapped?: unknown;
  positionX?: unknown;
  positionY?: unknown;
};

export type FacilityContentEnvelopeInput = {
  cells?: readonly FacilityMapGridCellInput[] | null;
  equipment?: readonly FacilityMapLayoutRectInput[] | null;
  fallback?: FacilityContentBounds;
  venues?: readonly FacilityMapLayoutRectInput[] | null;
};

export type FacilityMapGeometry = {
  basePlanHeight: number;
  basePlanWidth: number;
  cellHeight: number;
  cellWidth: number;
  planHeight: number;
  planWidth: number;
  planX: number;
  planY: number;
  zoom: number;
};

export type FacilityMapFitView = {
  geometry: FacilityMapGeometry;
  pan: { x: number; y: number };
  zoom: number;
};

export type FacilityMapVisibleCellBounds = {
  firstColumn: number;
  firstRow: number;
  lastColumn: number;
  lastRow: number;
};

const FACILITY_GRID_MAX_COLUMNS = 1000;
const FACILITY_GRID_MAX_ROWS = 1000;
const LEGACY_POSITION_GRID_COLUMNS = 14;
const LEGACY_POSITION_GRID_ROWS = 10;

const DEFAULT_CONTENT_BOUNDS: FacilityContentBounds = {
  column: 1,
  row: 1,
  width: 14,
  height: 10,
};

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeGridCoordinate(value: unknown, max: number) {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 1) return null;
  return Math.min(max, Math.max(1, Math.round(numeric)));
}

function normalizeDimension(value: unknown, fallback: number, max: number) {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.round(numeric)));
}

function normalizeFallbackBounds(
  fallback: FacilityContentBounds | undefined,
): FacilityContentBounds {
  const column =
    normalizeGridCoordinate(fallback?.column, FACILITY_GRID_MAX_COLUMNS) ?? 1;
  const row = normalizeGridCoordinate(fallback?.row, FACILITY_GRID_MAX_ROWS) ?? 1;
  const width = normalizeDimension(
    fallback?.width,
    DEFAULT_CONTENT_BOUNDS.width,
    FACILITY_GRID_MAX_COLUMNS,
  );
  const height = normalizeDimension(
    fallback?.height,
    DEFAULT_CONTENT_BOUNDS.height,
    FACILITY_GRID_MAX_ROWS,
  );

  return {
    column,
    row,
    width: Math.min(width, FACILITY_GRID_MAX_COLUMNS - column + 1),
    height: Math.min(height, FACILITY_GRID_MAX_ROWS - row + 1),
  };
}

function resolvePositionCoordinate(
  value: unknown,
  cells: number,
  max: number,
) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  return normalizeGridCoordinate((numeric / 100) * cells + 0.5, max);
}

function resolveLayoutOrigin(
  item: FacilityMapLayoutRectInput | null | undefined,
  axis: "column" | "row",
) {
  const gridValue = axis === "column" ? item?.gridColumn : item?.gridRow;
  const positionValue = axis === "column" ? item?.positionX : item?.positionY;
  const cells =
    axis === "column" ? LEGACY_POSITION_GRID_COLUMNS : LEGACY_POSITION_GRID_ROWS;
  const max = axis === "column" ? FACILITY_GRID_MAX_COLUMNS : FACILITY_GRID_MAX_ROWS;

  return (
    normalizeGridCoordinate(gridValue, max) ??
    resolvePositionCoordinate(positionValue, cells, max) ??
    1
  );
}

function isMappedLayoutItem(item: FacilityMapLayoutRectInput | null | undefined) {
  return item?.isMapped !== false;
}

type MutableContentEnvelope = {
  maxColumn: number;
  maxRow: number;
  minColumn: number;
  minRow: number;
};

function includeRectangle(
  envelope: MutableContentEnvelope,
  column: number,
  row: number,
  width: number,
  height: number,
) {
  const right = Math.min(
    FACILITY_GRID_MAX_COLUMNS,
    column + Math.max(1, width) - 1,
  );
  const bottom = Math.min(
    FACILITY_GRID_MAX_ROWS,
    row + Math.max(1, height) - 1,
  );

  envelope.minColumn = Math.min(envelope.minColumn, column);
  envelope.minRow = Math.min(envelope.minRow, row);
  envelope.maxColumn = Math.max(envelope.maxColumn, right);
  envelope.maxRow = Math.max(envelope.maxRow, bottom);
}

export function clampFacilityMapZoom(value: number) {
  return Math.min(
    FACILITY_MAP_MAX_ZOOM,
    Math.max(FACILITY_MAP_MIN_ZOOM, Number.isFinite(value) ? value : 1),
  );
}

export function getFacilityContentBounds(
  cells: readonly FacilityGridCell[],
  fallback: FacilityContentBounds = DEFAULT_CONTENT_BOUNDS,
): FacilityContentBounds {
  return getFacilityContentEnvelope({ cells, fallback });
}

/**
 * Resolve the smallest useful visible workspace without allocating the
 * virtual grid. Published cells establish the floor footprint. When a caller
 * supplies a floor fallback, placements remain overlays and do not resize the
 * viewport envelope after a drop; this keeps custom low-coordinate floors
 * usable even when stale placement rows still carry canonical coordinates.
 */
export function getFacilityContentEnvelope({
  cells = [],
  equipment = [],
  fallback,
  venues = [],
}: FacilityContentEnvelopeInput = {}): FacilityContentBounds {
  const normalizedFallback = normalizeFallbackBounds(fallback);
  const envelope: MutableContentEnvelope = {
    maxColumn: Number.NEGATIVE_INFINITY,
    maxRow: Number.NEGATIVE_INFINITY,
    minColumn: Number.POSITIVE_INFINITY,
    minRow: Number.POSITIVE_INFINITY,
  };

  let hasPublishedCells = false;

  for (const cell of cells ?? []) {
    const column = normalizeGridCoordinate(
      cell?.column,
      FACILITY_GRID_MAX_COLUMNS,
    );
    const row = normalizeGridCoordinate(cell?.row, FACILITY_GRID_MAX_ROWS);
    if (column === null || row === null) continue;
    hasPublishedCells = true;
    includeRectangle(envelope, column, row, 1, 1);
  }

  // A populated floor footprint is the stable fit target. The admin canvas
  // still renders and can pan to placements, but overlay records must not
  // make a low-coordinate custom floor span from 1 to the canonical origin.
  if (!fallback || !hasPublishedCells) {
    for (const venue of venues ?? []) {
      if (!isMappedLayoutItem(venue)) continue;
      const column = resolveLayoutOrigin(venue, "column");
      const row = resolveLayoutOrigin(venue, "row");
      includeRectangle(
        envelope,
        column,
        row,
        normalizeDimension(venue?.gridWidth, 1, FACILITY_GRID_MAX_COLUMNS),
        normalizeDimension(venue?.gridHeight, 1, FACILITY_GRID_MAX_ROWS),
      );
    }

    for (const item of equipment ?? []) {
      const column = resolveLayoutOrigin(item, "column");
      const row = resolveLayoutOrigin(item, "row");
      includeRectangle(
        envelope,
        column,
        row,
        normalizeDimension(item?.gridWidth, 1, FACILITY_GRID_MAX_COLUMNS),
        normalizeDimension(item?.gridHeight, 1, FACILITY_GRID_MAX_ROWS),
      );
    }
  }

  if (
    !Number.isFinite(envelope.minColumn) ||
    !Number.isFinite(envelope.minRow) ||
    !Number.isFinite(envelope.maxColumn) ||
    !Number.isFinite(envelope.maxRow)
  ) {
    return normalizedFallback;
  }

  return {
    column: envelope.minColumn,
    row: envelope.minRow,
    width: envelope.maxColumn - envelope.minColumn + 1,
    height: envelope.maxRow - envelope.minRow + 1,
  };
}

export function resolveFacilityMapGeometry(args: {
  contentBounds: FacilityContentBounds;
  fitToFloorBounds?: boolean;
  height: number;
  viewportWidth: number;
  zoom: number;
}): FacilityMapGeometry {
  const width = Math.max(1, toFiniteNumber(args.viewportWidth) ?? 1);
  const height = Math.max(1, toFiniteNumber(args.height) ?? 1);
  const contentStartColumn =
    normalizeGridCoordinate(args.contentBounds.column, FACILITY_GRID_MAX_COLUMNS) ?? 1;
  const contentStartRow =
    normalizeGridCoordinate(args.contentBounds.row, FACILITY_GRID_MAX_ROWS) ?? 1;
  const contentWidth = Math.min(
    normalizeDimension(
    args.contentBounds.width,
    DEFAULT_CONTENT_BOUNDS.width,
    FACILITY_GRID_MAX_COLUMNS,
    ),
    FACILITY_GRID_MAX_COLUMNS - contentStartColumn + 1,
  );
  const contentHeight = Math.min(
    normalizeDimension(
      args.contentBounds.height,
      DEFAULT_CONTENT_BOUNDS.height,
      FACILITY_GRID_MAX_ROWS,
    ),
    FACILITY_GRID_MAX_ROWS - contentStartRow + 1,
  );
  const maxPlanWidth = args.fitToFloorBounds
    ? Math.max(1, width - 36)
    : Math.max(280, width - 36);
  const maxPlanHeight = args.fitToFloorBounds
    ? Math.max(1, height - 44)
    : Math.max(280, height - 44);
  const basePlanWidth = Math.min(
    maxPlanWidth,
    maxPlanHeight * (contentWidth / contentHeight),
  );
  const basePlanHeight = basePlanWidth * (contentHeight / contentWidth);
  const zoom = clampFacilityMapZoom(args.zoom);
  const cellWidth = (basePlanWidth / contentWidth) * zoom;
  const cellHeight = (basePlanHeight / contentHeight) * zoom;
  const planWidth = contentWidth * cellWidth;
  const planHeight = contentHeight * cellHeight;
  const logicalOriginIsInContent =
    FACILITY_MAP_LOGICAL_ORIGIN.column >= contentStartColumn &&
    FACILITY_MAP_LOGICAL_ORIGIN.column <= contentStartColumn + contentWidth - 1;
  const logicalOriginRowIsInContent =
    FACILITY_MAP_LOGICAL_ORIGIN.row >= contentStartRow &&
    FACILITY_MAP_LOGICAL_ORIGIN.row <= contentStartRow + contentHeight - 1;
  const centeredColumn = logicalOriginIsInContent
    ? FACILITY_MAP_LOGICAL_ORIGIN.column - 0.5
    : contentStartColumn - 1 + contentWidth / 2;
  const centeredRow = logicalOriginRowIsInContent
    ? FACILITY_MAP_LOGICAL_ORIGIN.row - 0.5
    : contentStartRow - 1 + contentHeight / 2;

  return {
    basePlanHeight,
    basePlanWidth,
    cellHeight,
    cellWidth,
    planHeight,
    planWidth,
    // Keep persisted positive coordinates intact while translating the
    // canonical content (or its shared logical origin) to the viewport center.
    planX: width / 2 - centeredColumn * cellWidth,
    planY: height / 2 - centeredRow * cellHeight,
    zoom,
  };
}

/**
 * Resolve only the bounded world cells that can intersect the viewport. The
 * sparse world remains addressable on both sides of the canonical origin,
 * while callers avoid allocating the full 1000 x 1000 grid.
 */
export function resolveFacilityMapVisibleCellBounds(args: {
  geometry: Pick<FacilityMapGeometry, "cellHeight" | "cellWidth" | "planX" | "planY">;
  height: number;
  maxVisibleCells?: number;
  maxColumns?: number;
  maxRows?: number;
  padding?: number;
  pan: { x: number; y: number };
  viewportWidth: number;
}): FacilityMapVisibleCellBounds | null {
  const cellWidth = args.geometry.cellWidth;
  const cellHeight = args.geometry.cellHeight;
  if (!(cellWidth > 0) || !(cellHeight > 0)) return null;

  const maxColumns = Math.max(
    1,
    Math.min(
      FACILITY_GRID_MAX_COLUMNS,
      Math.round(toFiniteNumber(args.maxColumns) ?? FACILITY_GRID_MAX_COLUMNS),
    ),
  );
  const maxRows = Math.max(
    1,
    Math.min(
      FACILITY_GRID_MAX_ROWS,
      Math.round(toFiniteNumber(args.maxRows) ?? FACILITY_GRID_MAX_ROWS),
    ),
  );
  const padding = Math.max(0, toFiniteNumber(args.padding) ?? 0);
  const maxVisibleCells = Math.max(
    1,
    Math.min(
      FACILITY_MAP_MAX_VISIBLE_CELLS,
      Math.round(toFiniteNumber(args.maxVisibleCells) ?? FACILITY_MAP_MAX_VISIBLE_CELLS),
    ),
  );
  const viewportWidth = Math.max(0, toFiniteNumber(args.viewportWidth) ?? 0);
  const height = Math.max(0, toFiniteNumber(args.height) ?? 0);
  const panX = toFiniteNumber(args.pan.x) ?? 0;
  const panY = toFiniteNumber(args.pan.y) ?? 0;

  // Convert the screen rectangle into the plan's unscaled coordinate space.
  const left = -panX - args.geometry.planX - padding;
  const right = viewportWidth - panX - args.geometry.planX + padding;
  const top = -panY - args.geometry.planY - padding;
  const bottom = height - panY - args.geometry.planY + padding;
  if (
    right < 0 ||
    left > maxColumns * cellWidth ||
    bottom < 0 ||
    top > maxRows * cellHeight
  ) {
    return null;
  }

  const firstColumn = Math.max(1, Math.min(maxColumns, Math.floor(left / cellWidth) + 1));
  const lastColumn = Math.max(1, Math.min(maxColumns, Math.floor(right / cellWidth) + 1));
  const firstRow = Math.max(1, Math.min(maxRows, Math.floor(top / cellHeight) + 1));
  const lastRow = Math.max(1, Math.min(maxRows, Math.floor(bottom / cellHeight) + 1));
  if (lastColumn < firstColumn || lastRow < firstRow) return null;
  if ((lastColumn - firstColumn + 1) * (lastRow - firstRow + 1) > maxVisibleCells) {
    return null;
  }

  return { firstColumn, firstRow, lastColumn, lastRow };
}

/**
 * A stable reset target for the Fit control.  The Konva owner can calculate
 * its current envelope, apply this geometry, and reset pan to the origin;
 * persisted grid coordinates remain unchanged.
 */
export function resolveFacilityMapFitView(args: {
  contentBounds: FacilityContentBounds;
  fitToFloorBounds?: boolean;
  height: number;
  viewportWidth: number;
}): FacilityMapFitView {
  return {
    geometry: resolveFacilityMapGeometry({ ...args, zoom: 1 }),
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}

export function resolveFacilityMapFocalPan(args: {
  currentGeometry: FacilityMapGeometry;
  currentPan: { x: number; y: number };
  nextGeometry: FacilityMapGeometry;
  pointerX: number;
  pointerY: number;
}) {
  const mapX =
    (args.pointerX - args.currentPan.x - args.currentGeometry.planX) /
    args.currentGeometry.cellWidth;
  const mapY =
    (args.pointerY - args.currentPan.y - args.currentGeometry.planY) /
    args.currentGeometry.cellHeight;

  return {
    x:
      args.pointerX -
      args.nextGeometry.planX -
      mapX * args.nextGeometry.cellWidth,
    y:
      args.pointerY -
      args.nextGeometry.planY -
      mapY * args.nextGeometry.cellHeight,
  };
}
