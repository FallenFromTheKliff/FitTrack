import type { EquipmentStatus } from "./base";
import type { FacilityFloorId, FloorVenueRecord } from "./facilities";

export type GymLayoutEquipmentRecord = {
  createdAt: string;
  floorId: FacilityFloorId;
  gridColumn: number;
  gridHeight: number | null;
  gridRow: number;
  gridWidth: number | null;
  iconKey: string | null;
  id: string;
  imageUrl: string | null;
  inventoryItemId: string | null;
  isActive: boolean;
  name: string;
  positionX: number;
  positionY: number;
  placedQuantity: number;
  remainingPlaceableQuantity: number | null;
  status: EquipmentStatus;
  type: string;
  updatedAt: string;
  venueId: string | null;
};

export type GymLayoutEquipmentMutationInput = {
  floorId: FacilityFloorId;
  gridColumn?: number;
  gridHeight?: number;
  gridRow?: number;
  gridWidth?: number;
  iconKey?: string | null;
  isActive?: boolean;
  inventoryItemId?: string;
  name?: string;
  positionX?: number;
  positionY?: number;
  status?: EquipmentStatus;
  type?: string;
  venueId?: string;
};

export type FacilityFloorPlanMediaRecord = {
  createdAt: string;
  floorId: FacilityFloorId;
  gridHeight: number;
  gridWidth: number;
  imageUrl: string | null;
  updatedAt: string;
};

export type FacilityFloorPlanMediaMutationInput = {
  floorId: FacilityFloorId;
  gridHeight?: number;
  gridWidth?: number;
  imageUrl?: string | null;
};

export type GymLayoutDeltaOperation = "remove" | "upsert";

export type GymLayoutRealtimeDelta = {
  equipment: GymLayoutEquipmentRecord;
  operation: GymLayoutDeltaOperation;
};

export const GYM_LAYOUT_NAMESPACE = "/gym-layout";
export const GYM_LAYOUT_DELTA_EVENT = "gym-layout.delta";
export const GYM_LAYOUT_SNAPSHOT_EVENT = "gym-layout.snapshot";
export const GYM_LAYOUT_GRID_COLUMNS = 14;
export const GYM_LAYOUT_GRID_ROWS = 10;

export type VenueEquipmentAssignments = Record<string, string[]>;

export type VenueEquipmentAssignmentsByFloor = Record<
  FacilityFloorId,
  VenueEquipmentAssignments
>;

function clampGridColumn(value: number) {
  return Math.max(1, Math.min(GYM_LAYOUT_GRID_COLUMNS, Math.round(value)));
}

function clampGridRow(value: number) {
  return Math.max(1, Math.min(GYM_LAYOUT_GRID_ROWS, Math.round(value)));
}

export function gridColumnToPositionX(gridColumn: number) {
  return Number(
    (((clampGridColumn(gridColumn) - 0.5) / GYM_LAYOUT_GRID_COLUMNS) * 100).toFixed(
      2,
    ),
  );
}

export function gridRowToPositionY(gridRow: number) {
  return Number(
    (((clampGridRow(gridRow) - 0.5) / GYM_LAYOUT_GRID_ROWS) * 100).toFixed(2),
  );
}

export function positionXToGridColumn(positionX: number) {
  return clampGridColumn(((positionX / 100) * GYM_LAYOUT_GRID_COLUMNS) + 0.5);
}

export function positionYToGridRow(positionY: number) {
  return clampGridRow(((positionY / 100) * GYM_LAYOUT_GRID_ROWS) + 0.5);
}

export function resolveEquipmentGridPlacement(
  equipment: Pick<
    Partial<GymLayoutEquipmentRecord>,
    "gridColumn" | "gridRow" | "positionX" | "positionY"
  >,
) {
  const gridColumn =
    equipment.gridColumn ??
    (equipment.positionX !== undefined
      ? positionXToGridColumn(equipment.positionX)
      : 1);
  const gridRow =
    equipment.gridRow ??
    (equipment.positionY !== undefined ? positionYToGridRow(equipment.positionY) : 1);

  return {
    gridColumn: clampGridColumn(gridColumn),
    gridRow: clampGridRow(gridRow),
  };
}

export function createEmptyVenueEquipmentAssignments(): VenueEquipmentAssignmentsByFloor {
  return {
    "floor-1": {},
    "floor-2": {},
    "floor-3": {},
  };
}

function normalizeCatalogKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveEquipmentCatalogKey(
  equipment: Pick<GymLayoutEquipmentRecord, "iconKey" | "name">,
): string {
  const fromIcon = normalizeCatalogKey(equipment.iconKey);
  if (fromIcon) {
    return fromIcon;
  }

  return normalizeCatalogKey(equipment.name);
}

export function resolveVenueCenter(
  venue: Pick<
    FloorVenueRecord,
    "gridColumn" | "gridHeight" | "gridRow" | "gridWidth"
  >,
) {
  const gridColumn = clampGridColumn(
    (venue.gridColumn ?? 1) + (((venue.gridWidth ?? 1) - 1) / 2),
  );
  const gridRow = clampGridRow(
    (venue.gridRow ?? 1) + (((venue.gridHeight ?? 1) - 1) / 2),
  );
  const gridWidth = venue.gridWidth ?? 1;
  const gridHeight = venue.gridHeight ?? 1;

  return {
    gridColumn,
    gridHeight,
    gridRow,
    gridWidth,
    positionX: gridColumnToPositionX(gridColumn),
    positionY: gridRowToPositionY(gridRow),
  };
}

export function isEquipmentInsideVenue(
  equipment: Pick<
    GymLayoutEquipmentRecord,
    "floorId" | "gridColumn" | "gridRow" | "positionX" | "positionY"
  >,
  venue: Pick<
    FloorVenueRecord,
    "floorId" | "gridColumn" | "gridHeight" | "gridRow" | "gridWidth"
  >,
) {
  if (equipment.floorId !== venue.floorId) {
    return false;
  }

  const placement = resolveEquipmentGridPlacement(equipment);
  const left = venue.gridColumn ?? 1;
  const top = venue.gridRow ?? 1;
  const right = left + (venue.gridWidth ?? 1) - 1;
  const bottom = top + (venue.gridHeight ?? 1) - 1;

  return (
    placement.gridColumn >= left &&
    placement.gridColumn <= right &&
    placement.gridRow >= top &&
    placement.gridRow <= bottom
  );
}

export function listVenueEquipment(
  equipment: GymLayoutEquipmentRecord[],
  venue: FloorVenueRecord,
) {
  return equipment
    .filter((item) => isEquipmentInsideVenue(item, venue))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildVenueEquipmentAssignmentsFromRecords(
  equipment: GymLayoutEquipmentRecord[],
  floorVenues: Record<FacilityFloorId, FloorVenueRecord[]>,
): VenueEquipmentAssignmentsByFloor {
  const assignments = createEmptyVenueEquipmentAssignments();

  equipment.forEach((item) => {
    const venue = floorVenues[item.floorId].find((candidate) =>
      isEquipmentInsideVenue(item, candidate),
    );

    if (!venue?.mapId) {
      return;
    }

    const current = assignments[item.floorId][venue.mapId] ?? [];
    assignments[item.floorId][venue.mapId] = current.includes(item.id)
      ? current
      : [...current, item.id];
  });

  return assignments;
}

export function buildEquipmentRecordMapById(
  equipment: GymLayoutEquipmentRecord[],
) {
  return equipment.reduce<Record<string, GymLayoutEquipmentRecord>>(
    (accumulator, item) => {
      accumulator[item.id] = item;
      return accumulator;
    },
    {},
  );
}
