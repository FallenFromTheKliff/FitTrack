import {
  getVenueBookingBlockReason,
  isVenueBookable,
} from "@fittrack/api-client";

const baseVenue = {
  isActive: true,
  isMapped: true,
  isReservable: true,
  status: "available" as const,
};

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

assertEqual(
  isVenueBookable(baseVenue),
  true,
  "active published reservable venues remain eligible",
);

const maintenanceVenue = { ...baseVenue, status: "maintenance" as const };
assertEqual(
  isVenueBookable(maintenanceVenue),
  false,
  "maintenance venues are excluded from member booking pickers",
);
assertEqual(
  getVenueBookingBlockReason(maintenanceVenue),
  "This venue is under maintenance and cannot be booked.",
  "Facilities and operations receive a clear maintenance reason",
);

assertEqual(
  isVenueBookable({ ...baseVenue, isMapped: false }),
  false,
  "map publication and reservability remain distinct requirements",
);
