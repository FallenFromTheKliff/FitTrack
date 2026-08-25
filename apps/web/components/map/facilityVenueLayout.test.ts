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
