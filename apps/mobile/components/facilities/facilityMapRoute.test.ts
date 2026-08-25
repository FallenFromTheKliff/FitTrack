import type { FacilityFloorSnapshot } from "@fittrack/types";

import { buildFacilityMapRoute } from "./facilityMapRoute";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const floor = {
  entryCells: [{ column: 1, row: 1 }],
  equipment: [],
  exitCells: [{ column: 4, row: 1 }],
  floorId: "floor-1",
  footprintCells: Array.from({ length: 4 }, (_, index) => ({ column: index + 1, row: 1 })),
  gridColumns: 14,
  gridRows: 10,
  imageUrl: null,
  pathCells: [{ column: 2, row: 1 }, { column: 3, row: 1 }],
  regions: [{
    bookingBlockReason: "Venue is undergoing maintenance.",
    capacity: 8,
    description: null,
    floorId: "floor-1",
    gridColumn: 4,
    gridHeight: 1,
    gridRow: 1,
    gridWidth: 1,
    hourlyRate: 100,
    iconKey: null,
    id: "region-1",
    imageUrl: null,
    isBookable: false,
    isReservable: true,
    minimumHours: 1,
    name: "Studio",
    regionKind: "venue",
    sourceVenueId: "venue-1",
    status: "maintenance",
  }],
} satisfies FacilityFloorSnapshot;

assert(
  JSON.stringify(buildFacilityMapRoute(floor, floor.regions[0])) ===
    JSON.stringify([
      { column: 1, row: 1 },
      { column: 2, row: 1 },
      { column: 3, row: 1 },
    ]),
  "route traverses the published path to a walkable cell beside the selected region",
);
assert(buildFacilityMapRoute(floor, null).length === 0, "no selection has no route");
assert(!floor.regions[0].isBookable, "maintenance remains visible but not bookable");
assert(
  floor.regions[0].bookingBlockReason === "Venue is undergoing maintenance.",
  "booking block reason survives the mobile snapshot fixture",
);
