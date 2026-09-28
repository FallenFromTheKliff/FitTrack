import {
  enumerateFacilityGridCandidates,
  findNearestFacilityPlacement,
} from "./facilityMapPlacement";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const candidates = enumerateFacilityGridCandidates({
  maxColumn: 4,
  maxRow: 4,
});
const nearest = findNearestFacilityPlacement(
  { gridColumn: 2, gridRow: 2 },
  candidates,
  (candidate) =>
    !(candidate.gridColumn === 2 && candidate.gridRow === 2) &&
    !(candidate.gridColumn === 1 && candidate.gridRow === 2),
);
assert(
  nearest?.gridColumn === 2 && nearest.gridRow === 1,
  "nearest placement skips occupied cells and uses row/column tie order",
);
const tied = findNearestFacilityPlacement(
  { gridColumn: 2, gridRow: 2 },
  candidates,
  (candidate) =>
    (candidate.gridColumn === 1 && candidate.gridRow === 2) ||
    (candidate.gridColumn === 2 && candidate.gridRow === 1),
);
assert(
  tied?.gridColumn === 2 && tied.gridRow === 1,
  "placement ties resolve deterministically by row then column",
);
