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
assert(placement?.gridColumn === 3 && placement.gridRow === 2,
  "default placement skips regions and navigation cells deterministically");

const defaults = buildVenueInitialValues(null, {
  floorId: "floor-1",
  footprintCells: footprint,
  pathCells,
  venues: [occupied],
});
assert(defaults.gridColumn === "3" && defaults.gridRow === "2",
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
  readySnapshot?.gridColumn === "3" && readySnapshot.gridRow === "2",
  "create-open snapshot recomputes a valid placement after async map data arrives",
);
