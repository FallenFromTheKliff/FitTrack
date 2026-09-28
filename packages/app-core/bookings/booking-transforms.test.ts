import assert from "node:assert/strict";
import test from "node:test";

import { mapVenueBookingRecord, toVenueBookingStatus } from "./booking-transforms";

test("unknown historical booking states become a neutral terminal status", () => {
  assert.equal(toVenueBookingStatus("retired_historical_state"), "cancelled");
});

test("current booking states retain their canonical meaning", () => {
  assert.equal(toVenueBookingStatus("pending"), "pending");
  assert.equal(toVenueBookingStatus("confirmed"), "confirmed");
  assert.equal(toVenueBookingStatus("completed"), "completed");
});

test("booking history keeps the embedded venue when the current list omits it", () => {
  const booking = mapVenueBookingRecord({
    durationHours: 1,
    endTime: "2026-09-20T03:00:00.000Z",
    id: "booking-1",
    startTime: "2026-09-20T02:00:00.000Z",
    status: "confirmed",
    venue: {
      hourlyRate: 900,
      id: "venue-1",
      name: "Maintenance Court",
    },
    venueId: "venue-1",
  });

  assert.equal(booking.resourceName, "Maintenance Court");
});
