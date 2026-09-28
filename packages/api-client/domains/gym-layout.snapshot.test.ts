import { mapFacilityMapSnapshot } from "./gym-layout";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const fixture = mapFacilityMapSnapshot({
  generated_at: "2026-08-25T00:00:00.000Z",
  operating_hours: [
    {
      day_of_week: 1,
      opens_at: "06:00",
      closes_at: "22:00",
      is_closed: false,
      label: "Weekday hours",
    },
    {
      day_of_week: 6,
      opens_at: "00:00",
      closes_at: "00:00",
      is_closed: true,
      label: null,
    },
  ],
  floors: [{
    entry_cells: [{ column: 1, row: 2 }],
    equipment: [],
    exit_cells: [{ column: 4, row: 2 }],
    floor_id: "floor-1",
    footprint_cells: [{ column: 1, row: 2 }, { column: 2, row: 2 }],
    grid_columns: 16,
    grid_rows: 11,
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
      image_urls: [" https://cdn.fittrack.test/studio.jpg ", "https://cdn.fittrack.test/studio.jpg"],
      is_bookable: false,
      is_reservable: true,
      minimum_hours: 1,
      name: "Studio",
      region_kind: "venue",
      source_venue_id: "venue-1",
      status: "maintenance",
      today_bookings: [
        {
          id: "booking-1",
          starts_at: "2026-09-20T02:00:00.000Z",
          ends_at: "2026-09-20T03:00:00.000Z",
        },
      ],
      today_booking_state: "partial",
    }],
  }],
});

const floor = fixture.floors[0];
const region = floor.regions[0];
assert(floor.gridColumns === 16 && floor.gridRows === 11, "sparse geometry survives normalization");
assert(region.gridColumn === 3 && region.gridWidth === 2, "region geometry survives normalization");
assert(!region.isBookable, "booking availability survives normalization");
assert(
  region.imageUrls.length === 1 && region.imageUrls[0] === "https://cdn.fittrack.test/studio.jpg",
  "venue gallery URLs survive normalization with stable de-duplication",
);
assert(
  fixture.operatingHours[0]?.opensAt === "06:00" && fixture.operatingHours[1]?.isClosed === true,
  "weekly operating hours survive normalization including closed days",
);
assert(
  region.bookingBlockReason === "Venue is undergoing maintenance.",
  "booking block reason survives normalization for web and mobile renderers",
);
assert(
  region.todayBookingState === "partial",
  "today booking state survives snapshot normalization",
);
assert(
  region.todayBookings.length === 1,
  "today bookings survive snapshot normalization",
);
assert(
  region.todayBookings[0]?.startTime === "2026-09-20T02:00:00.000Z",
  "today booking start time survives snapshot normalization",
);
assert(
  region.todayBookings[0]?.endTime === "2026-09-20T03:00:00.000Z",
  "today booking end time survives snapshot normalization",
);
