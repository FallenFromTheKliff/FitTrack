import type { FacilityGridCell } from "@fittrack/types";

import type { FacilityCellEditorTool } from "./facilityCellDraft";

export type FacilityCellGestureTargets = {
  footprintKeys: ReadonlySet<string>;
  pathKeys: ReadonlySet<string>;
  entryKeys: ReadonlySet<string>;
  exitKeys: ReadonlySet<string>;
  regionKeys: ReadonlySet<string>;
};

export function facilityCellGestureKey(cell: FacilityGridCell) {
  return `${cell.column}:${cell.row}`;
}

export function buildFacilityCellGestureTargets(args: {
  footprintCells: readonly FacilityGridCell[];
  pathCells: readonly FacilityGridCell[];
  entryCells: readonly FacilityGridCell[];
  exitCells: readonly FacilityGridCell[];
  regionCells: readonly FacilityGridCell[];
}): FacilityCellGestureTargets {
  return {
    footprintKeys: new Set(args.footprintCells.map(facilityCellGestureKey)),
    pathKeys: new Set(args.pathCells.map(facilityCellGestureKey)),
    entryKeys: new Set(args.entryCells.map(facilityCellGestureKey)),
    exitKeys: new Set(args.exitCells.map(facilityCellGestureKey)),
    regionKeys: new Set(args.regionCells.map(facilityCellGestureKey)),
  };
}

/**
 * Cell editing owns the pointer for the entire gesture. Invalid targets are
 * consumed as no-ops so a paint/erase drag can never fall through to the
 * canvas pan gesture. Panning remains an explicit canvas tool.
 */
export function cellToolHasEditableTarget(
  tool: FacilityCellEditorTool,
  cell: FacilityGridCell,
  targets: FacilityCellGestureTargets,
) {
  const key = facilityCellGestureKey(cell);
  switch (tool) {
    case "building-paint":
    case "rectangle-fill":
      return true;
    case "building-erase":
    case "path-paint":
      return targets.footprintKeys.has(key) && !targets.regionKeys.has(key);
    case "erase":
      return (
        targets.pathKeys.has(key) ||
        targets.entryKeys.has(key) ||
        targets.exitKeys.has(key)
      );
    case "set-entry":
    case "set-exit":
      return targets.footprintKeys.has(key);
  }
}

export function cellToolShouldPan(
  _tool: FacilityCellEditorTool,
  _cell: FacilityGridCell | null,
  _targets: FacilityCellGestureTargets,
) {
  return false;
}
