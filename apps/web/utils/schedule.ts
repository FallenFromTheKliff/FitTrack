const DEFAULT_FACILITY_ICON = "🏋️";

type Resource = {
  id: string;
  name: string;
  type: "trainer" | "facility";
  icon: string;
};

type Booking = {
  id: string;
  resourceId: string;
  resourceName: string;
};

export function deriveResourcesFromBookings(
  bookings: Booking[],
  manualResources: Resource[]
): Resource[] {
  const byId = new Map<string, Resource>();
  bookings.forEach((booking) => {
    if (!byId.has(booking.resourceId)) {
      byId.set(booking.resourceId, {
        id: booking.resourceId,
        name: booking.resourceName,
        type: "facility",
        icon: DEFAULT_FACILITY_ICON
      });
      return;
    }
    const existing = byId.get(booking.resourceId);
    if (existing) existing.name = booking.resourceName;
  });
  manualResources.forEach((resource) => {
    byId.set(resource.id, resource);
  });
  return Array.from(byId.values());
}