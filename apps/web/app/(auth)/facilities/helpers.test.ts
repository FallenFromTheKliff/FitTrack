import {
  buildVenueCreateOpenSnapshot,
  buildVenueInitialValues,
  findDeterministicVenuePlacement,
  validateVenuePlacement,
} from "./helpers";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const occupied = {
  id: "reception",
  slug: "reception",
  name: "Reception",
  floorId: "floor-1" as const,
  gridColumn: 1,
  gridRow: 1,
  gridWidth: 2,
  gridHeight: 2,
  isMapped: true,
};

const footprint = [
  { column: 1, row: 1 },
  { column: 2, row: 1 },
  { column: 3, row: 1 },
  { column: 1, row: 2 },
  { column: 2, row: 2 },
  { column: 3, row: 2 },
  { column: 4, row: 1 },
  { column: 4, row: 2 },
];

const pathCells = [{ column: 3, row: 1 }];

const placement = findDeterministicVenuePlacement({
  floorId: "floor-1",
  gridWidth: 2,
  gridHeight: 1,
  footprintCells: footprint,
  pathCells,
  venues: [occupied],
});
assert(placement?.gridColumn === 4 && placement.gridRow === 1,
  "default placement skips regions and navigation cells deterministically");

const defaults = buildVenueInitialValues(null, {
  floorId: "floor-1",
  footprintCells: footprint,
  pathCells,
  venues: [occupied],
});
assert(defaults.gridColumn === "4" && defaults.gridRow === "1",
  "new venue defaults use the first valid placement");

assert(
  validateVenuePlacement({
    floorId: "floor-1",
    gridColumn: 3,
    gridRow: 1,
    gridWidth: 1,
    gridHeight: 1,
    footprintCells: footprint,
    pathCells,
    venues: [occupied],
  })?.includes("navigation") ?? false,
  "manual navigation overlap reports an actionable reason",
);

assert(
  validateVenuePlacement({
    floorId: "floor-1",
    gridColumn: 12,
    gridRow: 8,
    gridWidth: 2,
    gridHeight: 2,
    footprintCells: [],
    pathCells: [],
    venues: [occupied],
  }) === null,
  "empty or incremental footprints do not block an otherwise safe venue move",
);

assert(
  buildVenueCreateOpenSnapshot({
    dataReady: false,
    floorId: "floor-1",
    footprintCells: footprint,
    pathCells,
    venues: [occupied],
  }) === null,
  "create-open snapshot waits for venue and floor data",
);
const readySnapshot = buildVenueCreateOpenSnapshot({
  dataReady: true,
  floorId: "floor-1",
  entryCells: [{ column: 3, row: 1 }],
  footprintCells: footprint,
  pathCells: [],
  venues: [occupied],
});
assert(
  readySnapshot?.gridColumn === "4" && readySnapshot.gridRow === "1",
  "create-open snapshot recomputes a valid placement after async map data arrives",
);
