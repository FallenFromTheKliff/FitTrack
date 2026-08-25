import type { VenueRecord } from "@/components/map";
import type { FacilityFloorId, FacilityGridCell } from "@fittrack/types";
import { cellKey, expandRectangleToCells } from "@fittrack/utils";
import {
  SCHEDULE_EMOJI_OPTIONS,
  type ResourceDraft,
  type ScheduleResourceType
} from "@/data/facilities/resources";
import { COLS, ROWS } from "@/data/facilities/mapTypes";
import { VENUE_INITIAL_VALUES } from "@/data/facilities/venueFields";

export function getDefaultResourceDraft(): ResourceDraft {
  return {
    name: "",
    type: "",
    icon: SCHEDULE_EMOJI_OPTIONS[0]
  };
}

export function createScheduleResourceId(type: ScheduleResourceType, name: string) {
  return `${type}-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
}

type VenuePlacementCandidate = {
  floorId: FacilityFloorId;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
};

type VenuePlacementContext = {
  entryCells?: readonly FacilityGridCell[];
  exitCells?: readonly FacilityGridCell[];
  floorId?: FacilityFloorId;
  footprintCells?: readonly FacilityGridCell[];
  pathCells?: readonly FacilityGridCell[];
  venues?: readonly VenueRecord[];
};

function rectanglesOverlap(
  left: VenuePlacementCandidate,
  right: VenuePlacementCandidate,
) {
  return !(
    left.gridColumn + left.gridWidth - 1 < right.gridColumn ||
    right.gridColumn + right.gridWidth - 1 < left.gridColumn ||
    left.gridRow + left.gridHeight - 1 < right.gridRow ||
    right.gridRow + right.gridHeight - 1 < left.gridRow
  );
}

function fullPlanningGrid() {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, column) => ({
      column: column + 1,
      row: row + 1,
    })),
  ).flat();
}

export function findDeterministicVenuePlacement(args: {
  floorId: FacilityFloorId;
  gridHeight: number;
  gridWidth: number;
  footprintCells?: readonly FacilityGridCell[];
  entryCells?: readonly FacilityGridCell[];
  exitCells?: readonly FacilityGridCell[];
  pathCells?: readonly FacilityGridCell[];
  venues?: readonly VenueRecord[];
}) {
  const footprint = new Set(
    (args.footprintCells ?? fullPlanningGrid()).map(cellKey),
  );
  const paths = new Set(
    [
      ...(args.pathCells ?? []),
      ...(args.entryCells ?? []),
      ...(args.exitCells ?? []),
    ].map(cellKey),
  );
  const occupied = (args.venues ?? [])
    .filter(
      (venue) =>
        venue.floorId === args.floorId && venue.isMapped !== false,
    )
    .map((venue) => ({
      floorId: args.floorId,
      gridColumn: venue.gridColumn ?? 1,
      gridHeight: venue.gridHeight ?? 2,
      gridRow: venue.gridRow ?? 1,
      gridWidth: venue.gridWidth ?? 2,
    }));

  for (let gridRow = 1; gridRow <= ROWS - args.gridHeight + 1; gridRow += 1) {
    for (
      let gridColumn = 1;
      gridColumn <= COLS - args.gridWidth + 1;
      gridColumn += 1
    ) {
      const candidate = {
        floorId: args.floorId,
        gridColumn,
        gridHeight: args.gridHeight,
        gridRow,
        gridWidth: args.gridWidth,
      } satisfies VenuePlacementCandidate;
      const cells = expandRectangleToCells(candidate);
      if (
        cells.every((cell) => footprint.has(cellKey(cell)) && !paths.has(cellKey(cell))) &&
        !occupied.some((existing) => rectanglesOverlap(candidate, existing))
      ) {
        return {
          gridColumn,
          gridRow,
        };
      }
    }
  }

  return null;
}

export function validateVenuePlacement(args: {
  floorId: FacilityFloorId;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
  footprintCells?: readonly FacilityGridCell[];
  entryCells?: readonly FacilityGridCell[];
  exitCells?: readonly FacilityGridCell[];
  pathCells?: readonly FacilityGridCell[];
  venues?: readonly VenueRecord[];
  excludeVenueId?: VenueRecord["id"];
}) {
  const footprint = new Set(
    (args.footprintCells ?? fullPlanningGrid()).map(cellKey),
  );
  const paths = new Set(
    [
      ...(args.pathCells ?? []),
      ...(args.entryCells ?? []),
      ...(args.exitCells ?? []),
    ].map(cellKey),
  );
  const candidate = {
    floorId: args.floorId,
    gridColumn: args.gridColumn,
    gridHeight: args.gridHeight,
    gridRow: args.gridRow,
    gridWidth: args.gridWidth,
  } satisfies VenuePlacementCandidate;
  const cells = expandRectangleToCells(candidate);

  if (!cells.every((cell) => footprint.has(cellKey(cell)))) {
    return "This placement is outside the published building footprint. Paint the building cell first or choose another position.";
  }
  if (cells.some((cell) => paths.has(cellKey(cell)))) {
    return "This placement overlaps a published navigation cell. Choose a clear building cell.";
  }

  const overlap = (args.venues ?? [])
    .filter(
      (venue) =>
        venue.id !== args.excludeVenueId &&
        venue.floorId === args.floorId &&
        venue.isMapped !== false,
    )
    .find((venue) =>
      rectanglesOverlap(candidate, {
        floorId: args.floorId,
        gridColumn: venue.gridColumn ?? 1,
        gridHeight: venue.gridHeight ?? 2,
        gridRow: venue.gridRow ?? 1,
        gridWidth: venue.gridWidth ?? 2,
      }),
    );
  return overlap
    ? `This position overlaps with "${overlap.name}". Adjust the grid position or size.`
    : null;
}

export function buildVenueInitialValues(
  venueEditTarget: VenueRecord | null,
  placementContext: VenuePlacementContext = {},
) {
  if (!venueEditTarget) {
    const floorId = placementContext.floorId ?? "floor-1";
    const placement = findDeterministicVenuePlacement({
      floorId,
      gridHeight: Number(VENUE_INITIAL_VALUES.gridHeight),
      gridWidth: Number(VENUE_INITIAL_VALUES.gridWidth),
      entryCells: placementContext.entryCells,
      exitCells: placementContext.exitCells,
      footprintCells: placementContext.footprintCells,
      pathCells: placementContext.pathCells,
      venues: placementContext.venues,
    });
    return {
      ...VENUE_INITIAL_VALUES,
      floorId,
      ...(placement
        ? {
            gridColumn: String(placement.gridColumn),
            gridRow: String(placement.gridRow),
          }
        : {}),
    };
  }

  return {
    name: venueEditTarget.name ?? "",
    description: venueEditTarget.description ?? "",
    capacity: String(venueEditTarget.capacity ?? ""),
    hourlyRate:
      venueEditTarget.isReservable === false
        ? ""
        : String(venueEditTarget.hourlyRate ?? ""),
    minimumHours: String(venueEditTarget.minimumHours ?? 1),
    iconKey: venueEditTarget.iconKey ?? "gym-area",
    imageUrl: venueEditTarget.imageUrl ?? "",
    imageFit: venueEditTarget.imageFit ?? "cover",
    imageFocalX: String(venueEditTarget.imageFocalX ?? 0.5),
    imageFocalY: String(venueEditTarget.imageFocalY ?? 0.5),
    imageCropZoom: String(venueEditTarget.imageCropZoom ?? 1),
    floorId: venueEditTarget.floorId ?? "floor-1",
    gridColumn: String(venueEditTarget.gridColumn ?? 1),
    gridRow: String(venueEditTarget.gridRow ?? 1),
    gridWidth: String(venueEditTarget.gridWidth ?? 2),
    gridHeight: String(venueEditTarget.gridHeight ?? 2),
    isReservable: String(venueEditTarget.isReservable !== false),
    displayOrder: String(venueEditTarget.displayOrder ?? 0)
  };
}

export function buildVenueCreateOpenSnapshot(args: {
  dataReady: boolean;
  entryCells?: readonly FacilityGridCell[];
  exitCells?: readonly FacilityGridCell[];
  floorId: FacilityFloorId;
  footprintCells?: readonly FacilityGridCell[];
  pathCells?: readonly FacilityGridCell[];
  venues?: readonly VenueRecord[];
}) {
  if (!args.dataReady) return null;

  return buildVenueInitialValues(null, {
    entryCells: args.entryCells,
    exitCells: args.exitCells,
    floorId: args.floorId,
    footprintCells: args.footprintCells,
    pathCells: args.pathCells,
    venues: args.venues,
  });
}

export function isCompactViewport(
  viewportWidth: number,
  availableViewportWidth: number,
) {
  return (
    viewportWidth > 0 &&
    availableViewportWidth > 0 &&
    viewportWidth <= availableViewportWidth * 0.6
  );
}
