import assert from "node:assert/strict";
import test from "node:test";

import { toVenueBookingStatus } from "./booking-transforms";

test("unknown historical booking states become a neutral terminal status", () => {
  assert.equal(toVenueBookingStatus("retired_historical_state"), "cancelled");
});

test("current booking states retain their canonical meaning", () => {
  assert.equal(toVenueBookingStatus("pending"), "pending");
  assert.equal(toVenueBookingStatus("confirmed"), "confirmed");
  assert.equal(toVenueBookingStatus("completed"), "completed");
});
