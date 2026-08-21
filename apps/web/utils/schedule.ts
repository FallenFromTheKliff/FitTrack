import type { Booking, Resource } from "@/data/schedule-constants";

const DEFAULT_FACILITY_ICON = "GYM";

export function deriveResourcesFromBookings(
  bookings: Pick<Booking, "resourceId" | "resourceName">[],
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
