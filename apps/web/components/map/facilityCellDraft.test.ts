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
  anchor: null, cell: { column: 2, row: 1 }, current: draft,
  regionCells: [], tool: "building-erase",
}).draft;
assert(!draft.footprintCells.some((cell) => cellKey(cell) === "2:1") && draft.pathCells.length === 0,
  "footprint erase cascades navigation removal");
const payload = createFacilityCellMutationPayload(draft);
assert(Object.keys(payload).length === 5, "apply produces one bounded floor mutation payload");
assert(!resolveFacilityCellSaveState(true).dirty, "successful save clears dirty state");
assert(resolveFacilityCellSaveState(false).dirty, "failed save retains the draft for retry");
