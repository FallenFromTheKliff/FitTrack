import {
  computeFacilityPreviewOffset,
  computeFacilityMapFit,
  computeFacilityMapFocalTranslation,
  constrainFacilityMapTranslation,
  FACILITY_NODE_PREVIEW_HOLD_MS,
  resolveFacilityRegionPress,
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
const distant = [{ column: 800, row: 700 }];
const viewport = { width: 320, height: 480 };
const fit = computeFacilityMapFit(irregular, viewport);
assert(fit.scale > 1, "fit uses the footprint bounds instead of the full grid");
const distantFit = computeFacilityMapFit(distant, viewport);
assert(Number.isFinite(distantFit.translateX) && Number.isFinite(distantFit.translateY),
  "distant sparse coordinates fit without creating an oversized native view");

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
assert(
  resolveFacilityRegionPress(true) === "consume-preview",
  "a completed long-press preview consumes the release press",
);
assert(
  resolveFacilityRegionPress(false) === "select-region",
  "a normal press still selects the facility region",
);

assert(
  FACILITY_NODE_PREVIEW_HOLD_MS === 100,
  "facility image previews use a 100ms hold",
);

const previewViewport = { width: 320, height: 480 };
const centeredPreviewOffset = computeFacilityPreviewOffset({ x: 160, y: 240 }, previewViewport);
assert(
  Math.abs(centeredPreviewOffset.x) < 0.001 && Math.abs(centeredPreviewOffset.y) < 0.001,
  "centered nodes produce no preview offset",
);

const leftPreviewOffset = computeFacilityPreviewOffset({ x: 80, y: 240 }, previewViewport);
const rightPreviewOffset = computeFacilityPreviewOffset({ x: 240, y: 240 }, previewViewport);
const topPreviewOffset = computeFacilityPreviewOffset({ x: 160, y: 120 }, previewViewport);
const bottomPreviewOffset = computeFacilityPreviewOffset({ x: 160, y: 360 }, previewViewport);
assert(leftPreviewOffset.x < 0 && leftPreviewOffset.y === 0, "left nodes offset left");
assert(rightPreviewOffset.x > 0 && rightPreviewOffset.y === 0, "right nodes offset right");
assert(topPreviewOffset.y < 0 && topPreviewOffset.x === 0, "top nodes offset up");
assert(bottomPreviewOffset.y > 0 && bottomPreviewOffset.x === 0, "bottom nodes offset down");

const clampedPreviewOffset = computeFacilityPreviewOffset({ x: -1000, y: 2000 }, previewViewport);
assert(
  clampedPreviewOffset.x === -16 && clampedPreviewOffset.y === 12,
  "preview offsets stay within the bounded translation limits",
);
