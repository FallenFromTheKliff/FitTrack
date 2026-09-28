export function resolveReservationPreselection<T extends { id: string | number }>(
  bookableVenues: readonly T[],
  preselectedVenueId: string | number | null | undefined,
): T | null {
  if (preselectedVenueId == null) return null;
  return (
    bookableVenues.find(
      (venue) => String(venue.id) === String(preselectedVenueId),
    ) ?? null
  );
}
