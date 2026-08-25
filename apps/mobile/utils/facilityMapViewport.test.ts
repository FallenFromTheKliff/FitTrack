import {
  computeFacilityMapFit,
  computeFacilityMapFocalTranslation,
  constrainFacilityMapTranslation,
  shouldLockFacilityParentScroll,
} from "./facilityMapViewport";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const irregular = [
  { column: 4, row: 3 },
  { column: 5, row: 3 },
  { column: 4, row: 4 },
  { column: 5, row: 4 },
];
const viewport = { width: 320, height: 480 };
const fit = computeFacilityMapFit(irregular, viewport);
assert(fit.scale > 1, "fit uses the footprint bounds instead of the full grid");

const fullGrid = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 14 }, (_, column) => ({
    column: column + 1,
    row: row + 1,
  })),
).flat();
const fullFit = computeFacilityMapFit(fullGrid, viewport);
assert(fullFit.scale < 0.6, "fit can scale a full floor down far enough to show it");

const panned = constrainFacilityMapTranslation(
  { x: 10_000, y: -10_000 }, viewport, 2, irregular,
);
const afterScaleDown = constrainFacilityMapTranslation(
  panned, viewport, fit.scale, irregular,
);
assert(afterScaleDown.x !== panned.x || afterScaleDown.y !== panned.y,
  "translation is reconstrained after scaling down from a pan");

const focal = { x: 140, y: 220 };
const start = { x: -60, y: 20, scale: 1.2 };
const nextScale = 2.4;
const next = computeFacilityMapFocalTranslation({
  focalX: focal.x,
  focalY: focal.y,
  nextScale,
  startScale: start.scale,
  startX: start.x,
  startY: start.y,
});
assert(
  Math.abs((focal.x - start.x) / start.scale - (focal.x - next.x) / nextScale) < 0.001,
  "pinch scaling preserves the map point under the focal x coordinate",
);
assert(
  Math.abs((focal.y - start.y) / start.scale - (focal.y - next.y) / nextScale) < 0.001,
  "pinch scaling preserves the map point under the focal y coordinate",
);
assert(shouldLockFacilityParentScroll(true), "active map gestures own parent scrolling");
assert(!shouldLockFacilityParentScroll(false), "parent scrolling resumes after map gestures");
