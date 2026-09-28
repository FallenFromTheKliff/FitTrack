import {
  FACILITY_GRID_MAX_COLUMNS,
  FACILITY_GRID_MAX_ROWS,
} from "@fittrack/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type VenueGridLayout = {
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
};

export function resolveVenueResizeLayout(
  current: VenueGridLayout,
  resize: { width: number; height: number } | VenueGridLayout,
): VenueGridLayout {
  const absolute = "gridWidth" in resize;
  const gridWidth = clamp(
    absolute ? resize.gridWidth : current.gridWidth + resize.width,
    1,
    FACILITY_GRID_MAX_COLUMNS,
  );
  const gridHeight = clamp(
    absolute ? resize.gridHeight : current.gridHeight + resize.height,
    1,
    FACILITY_GRID_MAX_ROWS,
  );
  return {
    gridColumn: clamp(
      absolute ? resize.gridColumn : current.gridColumn,
      1,
      FACILITY_GRID_MAX_COLUMNS - gridWidth + 1,
    ),
    gridRow: clamp(
      absolute ? resize.gridRow : current.gridRow,
      1,
      FACILITY_GRID_MAX_ROWS - gridHeight + 1,
    ),
    gridWidth,
    gridHeight,
  };
}

export async function persistVenueLayoutSelection<T>(args: {
  next: T;
  persist: () => Promise<boolean>;
  previous: T;
  select: (value: T) => void;
}) {
  const saved = await args.persist();
  args.select(saved ? args.next : args.previous);
  return saved;
}
