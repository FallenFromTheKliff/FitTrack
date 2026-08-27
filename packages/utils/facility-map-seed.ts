export const FACILITY_FLOOR_MAP_SEEDS = {
  "floor-1": {
    footprint: Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 14 }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    ).flat().filter((cell) => !(cell.row === 10 && cell.column > 12)),
    paths: [
      ...Array.from({ length: 10 }, (_, row) => ({ column: 8, row: row + 1 })),
      ...Array.from({ length: 14 }, (_, column) => ({ column: column + 1, row: 5 })),
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
      ...Array.from({ length: 10 }, (_, column) => ({ column: column + 1, row: 7 })),
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
      ...Array.from({ length: 12 }, (_, column) => ({ column: column + 2, row: 8 })),
    ],
    entries: [{ column: 2, row: 8 }],
    exits: [{ column: 13, row: 8 }],
  },
} as const;

type FacilityMapSeed = (typeof FACILITY_FLOOR_MAP_SEEDS)[keyof typeof FACILITY_FLOOR_MAP_SEEDS];

type ExistingFloorMapMetadata = {
  entry_cells?: unknown;
  exit_cells?: unknown;
  footprint_cells?: unknown;
  path_cells?: unknown;
};

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

export function buildGymEquipmentSeedUpdate<T extends Record<string, unknown>>(
  mode: FacilitySeedMode,
  data: T,
): Partial<T> {
  if (mode === "reset") return data;
  const update = { ...data } as Partial<T>;
  for (const field of EQUIPMENT_LAYOUT_FIELDS) {
    delete update[field as keyof T];
  }
  return update;
}

function isPublishedCellSet(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isPublishedFootprint(value: unknown): value is readonly unknown[] {
  return isPublishedCellSet(value) && value.length > 0;
}

export function buildAdditiveFloorMapUpdate(
  existing: ExistingFloorMapMetadata,
  seed: FacilityMapSeed,
) {
  const retainsPublishedFootprint = isPublishedFootprint(
    existing.footprint_cells,
  );
  const navigationFallback = retainsPublishedFootprint
    ? ([] as const)
    : undefined;
  return {
    grid_width: 14,
    grid_height: 10,
    ...(isPublishedFootprint(existing.footprint_cells)
      ? {}
      : { footprint_cells: seed.footprint }),
    ...(isPublishedCellSet(existing.path_cells)
      ? {}
      : { path_cells: navigationFallback ?? seed.paths }),
    ...(isPublishedCellSet(existing.entry_cells)
      ? {}
      : { entry_cells: navigationFallback ?? seed.entries }),
    ...(isPublishedCellSet(existing.exit_cells)
      ? {}
      : { exit_cells: navigationFallback ?? seed.exits }),
  };
}

export function buildFacilityFloorMapSeedUpdate(
  mode: FacilitySeedMode,
  existing: ExistingFloorMapMetadata,
  seed: FacilityMapSeed,
) {
  if (mode === "reset") {
    return {
      grid_width: 14,
      grid_height: 10,
      footprint_cells: seed.footprint,
      path_cells: seed.paths,
      entry_cells: seed.entries,
      exit_cells: seed.exits,
    };
  }

  return buildAdditiveFloorMapUpdate(existing, seed);
}
