import { cellKey } from "@fittrack/utils";
import {
  createFacilityCellMutationPayload,
  resolveFacilityCellSaveState,
  updateFacilityCellDraft,
  type FacilityCellDraftState,
} from "./facilityCellDraft";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

let draft: FacilityCellDraftState = {
  floorId: "floor-1",
  footprintCells: [{ column: 1, row: 1 }],
  pathCells: [],
  entryCells: [],
  exitCells: [],
};
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 2, row: 1 }, current: draft,
  regionCells: [], tool: "building-paint",
}).draft;
assert(draft.footprintCells.some((cell) => cellKey(cell) === "2:1"), "footprint paint adds a cell");
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 2, row: 1 }, current: draft,
  regionCells: [], tool: "path-paint",
}).draft;
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 1, row: 1 }, current: draft,
  regionCells: [], tool: "set-entry",
}).draft;
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 2, row: 1 }, current: draft,
  regionCells: [], tool: "set-exit",
}).draft;
assert(draft.pathCells.length === 1 && draft.entryCells.length === 1 && draft.exitCells.length === 1,
  "path and entry/exit tools update one draft");
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 1, row: 1 }, current: draft,
  regionCells: [], tool: "erase",
}).draft;
assert(draft.entryCells.length === 0 && draft.pathCells.length === 1,
  "general erase removes navigation markers without touching the footprint");
const occupiedErase = updateFacilityCellDraft({
  anchor: null,
  cell: { column: 2, row: 1 },
  current: draft,
  regionCells: [{ column: 2, row: 1 }],
  tool: "building-erase",
});
assert(!occupiedErase.dirty && occupiedErase.draft === draft,
  "building erase preserves footprint cells occupied by mapped regions");
draft = updateFacilityCellDraft({
  anchor: null, cell: { column: 2, row: 1 }, current: draft,
  regionCells: [], tool: "building-erase",
}).draft;
assert(!draft.footprintCells.some((cell) => cellKey(cell) === "2:1") && draft.pathCells.length === 0,
  "footprint erase cascades navigation removal");
const payload = createFacilityCellMutationPayload(draft);
assert(Object.keys(payload).length === 5, "apply produces one bounded floor mutation payload");
assert(!resolveFacilityCellSaveState(true).dirty, "successful save clears dirty state");
assert(resolveFacilityCellSaveState(false).dirty, "failed save retains the draft for retry");

const rectangleStart = updateFacilityCellDraft({
  anchor: null,
  cell: { column: 2, row: 2 },
  current: draft,
  regionCells: [],
  tool: "rectangle-fill",
  phase: "start",
});
assert(
  rectangleStart.anchor?.column === 2 &&
    rectangleStart.anchor?.row === 2 &&
    !rectangleStart.dirty &&
    rectangleStart.draft === draft,
  "rectangle pointer-down establishes an anchor without mutating the draft",
);
const rectangleCommit = updateFacilityCellDraft({
  anchor: rectangleStart.anchor,
  cell: { column: 4, row: 3 },
  current: rectangleStart.draft,
  regionCells: [],
  tool: "rectangle-fill",
  phase: "commit",
});
assert(
  rectangleCommit.anchor === null &&
    rectangleCommit.dirty &&
    ["2:2", "3:2", "4:2", "2:3", "3:3", "4:3"].every((key) =>
      rectangleCommit.draft.footprintCells.some((cell) => cellKey(cell) === key),
    ),
  "rectangle pointer-up commits one inclusive rectangle",
);
const rectangleCancel = updateFacilityCellDraft({
  anchor: rectangleStart.anchor,
  cell: { column: 4, row: 3 },
  current: rectangleStart.draft,
  regionCells: [],
  tool: "rectangle-fill",
  phase: "cancel",
});
assert(
  rectangleCancel.anchor === null &&
    !rectangleCancel.dirty &&
    rectangleCancel.draft === draft,
  "rectangle cancel clears the anchor without changing cells",
);
