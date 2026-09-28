import {
  persistVenueLayoutSelection,
  resolveVenueResizeLayout,
} from "./facilityVenueLayout";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const oneCell = resolveVenueResizeLayout(
  { gridColumn: 4, gridRow: 3, gridWidth: 2, gridHeight: 2 },
  { gridColumn: 4, gridRow: 3, gridWidth: 1, gridHeight: 1 },
);
assert(oneCell.gridWidth === 1 && oneCell.gridHeight === 1,
  "venue resize permits the required 1 x 1 minimum");

const centeredResize = resolveVenueResizeLayout(
  { gridColumn: 500, gridRow: 500, gridWidth: 2, gridHeight: 2 },
  { gridColumn: 500, gridRow: 500, gridWidth: 12, gridHeight: 8 },
);
assert(
  centeredResize.gridColumn === 500 &&
    centeredResize.gridRow === 500 &&
    centeredResize.gridWidth === 12 &&
    centeredResize.gridHeight === 8,
  "venue resize keeps centered sparse-grid placements outside the retired 14 x 10 bounds",
);

const worldEdgeResize = resolveVenueResizeLayout(
  { gridColumn: 999, gridRow: 999, gridWidth: 1, gridHeight: 1 },
  { gridColumn: 999, gridRow: 999, gridWidth: 2, gridHeight: 2 },
);
assert(
  worldEdgeResize.gridColumn === 999 &&
    worldEdgeResize.gridRow === 999 &&
    worldEdgeResize.gridWidth === 2 &&
    worldEdgeResize.gridHeight === 2,
  "venue resize clamps against the sparse world edge without moving the placement",
);

void (async () => {
  const selected: string[] = [];
  const saved = await persistVenueLayoutSelection({
    previous: "persisted",
    next: "optimistic",
    persist: async () => false,
    select: (value) => selected.push(value),
  });
  assert(!saved, "failed persistence returns false");
  assert(selected.at(-1) === "persisted",
    "failed persistence restores the previously selected venue geometry");
})();
