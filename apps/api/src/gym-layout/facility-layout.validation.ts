import { BadRequestException } from '@nestjs/common';

export const FACILITY_GRID_COLUMNS = 1000;
export const FACILITY_GRID_ROWS = 1000;
export const FACILITY_GRID_MAX_CELLS = 25_000;
export const FACILITY_GRID_MAX_RECTANGLE_CELLS = 10_000;

export type FacilityGridCell = { column: number; row: number };
export type FacilityGridRectangle = {
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
};

export const facilityCellKey = (cell: FacilityGridCell) =>
  `${cell.column}:${cell.row}`;

export function assertValidFacilityCells(
  value: unknown,
  label: string,
): asserts value is FacilityGridCell[] {
  if (
    !Array.isArray(value) ||
    value.length > FACILITY_GRID_MAX_CELLS ||
    value.some((item) => {
      if (!item || typeof item !== 'object') return true;
      const column = Number((item as { column?: unknown }).column);
      const row = Number((item as { row?: unknown }).row);
      return (
        !Number.isSafeInteger(column) ||
        !Number.isSafeInteger(row) ||
        column < 1 ||
        column > FACILITY_GRID_COLUMNS ||
        row < 1 ||
        row > FACILITY_GRID_ROWS
      );
    })
  ) {
    throw new BadRequestException({
      type: 'INVALID_FACILITY_LAYOUT',
      title: 'Invalid Facility Cells',
      status: 400,
      detail: `${label} must contain no more than ${FACILITY_GRID_MAX_CELLS} cells inside the safe sparse planning range.`,
    });
  }
}

export function normalizeFacilityCells(value: unknown): FacilityGridCell[] {
  if (!Array.isArray(value)) return [];
  const cells = new Map<string, FacilityGridCell>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const column = Number((item as { column?: unknown }).column);
    const row = Number((item as { row?: unknown }).row);
    if (
      Number.isSafeInteger(column) &&
      Number.isSafeInteger(row) &&
      column >= 1 &&
      column <= FACILITY_GRID_COLUMNS &&
      row >= 1 &&
      row <= FACILITY_GRID_ROWS
    )
      cells.set(`${column}:${row}`, { column, row });
    if (cells.size >= FACILITY_GRID_MAX_CELLS) break;
  }
  return [...cells.values()].sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
}

export function expandFacilityRectangle(rectangle: FacilityGridRectangle) {
  if (!isFacilityRectangleSafe(rectangle)) return [];
  const cells: FacilityGridCell[] = [];
  for (
    let row = rectangle.gridRow;
    row < rectangle.gridRow + rectangle.gridHeight;
    row += 1
  ) {
    for (
      let column = rectangle.gridColumn;
      column < rectangle.gridColumn + rectangle.gridWidth;
      column += 1
    ) {
      cells.push({ column, row });
    }
  }
  return cells;
}

function isFacilityRectangleSafe(rectangle: FacilityGridRectangle) {
  return (
    Number.isSafeInteger(rectangle.gridColumn) &&
    Number.isSafeInteger(rectangle.gridRow) &&
    Number.isSafeInteger(rectangle.gridWidth) &&
    Number.isSafeInteger(rectangle.gridHeight) &&
    rectangle.gridColumn >= 1 &&
    rectangle.gridRow >= 1 &&
    rectangle.gridWidth >= 1 &&
    rectangle.gridHeight >= 1 &&
    rectangle.gridColumn + rectangle.gridWidth - 1 <= FACILITY_GRID_COLUMNS &&
    rectangle.gridRow + rectangle.gridHeight - 1 <= FACILITY_GRID_ROWS &&
    rectangle.gridWidth * rectangle.gridHeight <=
      FACILITY_GRID_MAX_RECTANGLE_CELLS
  );
}

export function facilityRectanglesOverlap(
  left: FacilityGridRectangle,
  right: FacilityGridRectangle,
) {
  return !(
    left.gridColumn + left.gridWidth - 1 < right.gridColumn ||
    right.gridColumn + right.gridWidth - 1 < left.gridColumn ||
    left.gridRow + left.gridHeight - 1 < right.gridRow ||
    right.gridRow + right.gridHeight - 1 < left.gridRow
  );
}

export function assertRectangleInFootprint(
  rectangle: FacilityGridRectangle,
  footprintCells: FacilityGridCell[],
  detail = 'The region must remain inside the published building footprint.',
) {
  const footprint = new Set(footprintCells.map(facilityCellKey));
  const valid =
    isFacilityRectangleSafe(rectangle) &&
    expandFacilityRectangle(rectangle).every((cell) =>
      footprint.has(facilityCellKey(cell)),
    );
  if (!valid)
    throw new BadRequestException({
      type: 'INVALID_FACILITY_LAYOUT',
      title: 'Invalid Facility Layout',
      status: 400,
      detail,
    });
}

export function assertNoRegionOverlap(
  rectangle: FacilityGridRectangle,
  regions: FacilityGridRectangle[],
) {
  if (
    regions.some((candidate) => facilityRectanglesOverlap(rectangle, candidate))
  ) {
    throw new BadRequestException({
      type: 'FACILITY_REGION_OVERLAP',
      title: 'Facility Regions Overlap',
      status: 400,
      detail: 'Mapped venue and support regions cannot occupy the same cell.',
    });
  }
}
