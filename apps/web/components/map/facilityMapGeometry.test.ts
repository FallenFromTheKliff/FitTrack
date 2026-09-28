import type { FacilityGridCell } from "@fittrack/types";
import {
  clampFacilityMapZoom,
  getFacilityContentBounds,
  getFacilityContentEnvelope,
  FACILITY_MAP_LOGICAL_ORIGIN,
  resolveFacilityMapFocalPan,
  resolveFacilityMapFitView,
  resolveFacilityMapGeometry,
  resolveFacilityMapVisibleCellBounds,
  FACILITY_MAP_MAX_VISIBLE_CELLS,
} from "./facilityMapGeometry";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const cells: FacilityGridCell[] = [
  { column: 4, row: 3 },
  { column: 7, row: 5 },
];
const bounds = getFacilityContentBounds(cells);
assert(
  bounds.column === 4 && bounds.row === 3 && bounds.width === 4 && bounds.height === 3,
  "content bounds retain sparse positive coordinates",
);

const startGeometry = resolveFacilityMapGeometry({
  contentBounds: bounds,
  height: 600,
  viewportWidth: 1000,
  zoom: 1,
});
const nextGeometry = resolveFacilityMapGeometry({
  contentBounds: bounds,
  height: 600,
  viewportWidth: 1000,
  zoom: 0.6,
});
const pointer = { x: 617, y: 289 };
const pan = { x: 31, y: -17 };
const nextPan = resolveFacilityMapFocalPan({
  currentGeometry: startGeometry,
  currentPan: pan,
  nextGeometry,
  pointerX: pointer.x,
  pointerY: pointer.y,
});
assert(
  Math.abs(
    (pointer.x - pan.x - startGeometry.planX) / startGeometry.cellWidth -
      (pointer.x - nextPan.x - nextGeometry.planX) / nextGeometry.cellWidth,
  ) < 0.001,
  "focal zoom preserves the map point under the cursor on x",
);
assert(
  Math.abs(
    (pointer.y - pan.y - startGeometry.planY) / startGeometry.cellHeight -
      (pointer.y - nextPan.y - nextGeometry.planY) / nextGeometry.cellHeight,
  ) < 0.001,
  "focal zoom preserves the map point under the cursor on y",
);
assert(clampFacilityMapZoom(0.1) === 0.4, "zoom clamps to the 40 percent floor");
assert(clampFacilityMapZoom(2) === 1.25, "zoom retains the existing 125 percent ceiling");

const venueOutsideCells = getFacilityContentEnvelope({
  cells: [{ column: 2, row: 2 }],
  venues: [{ gridColumn: 20, gridRow: 12, gridWidth: 3, gridHeight: 4 }],
});
assert(
  venueOutsideCells.column === 2 &&
    venueOutsideCells.row === 2 &&
    venueOutsideCells.width === 21 &&
    venueOutsideCells.height === 14,
  "venue rectangles outside the published cells expand the visible envelope",
);

const equipmentExtents = getFacilityContentEnvelope({
  equipment: [
    { gridColumn: 30, gridRow: 18, gridWidth: 2, gridHeight: 3 },
  ],
});
assert(
  equipmentExtents.column === 30 &&
    equipmentExtents.row === 18 &&
    equipmentExtents.width === 2 &&
    equipmentExtents.height === 3,
  "equipment dimensions are included in the visible envelope",
);

const hiddenVenueDoesNotExpandEnvelope = getFacilityContentEnvelope({
  cells: [{ column: 4, row: 4 }],
  venues: [{ gridColumn: 900, gridRow: 900, gridWidth: 2, gridHeight: 2, isMapped: false }],
});
assert(
  hiddenVenueDoesNotExpandEnvelope.column === 4 &&
    hiddenVenueDoesNotExpandEnvelope.row === 4 &&
    hiddenVenueDoesNotExpandEnvelope.width === 1 &&
    hiddenVenueDoesNotExpandEnvelope.height === 1,
  "unmapped venues do not move the initial viewport envelope",
);

const lowCoordinateCustomBounds = getFacilityContentEnvelope({
  cells: [
    { column: 1, row: 1 },
    { column: 23, row: 10 },
  ],
  // This mirrors the live admin map: a populated custom footprint plus stale
  // canonical placement rows must still fit to the custom footprint.
  fallback: { column: 1, row: 1, width: 23, height: 10 },
  venues: [{ gridColumn: 500, gridRow: 500, gridWidth: 2, gridHeight: 2 }],
});
assert(
  lowCoordinateCustomBounds.column === 1 &&
    lowCoordinateCustomBounds.row === 1 &&
    lowCoordinateCustomBounds.width === 23 &&
    lowCoordinateCustomBounds.height === 10,
  "custom low-coordinate footprints do not inherit stale origin placements",
);
const lowCoordinateGeometry = resolveFacilityMapGeometry({
  contentBounds: lowCoordinateCustomBounds,
  fitToFloorBounds: true,
  height: 500,
  viewportWidth: 800,
  zoom: 1,
});
assert(
  lowCoordinateGeometry.cellWidth > 10 &&
    lowCoordinateGeometry.cellHeight > 10 &&
    lowCoordinateGeometry.planWidth < 1_000 &&
    lowCoordinateGeometry.planHeight < 1_000,
  "custom low-coordinate fit stays at a normal scale instead of spanning to C500/R500",
);
assert(
  Math.abs(
    lowCoordinateGeometry.planX +
      (lowCoordinateCustomBounds.column - 1 + lowCoordinateCustomBounds.width / 2) *
        lowCoordinateGeometry.cellWidth -
      400,
  ) < 0.001 &&
    Math.abs(
      lowCoordinateGeometry.planY +
        (lowCoordinateCustomBounds.row - 1 + lowCoordinateCustomBounds.height / 2) *
          lowCoordinateGeometry.cellHeight -
        250,
    ) < 0.001,
  "custom low-coordinate fit centers its live content envelope",
);

const positionFallback = getFacilityContentEnvelope({
  equipment: [{ positionX: 0, positionY: 0 }],
});
assert(
  positionFallback.column === 1 && positionFallback.row === 1,
  "legacy percentage equipment coordinates resolve to a grid cell",
);

const malformedFallback = getFacilityContentEnvelope({
  cells: [
    { column: 0, row: Number.NaN },
    { column: "not-a-cell", row: Number.POSITIVE_INFINITY },
  ],
  fallback: { column: 3, row: 4, width: 6, height: 5 },
});
assert(
  malformedFallback.column === 3 &&
    malformedFallback.row === 4 &&
    malformedFallback.width === 6 &&
    malformedFallback.height === 5,
  "malformed and empty inputs use a bounded fallback envelope",
);

const centeredGeometry = resolveFacilityMapGeometry({
  contentBounds: { column: 20, row: 10, width: 3, height: 2 },
  height: 500,
  viewportWidth: 800,
  zoom: 1,
});
assert(
  Math.abs(
    centeredGeometry.planX +
      (20 - 1) * centeredGeometry.cellWidth -
      (800 - centeredGeometry.planWidth) / 2,
  ) < 0.001,
  "centered geometry places the envelope midpoint on the viewport midpoint x",
);
assert(
  Math.abs(
    centeredGeometry.planY +
      (10 - 1) * centeredGeometry.cellHeight -
      (500 - centeredGeometry.planHeight) / 2,
  ) < 0.001,
  "centered geometry places the envelope midpoint on the viewport midpoint y",
);

const completeSparseEnvelope = getFacilityContentEnvelope({
  cells: [
    { column: 2, row: 4 },
    { column: 5, row: 9 },
  ],
  venues: [
    { gridColumn: 21, gridRow: 14, gridWidth: 3, gridHeight: 2 },
  ],
  equipment: [
    { gridColumn: 11, gridRow: 2, gridWidth: 2, gridHeight: 4 },
  ],
});
assert(
  completeSparseEnvelope.column === 2 &&
    completeSparseEnvelope.row === 2 &&
    completeSparseEnvelope.width === 22 &&
    completeSparseEnvelope.height === 14,
  "sparse envelope includes outlying venue and equipment extents",
);

function assertEnvelopeCenteredAtZoom(
  zoom: number,
  contentBounds: typeof completeSparseEnvelope,
) {
  const viewportWidth = 800;
  const viewportHeight = 500;
  const geometry = resolveFacilityMapGeometry({
    contentBounds,
    height: viewportHeight,
    viewportWidth,
    zoom,
  });
  const envelopeLeft =
    geometry.planX + (contentBounds.column - 1) * geometry.cellWidth;
  const envelopeTop =
    geometry.planY + (contentBounds.row - 1) * geometry.cellHeight;
  const envelopeCenterX =
    envelopeLeft + (contentBounds.width * geometry.cellWidth) / 2;
  const envelopeCenterY =
    envelopeTop + (contentBounds.height * geometry.cellHeight) / 2;

  assert(
    Math.abs(envelopeCenterX - viewportWidth / 2) < 0.001,
    `sparse envelope remains centered at ${zoom * 100}% zoom on x`,
  );
  assert(
    Math.abs(envelopeCenterY - viewportHeight / 2) < 0.001,
    `sparse envelope remains centered at ${zoom * 100}% zoom on y`,
  );
}

assertEnvelopeCenteredAtZoom(0.4, completeSparseEnvelope);
assertEnvelopeCenteredAtZoom(0.85, completeSparseEnvelope);
assertEnvelopeCenteredAtZoom(1, completeSparseEnvelope);

const fitView = resolveFacilityMapFitView({
  contentBounds: venueOutsideCells,
  height: 500,
  viewportWidth: 800,
});
assert(
  fitView.zoom === 1 && fitView.pan.x === 0 && fitView.pan.y === 0,
  "Fit restores the deterministic centered view origin and baseline zoom",
);

const canonicalBounds = {
  column: FACILITY_MAP_LOGICAL_ORIGIN.column - 7,
  row: FACILITY_MAP_LOGICAL_ORIGIN.row - 5,
  width: 14,
  height: 10,
};
const canonicalGeometry = resolveFacilityMapGeometry({
  contentBounds: canonicalBounds,
  height: 500,
  viewportWidth: 800,
  zoom: 1,
});
const logicalOriginCenter = {
  x:
    canonicalGeometry.planX +
    (FACILITY_MAP_LOGICAL_ORIGIN.column - 0.5) * canonicalGeometry.cellWidth,
  y:
    canonicalGeometry.planY +
    (FACILITY_MAP_LOGICAL_ORIGIN.row - 0.5) * canonicalGeometry.cellHeight,
};
assert(
  Math.abs(logicalOriginCenter.x - 400) < 0.001 &&
    Math.abs(logicalOriginCenter.y - 250) < 0.001,
  "canonical 500/500 origin is centered in the default viewport",
);

const visibleCanonicalCells = resolveFacilityMapVisibleCellBounds({
  geometry: canonicalGeometry,
  height: 500,
  pan: { x: 0, y: 0 },
  viewportWidth: 800,
});
assert(Boolean(visibleCanonicalCells), "centered viewport has visible sparse cells");
assert(
  visibleCanonicalCells!.firstColumn <= FACILITY_MAP_LOGICAL_ORIGIN.column &&
    visibleCanonicalCells!.lastColumn >= FACILITY_MAP_LOGICAL_ORIGIN.column &&
    visibleCanonicalCells!.firstRow <= FACILITY_MAP_LOGICAL_ORIGIN.row &&
    visibleCanonicalCells!.lastRow >= FACILITY_MAP_LOGICAL_ORIGIN.row,
  "visible sparse culling includes both sides of the logical origin",
);
assert(
  FACILITY_MAP_LOGICAL_ORIGIN.column - visibleCanonicalCells!.firstColumn ===
    visibleCanonicalCells!.lastColumn - FACILITY_MAP_LOGICAL_ORIGIN.column &&
    FACILITY_MAP_LOGICAL_ORIGIN.row - visibleCanonicalCells!.firstRow ===
      visibleCanonicalCells!.lastRow - FACILITY_MAP_LOGICAL_ORIGIN.row,
  "default sparse culling is symmetric around the logical origin",
);

const rightWorldEdge = resolveFacilityMapVisibleCellBounds({
  geometry: canonicalGeometry,
  height: 500,
  maxColumns: 1000,
  maxRows: 1000,
  pan: {
    x:
      400 -
      canonicalGeometry.planX -
      (1000 - 0.5) * canonicalGeometry.cellWidth,
    y: 0,
  },
  viewportWidth: 800,
});
assert(
  rightWorldEdge !== null &&
    rightWorldEdge.firstColumn < 1000 &&
    rightWorldEdge.lastColumn === 1000,
  "sparse culling keeps the far world edge placeable without a dense grid",
);

const boundedCulling = resolveFacilityMapVisibleCellBounds({
  geometry: {
    cellHeight: 1,
    cellWidth: 1,
    planX: 0,
    planY: 0,
  },
  height: 500,
  maxVisibleCells: FACILITY_MAP_MAX_VISIBLE_CELLS,
  pan: { x: 0, y: 0 },
  viewportWidth: 500,
});
assert(
  boundedCulling === null,
  "virtual culling fails closed before allocating a giant cell range",
);

const outsideWorld = resolveFacilityMapVisibleCellBounds({
  geometry: canonicalGeometry,
  height: 500,
  pan: { x: 100_000, y: 100_000 },
  viewportWidth: 800,
});
assert(outsideWorld === null, "culling does not fabricate cells outside the bounded world");
