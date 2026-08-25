import type { FacilityFloorId, FacilityGridCell } from "@fittrack/types";
import { cellKey, dedupeCells, expandRectangleToCells } from "@fittrack/utils";

export type FacilityCellEditorTool =
  | "building-paint"
  | "building-erase"
  | "rectangle-fill"
  | "path-paint"
  | "path-erase"
  | "set-entry"
  | "set-exit";

export type FacilityCellDraftState = {
  floorId: FacilityFloorId;
  footprintCells: FacilityGridCell[];
  pathCells: FacilityGridCell[];
  entryCells: FacilityGridCell[];
  exitCells: FacilityGridCell[];
};

export function updateFacilityCellDraft(args: {
  anchor: FacilityGridCell | null;
  cell: FacilityGridCell;
  current: FacilityCellDraftState;
  regionCells: FacilityGridCell[];
  tool: FacilityCellEditorTool;
}) {
  const { cell, current, tool } = args;
  const footprintKeys = new Set(current.footprintCells.map(cellKey));
  const regionKeys = new Set(args.regionCells.map(cellKey));
  let footprintCells = current.footprintCells;
  let pathCells = current.pathCells;
  let entryCells = current.entryCells;
  let exitCells = current.exitCells;
  let anchor = args.anchor;

  if (tool === "building-paint") footprintCells = dedupeCells([...footprintCells, cell]);
  if (tool === "building-erase") {
    footprintCells = footprintCells.filter((item) => cellKey(item) !== cellKey(cell));
    pathCells = pathCells.filter((item) => cellKey(item) !== cellKey(cell));
    entryCells = entryCells.filter((item) => cellKey(item) !== cellKey(cell));
    exitCells = exitCells.filter((item) => cellKey(item) !== cellKey(cell));
  }
  if (tool === "rectangle-fill") {
    if (!anchor) return { anchor: cell, dirty: false, draft: current };
    const left = Math.min(anchor.column, cell.column);
    const top = Math.min(anchor.row, cell.row);
    footprintCells = dedupeCells([...footprintCells, ...expandRectangleToCells({
      gridColumn: left,
      gridRow: top,
      gridWidth: Math.abs(anchor.column - cell.column) + 1,
      gridHeight: Math.abs(anchor.row - cell.row) + 1,
    })]);
    anchor = null;
  }
  const canPaintPath = footprintKeys.has(cellKey(cell)) && !regionKeys.has(cellKey(cell));
  if (tool === "path-paint" && canPaintPath) pathCells = dedupeCells([...pathCells, cell]);
  if (tool === "path-erase") pathCells = pathCells.filter((item) => cellKey(item) !== cellKey(cell));
  if (tool === "set-entry" && footprintKeys.has(cellKey(cell))) entryCells = [cell];
  if (tool === "set-exit" && footprintKeys.has(cellKey(cell))) exitCells = dedupeCells([...exitCells, cell]);

  return {
    anchor,
    dirty: true,
    draft: { ...current, footprintCells, pathCells, entryCells, exitCells },
  };
}

export function createFacilityCellMutationPayload(draft: FacilityCellDraftState) {
  return {
    floorId: draft.floorId,
    footprintCells: draft.footprintCells,
    pathCells: draft.pathCells,
    entryCells: draft.entryCells,
    exitCells: draft.exitCells,
  };
}

export function resolveFacilityCellSaveState(saved: boolean) {
  return { dirty: !saved, failed: !saved };
}
