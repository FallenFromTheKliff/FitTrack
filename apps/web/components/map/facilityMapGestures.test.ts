import {
  buildFacilityCellGestureTargets,
  cellToolHasEditableTarget,
  cellToolShouldPan,
} from "./facilityMapGestures";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const targets = buildFacilityCellGestureTargets({
  footprintCells: [
    { column: 1, row: 1 },
    { column: 1, row: 2 },
    { column: 2, row: 1 },
  ],
  pathCells: [{ column: 1, row: 2 }],
  entryCells: [{ column: 2, row: 1 }],
  exitCells: [],
  regionCells: [{ column: 1, row: 1 }],
});

const blank = { column: 9, row: 9 };
const blockedRegion = { column: 1, row: 1 };

assert(
  cellToolHasEditableTarget("building-paint", blank, targets),
  "building paint keeps blank cells editable",
);
assert(
  cellToolHasEditableTarget("rectangle-fill", blank, targets),
  "rectangle fill keeps blank cells editable",
);
assert(
  !cellToolShouldPan("building-paint", blank, targets),
  "building paint does not pan blank cells",
);
assert(
  !cellToolShouldPan("rectangle-fill", blank, targets),
  "rectangle fill does not pan blank cells",
);

assert(
  !cellToolShouldPan("path-paint", blank, targets),
  "path paint consumes blank cells without panning",
);
assert(
  !cellToolShouldPan("building-erase", blockedRegion, targets),
  "building erase consumes region cells without panning",
);
assert(
  !cellToolShouldPan("set-entry", blank, targets),
  "set entry consumes blank cells without panning",
);
assert(
  !cellToolShouldPan("erase", blank, targets),
  "erase consumes blank cells without panning",
);

assert(
  cellToolHasEditableTarget("path-paint", { column: 1, row: 2 }, targets),
  "path paint preserves valid footprint targets",
);
assert(
  cellToolHasEditableTarget("erase", { column: 1, row: 2 }, targets),
  "erase preserves valid path targets",
);
assert(
  cellToolHasEditableTarget("set-entry", { column: 2, row: 1 }, targets),
  "set entry preserves valid footprint targets",
);
assert(
  cellToolHasEditableTarget("set-exit", { column: 1, row: 2 }, targets),
  "set exit preserves valid footprint targets",
);
