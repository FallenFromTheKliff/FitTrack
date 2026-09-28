import type {
  FacilityFloorSnapshot,
  FloorVenueRecord,
} from "@fittrack/types";

export function mapSnapshotFloorVenues(
  floor: FacilityFloorSnapshot | undefined,
): FloorVenueRecord[] {
  return (floor?.regions ?? []).map((region) => ({
    id: region.id,
    sourceVenueId: region.sourceVenueId,
    mapId: `venue-${region.id}`,
    slug: region.id,
    name: region.name,
    description: region.description,
    capacity: region.capacity,
    hourlyRate: region.hourlyRate,
    minimumHours: region.minimumHours,
    iconKey: region.iconKey,
    imageUrl: region.imageUrl,
    floorId: region.floorId,
    gridColumn: region.gridColumn,
    gridRow: region.gridRow,
    gridWidth: region.gridWidth,
    gridHeight: region.gridHeight,
    isReservable: region.isReservable,
    isBookable: region.isBookable,
    bookingBlockReason: region.bookingBlockReason,
    isActive: true,
    isMapped: true,
    status: region.status,
  }));
}
