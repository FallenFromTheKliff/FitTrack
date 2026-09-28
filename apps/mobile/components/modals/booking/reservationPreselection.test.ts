import { resolveReservationPreselection } from "./reservationPreselection";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const venues = [
  { id: "venue-a", name: "Court" },
  { id: "venue-b", name: "Studio" },
] as const;

assert(
  resolveReservationPreselection(venues, "venue-b")?.name === "Studio",
  "bookable preselection resolves by stable venue id",
);
assert(
  resolveReservationPreselection(venues, "missing") === null,
  "unknown preselection fails closed",
);
assert(
  resolveReservationPreselection(venues, null) === null,
  "empty preselection leaves the picker unset",
);
