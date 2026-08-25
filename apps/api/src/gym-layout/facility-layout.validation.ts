import { BadRequestException } from '@nestjs/common';

export const FACILITY_GRID_COLUMNS = 14;
export const FACILITY_GRID_ROWS = 10;

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
    value.some((item) => {
      if (!item || typeof item !== 'object') return true;
      const column = Number((item as { column?: unknown }).column);
      const row = Number((item as { row?: unknown }).row);
      return (
        !Number.isInteger(column) ||
        !Number.isInteger(row) ||
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
      detail: `${label} must contain only cells inside the fixed 14 x 10 grid.`,
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
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= 1 &&
      column <= FACILITY_GRID_COLUMNS &&
      row >= 1 &&
      row <= FACILITY_GRID_ROWS
    )
      cells.set(`${column}:${row}`, { column, row });
  }
  return [...cells.values()].sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
}

export function expandFacilityRectangle(rectangle: FacilityGridRectangle) {
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
    rectangle.gridColumn >= 1 &&
    rectangle.gridRow >= 1 &&
    rectangle.gridWidth >= 1 &&
    rectangle.gridHeight >= 1 &&
    rectangle.gridColumn + rectangle.gridWidth - 1 <= FACILITY_GRID_COLUMNS &&
    rectangle.gridRow + rectangle.gridHeight - 1 <= FACILITY_GRID_ROWS &&
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
