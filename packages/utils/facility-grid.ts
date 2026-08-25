import {
  FACILITY_GRID_COLUMNS,
  FACILITY_GRID_ROWS,
  type FacilityGridCell,
  type FacilityGridRectangle,
} from "@fittrack/types";

export function cellKey(cell: FacilityGridCell): string {
  return `${cell.column}:${cell.row}`;
}

export function parseCellKey(key: string): FacilityGridCell | null {
  const match = /^(\d+):(\d+)$/.exec(key.trim());
  if (!match) return null;
  const cell = { column: Number(match[1]), row: Number(match[2]) };
  return isCellInsideGrid(cell) ? cell : null;
}

export function isCellInsideGrid(cell: FacilityGridCell): boolean {
  return (
    Number.isInteger(cell.column) &&
    Number.isInteger(cell.row) &&
    cell.column >= 1 &&
    cell.column <= FACILITY_GRID_COLUMNS &&
    cell.row >= 1 &&
    cell.row <= FACILITY_GRID_ROWS
  );
}

export function dedupeCells(cells: FacilityGridCell[]): FacilityGridCell[] {
  const unique = new Map<string, FacilityGridCell>();
  for (const cell of cells) {
    if (isCellInsideGrid(cell)) unique.set(cellKey(cell), { ...cell });
  }
  return [...unique.values()].sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
}

export function expandRectangleToCells(
  rectangle: FacilityGridRectangle,
): FacilityGridCell[] {
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

export function getCellBounds(cells: FacilityGridCell[]): {
  column: number;
  height: number;
  row: number;
  width: number;
} | null {
  const normalized = dedupeCells(cells);
  if (normalized.length === 0) return null;
  const columns = normalized.map((cell) => cell.column);
  const rows = normalized.map((cell) => cell.row);
  const column = Math.min(...columns);
  const row = Math.min(...rows);
  return {
    column,
    row,
    width: Math.max(...columns) - column + 1,
    height: Math.max(...rows) - row + 1,
  };
}

export function isRectangleInsideFootprint(
  rectangle: FacilityGridRectangle,
  footprintCells: FacilityGridCell[],
): boolean {
  if (
    rectangle.gridColumn < 1 ||
    rectangle.gridRow < 1 ||
    rectangle.gridWidth < 1 ||
    rectangle.gridHeight < 1
  ) {
    return false;
  }
  const footprint = new Set(dedupeCells(footprintCells).map(cellKey));
  return expandRectangleToCells(rectangle).every(
    (cell) => isCellInsideGrid(cell) && footprint.has(cellKey(cell)),
  );
}

export function doRectanglesOverlap(
  left: FacilityGridRectangle,
  right: FacilityGridRectangle,
): boolean {
  return !(
    left.gridColumn + left.gridWidth - 1 < right.gridColumn ||
    right.gridColumn + right.gridWidth - 1 < left.gridColumn ||
    left.gridRow + left.gridHeight - 1 < right.gridRow ||
    right.gridRow + right.gridHeight - 1 < left.gridRow
  );
}

export function getAdjacentCells(cell: FacilityGridCell): FacilityGridCell[] {
  return [
    { column: cell.column, row: cell.row - 1 },
    { column: cell.column - 1, row: cell.row },
    { column: cell.column + 1, row: cell.row },
    { column: cell.column, row: cell.row + 1 },
  ].filter(isCellInsideGrid);
}

export function findRouteAcrossPathCells(input: {
  entryCells: FacilityGridCell[];
  exitCells?: FacilityGridCell[];
  pathCells: FacilityGridCell[];
  targetCells: FacilityGridCell[];
}): FacilityGridCell[] | null {
  const walkable = new Set(
    dedupeCells([
      ...input.pathCells,
      ...input.entryCells,
      ...(input.exitCells ?? []),
    ]).map(cellKey),
  );
  const targets = new Set(dedupeCells(input.targetCells).map(cellKey));
  const starts = dedupeCells(input.entryCells).filter((cell) =>
    walkable.has(cellKey(cell)),
  );
  if (starts.length === 0 || targets.size === 0) return null;

  const queue = starts.map((cell) => [cell]);
  const visited = new Set(starts.map(cellKey));
  while (queue.length > 0) {
    const route = queue.shift()!;
    const current = route[route.length - 1];
    if (targets.has(cellKey(current))) return route;
    for (const next of getAdjacentCells(current)) {
      const key = cellKey(next);
      if (!walkable.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push([...route, next]);
    }
  }
  return null;
}

export function getVenueRouteTargets(
  rectangle: FacilityGridRectangle,
  walkableCells: FacilityGridCell[],
): FacilityGridCell[] {
  const walkable = new Set(dedupeCells(walkableCells).map(cellKey));
  const region = new Set(expandRectangleToCells(rectangle).map(cellKey));
  return dedupeCells(
    expandRectangleToCells(rectangle).flatMap(getAdjacentCells),
  ).filter((cell) => !region.has(cellKey(cell)) && walkable.has(cellKey(cell)));
}
