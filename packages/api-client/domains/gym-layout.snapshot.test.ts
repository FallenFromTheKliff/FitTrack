import { mapFacilityMapSnapshot } from "./gym-layout";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const fixture = mapFacilityMapSnapshot({
  generated_at: "2026-08-25T00:00:00.000Z",
  floors: [{
    entry_cells: [{ column: 1, row: 2 }],
    equipment: [],
    exit_cells: [{ column: 4, row: 2 }],
    floor_id: "floor-1",
    footprint_cells: [{ column: 1, row: 2 }, { column: 2, row: 2 }],
    grid_columns: 14,
    grid_rows: 10,
    image_url: null,
    path_cells: [{ column: 2, row: 2 }],
    regions: [{
      booking_block_reason: "Venue is undergoing maintenance.",
      capacity: 6,
      description: "Shared fixture",
      floor_id: "floor-1",
      grid_column: 3,
      grid_height: 1,
      grid_row: 2,
      grid_width: 2,
      hourly_rate: 500,
      icon_key: "studio",
      id: "venue-1",
      image_url: null,
      is_bookable: false,
      is_reservable: true,
      minimum_hours: 1,
      name: "Studio",
      region_kind: "venue",
      source_venue_id: "venue-1",
      status: "maintenance",
    }],
  }],
});

const floor = fixture.floors[0];
const region = floor.regions[0];
assert(floor.gridColumns === 14 && floor.gridRows === 10, "fixed geometry survives normalization");
assert(region.gridColumn === 3 && region.gridWidth === 2, "region geometry survives normalization");
assert(!region.isBookable, "booking availability survives normalization");
assert(
  region.bookingBlockReason === "Venue is undergoing maintenance.",
  "booking block reason survives normalization for web and mobile renderers",
);
