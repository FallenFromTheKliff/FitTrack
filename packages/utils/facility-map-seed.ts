import type { FacilityFloorId } from "@fittrack/types";

export type FacilityGridCellSeed = Readonly<{
  column: number;
  row: number;
}>;

export type FacilityGridRectangleSeed = readonly [
  number,
  number,
  number,
  number,
];

export type FacilityMapSeed = {
  readonly footprint: readonly FacilityGridCellSeed[];
  readonly paths: readonly FacilityGridCellSeed[];
  readonly entries: readonly FacilityGridCellSeed[];
  readonly exits: readonly FacilityGridCellSeed[];
};

export type FacilityMapTranslation = {
  column: number;
  row: number;
};

/**
 * The persisted map uses a sparse list of grid cells rather than a rendered
 * canvas. Keep the logical origin inside the schema's finite coordinate
 * contract so a very large translated placement can fail closed.
 */
export const FACILITY_GRID_MIN = 1;
export const FACILITY_GRID_MAX = 1000;

export type ExistingFacilityMapSparseCells = {
  footprint_cells?: unknown;
  path_cells?: unknown;
  entry_cells?: unknown;
  exit_cells?: unknown;
};

export type FacilityMapEnvelope = {
  minColumn: number;
  maxColumn: number;
  minRow: number;
  maxRow: number;
};

export type FacilityMapSparseCellUpdate = {
  footprint_cells?: FacilityGridCellSeed[];
  path_cells?: FacilityGridCellSeed[];
  entry_cells?: FacilityGridCellSeed[];
  exit_cells?: FacilityGridCellSeed[];
};

export type FacilityMapRebase = {
  envelope: FacilityMapEnvelope;
  translation: FacilityMapTranslation;
  update: FacilityMapSparseCellUpdate;
};

export const FACILITY_MAP_LOGICAL_ORIGIN = {
  column: 500,
  row: 500,
} as const;

export const LEGACY_FACILITY_GRID_COLUMNS = 14;
export const LEGACY_FACILITY_GRID_ROWS = 10;

type FacilityCoordinateBounds = {
  maxColumn: number;
  maxRow: number;
};

/**
 * Exact placement emitted by the pre-sparse-grid seed. Keep it available to
 * the migration helpers, but never use it as the current canonical layout.
 */
export const LEGACY_FACILITY_FLOOR_MAP_SEEDS = {
  "floor-1": {
    footprint: Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 14 }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    )
      .flat()
      .filter((cell) => !(cell.row === 10 && cell.column > 12)),
    paths: [
      ...Array.from({ length: 10 }, (_, row) => ({ column: 8, row: row + 1 })),
      ...Array.from({ length: 14 }, (_, column) => ({
        column: column + 1,
        row: 5,
      })),
    ],
    entries: [{ column: 1, row: 5 }],
    exits: [{ column: 14, row: 5 }],
  },
  "floor-2": {
    footprint: Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 10 }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    ).flat(),
    paths: [
      ...Array.from({ length: 8 }, (_, row) => ({ column: 2, row: row + 2 })),
      ...Array.from({ length: 10 }, (_, column) => ({
        column: column + 1,
        row: 7,
      })),
    ],
    entries: [{ column: 1, row: 7 }],
    exits: [{ column: 10, row: 7 }],
  },
  "floor-3": {
    footprint: Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 12 }, (_, column) => ({
        column: column + 2,
        row: row + 1,
      })),
    ).flat(),
    paths: [
      ...Array.from({ length: 7 }, (_, row) => ({ column: 3, row: row + 2 })),
      ...Array.from({ length: 12 }, (_, column) => ({
        column: column + 2,
        row: 8,
      })),
    ],
    entries: [{ column: 2, row: 8 }],
    exits: [{ column: 13, row: 8 }],
  },
} as const satisfies Record<FacilityFloorId, FacilityMapSeed>;

function cellKey(cell: FacilityGridCellSeed) {
  return `${cell.column}:${cell.row}`;
}

/** Compare cells as an order-insensitive multiset, retaining duplicate paths. */
function exactCellSet(
  actual: unknown,
  expected: readonly FacilityGridCellSeed[],
  bounds?: FacilityCoordinateBounds,
) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    return false;
  }

  const actualKeys: string[] = [];
  for (const cell of actual) {
    if (
      !cell ||
      typeof cell !== "object" ||
      !Number.isSafeInteger((cell as { column?: unknown }).column) ||
      !Number.isSafeInteger((cell as { row?: unknown }).row)
    ) {
      return false;
    }
    const parsed = cell as FacilityGridCellSeed;
    if (
      bounds &&
      (parsed.column < FACILITY_GRID_MIN ||
        parsed.column > bounds.maxColumn ||
        parsed.row < FACILITY_GRID_MIN ||
        parsed.row > bounds.maxRow)
    ) {
      return false;
    }
    actualKeys.push(cellKey(parsed));
  }

  const expectedKeys = expected.map(cellKey).sort();
  actualKeys.sort();
  return actualKeys.every((key, index) => key === expectedKeys[index]);
}

function exactMapSeed(
  actual: unknown,
  expected: FacilityMapSeed,
  bounds?: FacilityCoordinateBounds,
) {
  if (!actual || typeof actual !== "object") return false;
  const metadata = actual as {
    footprint_cells?: unknown;
    path_cells?: unknown;
    entry_cells?: unknown;
    exit_cells?: unknown;
    grid_width?: unknown;
    grid_height?: unknown;
  };

  // Dimensions were always 14 x 10 in the legacy seed. Missing dimensions are
  // tolerated because older rows may predate those columns being populated.
  if (
    (metadata.grid_width != null &&
      metadata.grid_width !== LEGACY_FACILITY_GRID_COLUMNS) ||
    (metadata.grid_height != null &&
      metadata.grid_height !== LEGACY_FACILITY_GRID_ROWS)
  ) {
    return false;
  }

  return (
    exactCellSet(metadata.footprint_cells, expected.footprint, bounds) &&
    exactCellSet(metadata.path_cells, expected.paths, bounds) &&
    exactCellSet(metadata.entry_cells, expected.entries, bounds) &&
    exactCellSet(metadata.exit_cells, expected.exits, bounds)
  );
}

function sameMapSeed(left: FacilityMapSeed, right: FacilityMapSeed) {
  return (
    exactCellSet(left.footprint, right.footprint) &&
    exactCellSet(left.paths, right.paths) &&
    exactCellSet(left.entries, right.entries) &&
    exactCellSet(left.exits, right.exits)
  );
}

function mapEnvelope(seed: FacilityMapSeed) {
  const cells = [
    ...seed.footprint,
    ...seed.paths,
    ...seed.entries,
    ...seed.exits,
  ];
  const columns = cells.map((cell) => cell.column);
  const rows = cells.map((cell) => cell.row);
  return {
    minColumn: Math.min(...columns),
    maxColumn: Math.max(...columns),
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
  };
}

const FACILITY_MAP_CELL_FIELDS = [
  "footprint_cells",
  "path_cells",
  "entry_cells",
  "exit_cells",
] as const;

type FacilityMapCellField = (typeof FACILITY_MAP_CELL_FIELDS)[number];

type ParsedFacilityMapCells = {
  cellsByField: Record<FacilityMapCellField, FacilityGridCellSeed[]>;
  allCells: FacilityGridCellSeed[];
};

function isFacilityGridCellWithinBounds(cell: FacilityGridCellSeed) {
  return (
    cell.column >= FACILITY_GRID_MIN &&
    cell.column <= FACILITY_GRID_MAX &&
    cell.row >= FACILITY_GRID_MIN &&
    cell.row <= FACILITY_GRID_MAX
  );
}

function parseExistingFacilityMapCells(
  existing: ExistingFacilityMapSparseCells,
): ParsedFacilityMapCells | null {
  if (!existing || typeof existing !== "object") return null;

  const cellsByField = {} as Record<
    FacilityMapCellField,
    FacilityGridCellSeed[]
  >;
  const allCells: FacilityGridCellSeed[] = [];

  for (const field of FACILITY_MAP_CELL_FIELDS) {
    const value = existing[field];
    if (value == null) {
      cellsByField[field] = [];
      continue;
    }
    if (!Array.isArray(value)) return null;

    const cells: FacilityGridCellSeed[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") return null;
      const cell = item as { column?: unknown; row?: unknown };
      if (
        !Number.isSafeInteger(cell.column) ||
        !Number.isSafeInteger(cell.row)
      ) {
        return null;
      }
      const parsed = {
        column: cell.column as number,
        row: cell.row as number,
      };
      if (!isFacilityGridCellWithinBounds(parsed)) return null;
      cells.push(parsed);
      allCells.push(parsed);
    }
    cellsByField[field] = cells;
  }

  return { cellsByField, allCells };
}

/**
 * Return the envelope of all persisted sparse map cells. A null result means
 * the metadata is absent, malformed, or contains coordinates outside the
 * database coordinate contract.
 */
export function getFacilityExistingMapEnvelope(
  existing: ExistingFacilityMapSparseCells,
): FacilityMapEnvelope | null {
  const parsed = parseExistingFacilityMapCells(existing);
  if (!parsed || parsed.allCells.length === 0) return null;

  const columns = parsed.allCells.map((cell) => cell.column);
  const rows = parsed.allCells.map((cell) => cell.row);
  return {
    minColumn: Math.min(...columns),
    maxColumn: Math.max(...columns),
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
  };
}

function translationForExistingEnvelope(
  envelope: FacilityMapEnvelope,
): FacilityMapTranslation {
  const columnCenter = (envelope.minColumn + envelope.maxColumn) / 2;
  const rowCenter = (envelope.minRow + envelope.maxRow) / 2;
  // Cell envelopes are integral or half-integral. Floor keeps the same
  // deterministic half-cell convention as the canonical seed translation.
  return {
    column:
      Math.abs(columnCenter - FACILITY_MAP_LOGICAL_ORIGIN.column) <= 0.5
        ? 0
        : FACILITY_MAP_LOGICAL_ORIGIN.column - Math.floor(columnCenter),
    row:
      Math.abs(rowCenter - FACILITY_MAP_LOGICAL_ORIGIN.row) <= 0.5
        ? 0
        : FACILITY_MAP_LOGICAL_ORIGIN.row - Math.floor(rowCenter),
  };
}

/**
 * Rebase an existing sparse facility map around the logical origin. The
 * returned update preserves every list's order, duplicates, and shape. A
 * centered map returns an empty update, while malformed/out-of-bounds input
 * returns null so callers can leave the floor untouched.
 */
export function calculateFacilityMapRebase(
  existing: ExistingFacilityMapSparseCells,
): FacilityMapRebase | null {
  const parsed = parseExistingFacilityMapCells(existing);
  if (!parsed || parsed.allCells.length === 0) return null;

  const columns = parsed.allCells.map((cell) => cell.column);
  const rows = parsed.allCells.map((cell) => cell.row);
  const envelope: FacilityMapEnvelope = {
    minColumn: Math.min(...columns),
    maxColumn: Math.max(...columns),
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
  };
  const translation = translationForExistingEnvelope(envelope);
  const update: FacilityMapSparseCellUpdate = {};

  if (translation.column === 0 && translation.row === 0) {
    return { envelope, translation, update };
  }

  for (const field of FACILITY_MAP_CELL_FIELDS) {
    const source = parsed.cellsByField[field];
    if (existing[field] == null) continue;
    const translated = source.map((cell) => ({
      column: cell.column + translation.column,
      row: cell.row + translation.row,
    }));
    if (!translated.every(isFacilityGridCellWithinBounds)) return null;
    update[field] = translated;
  }

  return { envelope, translation, update };
}

/** Return the deterministic integer offset that centers a legacy envelope. */
export function getFacilityMapTranslation(
  seed: FacilityMapSeed,
): FacilityMapTranslation {
  const envelope = mapEnvelope(seed);
  return {
    column:
      FACILITY_MAP_LOGICAL_ORIGIN.column -
      Math.floor((envelope.minColumn + envelope.maxColumn) / 2),
    row:
      FACILITY_MAP_LOGICAL_ORIGIN.row -
      Math.floor((envelope.minRow + envelope.maxRow) / 2),
  };
}

export function getFacilityFloorMapTranslation(
  floorId: FacilityFloorId,
): FacilityMapTranslation {
  return getFacilityMapTranslation(LEGACY_FACILITY_FLOOR_MAP_SEEDS[floorId]);
}

export function translateFacilityGridCell(
  cell: FacilityGridCellSeed,
  translation: FacilityMapTranslation,
): FacilityGridCellSeed {
  return {
    column: cell.column + translation.column,
    row: cell.row + translation.row,
  };
}

export function translateFacilityGridCells(
  cells: readonly FacilityGridCellSeed[],
  translation: FacilityMapTranslation,
): FacilityGridCellSeed[] {
  return cells.map((cell) => translateFacilityGridCell(cell, translation));
}

export function translateFacilityGridRectangle(
  floorId: FacilityFloorId,
  rectangle: FacilityGridRectangleSeed,
): FacilityGridRectangleSeed {
  const translation = getFacilityFloorMapTranslation(floorId);
  return [
    rectangle[0] + translation.column,
    rectangle[1] + translation.row,
    rectangle[2],
    rectangle[3],
  ];
}

export function translateFacilityFloorMapSeed(
  floorId: FacilityFloorId,
): FacilityMapSeed {
  const seed = LEGACY_FACILITY_FLOOR_MAP_SEEDS[floorId];
  const translation = getFacilityMapTranslation(seed);
  return {
    footprint: translateFacilityGridCells(seed.footprint, translation),
    paths: translateFacilityGridCells(seed.paths, translation),
    entries: translateFacilityGridCells(seed.entries, translation),
    exits: translateFacilityGridCells(seed.exits, translation),
  };
}

/** Canonical floor maps are centered while remaining sparse cell lists. */
export const FACILITY_FLOOR_MAP_SEEDS = {
  "floor-1": translateFacilityFloorMapSeed("floor-1"),
  "floor-2": translateFacilityFloorMapSeed("floor-2"),
  "floor-3": translateFacilityFloorMapSeed("floor-3"),
} as const satisfies Record<FacilityFloorId, FacilityMapSeed>;

export function isExactLegacyFacilityFloorMap(
  existing: unknown,
  floorId: FacilityFloorId,
) {
  return exactMapSeed(existing, LEGACY_FACILITY_FLOOR_MAP_SEEDS[floorId], {
    maxColumn: LEGACY_FACILITY_GRID_COLUMNS,
    maxRow: LEGACY_FACILITY_GRID_ROWS,
  });
}

export function isExactCenteredFacilityFloorMap(
  existing: unknown,
  floorId: FacilityFloorId,
) {
  return exactMapSeed(existing, FACILITY_FLOOR_MAP_SEEDS[floorId], {
    maxColumn: FACILITY_GRID_MAX,
    maxRow: FACILITY_GRID_MAX,
  });
}

/** Exposed for focused seed tests and callers that need order-insensitive JSON comparison. */
export function isExactFacilityCellSet(
  actual: unknown,
  expected: readonly FacilityGridCellSeed[],
) {
  return exactCellSet(actual, expected);
}

export type ExistingFacilityGridRectangle = {
  floor_id?: unknown;
  floorId?: unknown;
  grid_column?: unknown;
  gridColumn?: unknown;
  grid_row?: unknown;
  gridRow?: unknown;
  grid_width?: unknown;
  gridWidth?: unknown;
  grid_height?: unknown;
  gridHeight?: unknown;
};

function readValue(
  record: ExistingFacilityGridRectangle,
  snakeKey: keyof ExistingFacilityGridRectangle,
  camelKey: keyof ExistingFacilityGridRectangle,
) {
  return record[snakeKey] !== undefined ? record[snakeKey] : record[camelKey];
}

function isFacilityFloorId(value: unknown): value is FacilityFloorId {
  return value === "floor-1" || value === "floor-2" || value === "floor-3";
}

/**
 * Translate a placed amenity/equipment rectangle without changing its
 * dimensions or any business fields. Null is returned for a malformed or
 * out-of-bounds placement so a caller can skip the whole floor safely.
 */
export function translateFacilityGridPlacement(
  existing: unknown,
  translation: FacilityMapTranslation,
): { grid_column: number; grid_row: number } | null {
  if (!existing || typeof existing !== "object") return null;
  const record = existing as ExistingFacilityGridRectangle;
  const column = readValue(record, "grid_column", "gridColumn");
  const row = readValue(record, "grid_row", "gridRow");
  const width = readValue(record, "grid_width", "gridWidth");
  const height = readValue(record, "grid_height", "gridHeight");
  if (
    !Number.isSafeInteger(column) ||
    !Number.isSafeInteger(row) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    (width as number) < 1 ||
    (height as number) < 1
  ) {
    return null;
  }

  // Treat persisted rectangles outside the sparse-grid contract as invalid
  // before applying any translation. A translated rectangle that happens to
  // land inside the contract is not a safe repair for malformed source data.
  if (
    (column as number) < FACILITY_GRID_MIN ||
    (row as number) < FACILITY_GRID_MIN ||
    (column as number) + (width as number) - 1 > FACILITY_GRID_MAX ||
    (row as number) + (height as number) - 1 > FACILITY_GRID_MAX
  ) {
    return null;
  }

  const translatedColumn = (column as number) + translation.column;
  const translatedRow = (row as number) + translation.row;
  if (
    translatedColumn < FACILITY_GRID_MIN ||
    translatedRow < FACILITY_GRID_MIN ||
    translatedColumn + (width as number) - 1 > FACILITY_GRID_MAX ||
    translatedRow + (height as number) - 1 > FACILITY_GRID_MAX
  ) {
    return null;
  }
  return {
    grid_column: translatedColumn,
    grid_row: translatedRow,
  };
}

/**
 * Recognize only a complete legacy rectangle corresponding to a centered
 * canonical rectangle. Partial, custom, or moved rows deliberately fail.
 */
export function isExactLegacyFacilityGridRectangle(
  existing: unknown,
  floorId: FacilityFloorId,
  centeredRectangle: FacilityGridRectangleSeed,
) {
  if (!existing || typeof existing !== "object") return false;
  const record = existing as ExistingFacilityGridRectangle;
  const storedFloor = readValue(record, "floor_id", "floorId");
  if (storedFloor !== floorId) return false;

  const translation = getFacilityFloorMapTranslation(floorId);
  const expected = [
    centeredRectangle[0] - translation.column,
    centeredRectangle[1] - translation.row,
    centeredRectangle[2],
    centeredRectangle[3],
  ] as const;
  const column = readValue(record, "grid_column", "gridColumn");
  const row = readValue(record, "grid_row", "gridRow");
  const width = readValue(record, "grid_width", "gridWidth");
  const height = readValue(record, "grid_height", "gridHeight");
  if (
    !Number.isSafeInteger(column) ||
    !Number.isSafeInteger(row) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    (width as number) < 1 ||
    (height as number) < 1 ||
    (column as number) < FACILITY_GRID_MIN ||
    (row as number) < FACILITY_GRID_MIN ||
    (column as number) + (width as number) - 1 > LEGACY_FACILITY_GRID_COLUMNS ||
    (row as number) + (height as number) - 1 > LEGACY_FACILITY_GRID_ROWS
  ) {
    return false;
  }
  return (
    column === expected[0] &&
    row === expected[1] &&
    width === expected[2] &&
    height === expected[3]
  );
}

export type FacilitySeedMode = "additive" | "reset";

export function shouldApplyCanonicalAmenityUpdate(
  mode: FacilitySeedMode,
  persistedId: string,
  desiredId: string,
) {
  return mode === "reset" && persistedId === desiredId;
}

export function shouldRepairCanonicalAmenityReservability(
  mode: FacilitySeedMode,
  canonicalIsReservable: boolean,
  storedIsReservable: boolean | null | undefined,
  storedHourlyRate: number | string | { toString(): string } | null | undefined,
) {
  if (
    mode !== "additive" ||
    canonicalIsReservable ||
    storedIsReservable !== true
  ) {
    return false;
  }
  if (storedHourlyRate == null) return true;
  const normalizedRate = Number(storedHourlyRate);
  return Number.isFinite(normalizedRate) && normalizedRate <= 0;
}

const EQUIPMENT_LAYOUT_FIELDS = [
  "floor_id",
  "grid_column",
  "grid_row",
  "grid_width",
  "grid_height",
  "position_x",
  "position_y",
  "venue_id",
] as const;

type EquipmentSeedData = ExistingFacilityGridRectangle & {
  position_x?: unknown;
  position_y?: unknown;
  venue_id?: unknown;
};

function sameNumericValue(left: unknown, right: unknown) {
  if (left === undefined || right === undefined) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return Number.isFinite(leftNumber) && leftNumber === rightNumber;
}

/**
 * Match the full legacy equipment placement before translating it. Requiring
 * the compatibility position and venue fields protects custom reassignment.
 */
export function isExactLegacyGymEquipmentPlacement(
  existing: unknown,
  centeredData: Record<string, unknown>,
) {
  const floorId = centeredData.floor_id;
  if (!isFacilityFloorId(floorId)) return false;
  if (
    !isExactLegacyFacilityGridRectangle(existing, floorId, [
      Number(centeredData.grid_column),
      Number(centeredData.grid_row),
      Number(centeredData.grid_width),
      Number(centeredData.grid_height),
    ])
  ) {
    return false;
  }
  if (!existing || typeof existing !== "object") return false;
  const stored = existing as EquipmentSeedData;
  return (
    sameNumericValue(stored.position_x, centeredData.position_x) &&
    sameNumericValue(stored.position_y, centeredData.position_y) &&
    (stored.venue_id === undefined ||
      centeredData.venue_id === undefined ||
      stored.venue_id === centeredData.venue_id)
  );
}

export function buildGymEquipmentSeedUpdate<T extends Record<string, unknown>>(
  mode: FacilitySeedMode,
  data: T,
  existing?: Record<string, unknown>,
): Partial<T> {
  if (mode === "reset") return data;

  // Keep the two-argument helper compatible for focused unit callers. The
  // seeded domain always supplies `existing` so additive mode can distinguish
  // exact legacy rows from moved/custom rows.
  if (existing !== undefined) {
    if (!isExactLegacyGymEquipmentPlacement(existing, data)) return {};
    const update = {} as Partial<T>;
    for (const field of EQUIPMENT_LAYOUT_FIELDS) {
      if (field in data) {
        update[field as keyof T] = data[field] as T[keyof T];
      }
    }
    return update;
  }

  const update = { ...data } as Partial<T>;
  for (const field of EQUIPMENT_LAYOUT_FIELDS) {
    delete update[field as keyof T];
  }
  return update;
}

function canonicalFloorIdForSeed(seed: FacilityMapSeed) {
  for (const floorId of ["floor-1", "floor-2", "floor-3"] as const) {
    if (
      sameMapSeed(seed, LEGACY_FACILITY_FLOOR_MAP_SEEDS[floorId]) ||
      sameMapSeed(seed, FACILITY_FLOOR_MAP_SEEDS[floorId])
    ) {
      return floorId;
    }
  }
  return null;
}

type ExistingFloorMapMetadata = {
  entry_cells?: unknown;
  exit_cells?: unknown;
  footprint_cells?: unknown;
  path_cells?: unknown;
  grid_width?: unknown;
  grid_height?: unknown;
};

function centeredMapUpdate(seed: FacilityMapSeed) {
  return {
    grid_width: LEGACY_FACILITY_GRID_COLUMNS,
    grid_height: LEGACY_FACILITY_GRID_ROWS,
    footprint_cells: seed.footprint,
    path_cells: seed.paths,
    entry_cells: seed.entries,
    exit_cells: seed.exits,
  };
}

export function buildAdditiveFloorMapUpdate(
  existing: ExistingFloorMapMetadata,
  seed: FacilityMapSeed,
) {
  const floorId = canonicalFloorIdForSeed(seed);
  if (floorId && isExactLegacyFacilityFloorMap(existing, floorId)) {
    return centeredMapUpdate(seed);
  }
  if (floorId && isExactCenteredFacilityFloorMap(existing, floorId)) {
    return {};
  }

  const retainsPublishedFootprint =
    Array.isArray(existing.footprint_cells) &&
    existing.footprint_cells.length > 0;
  const navigationFallback = retainsPublishedFootprint
    ? ([] as const)
    : undefined;
  const update: Record<string, unknown> = {};

  if (existing.grid_width == null)
    update.grid_width = LEGACY_FACILITY_GRID_COLUMNS;
  if (existing.grid_height == null)
    update.grid_height = LEGACY_FACILITY_GRID_ROWS;
  if (!retainsPublishedFootprint) update.footprint_cells = seed.footprint;
  if (!Array.isArray(existing.path_cells)) {
    update.path_cells = navigationFallback ?? seed.paths;
  }
  if (!Array.isArray(existing.entry_cells)) {
    update.entry_cells = navigationFallback ?? seed.entries;
  }
  if (!Array.isArray(existing.exit_cells)) {
    update.exit_cells = navigationFallback ?? seed.exits;
  }
  return update;
}

export function buildFacilityFloorMapSeedUpdate(
  mode: FacilitySeedMode,
  existing: ExistingFloorMapMetadata,
  seed: FacilityMapSeed,
) {
  if (mode === "reset") return centeredMapUpdate(seed);
  return buildAdditiveFloorMapUpdate(existing, seed);
}
