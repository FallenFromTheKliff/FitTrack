import type { VenueRecord } from "@/data/facilities/mapTypes";

export type FacilityFloorId = "floor-1" | "floor-2";

export type FacilityFloorDefinition = {
  id: FacilityFloorId;
  label: string;
  shortLabel: string;
  subtitle: string;
  canvasScale: number;
  emptyTitle: string;
  emptySubtitle: string;
};

export type FloorVenueRecord = VenueRecord & {
  mapId: string;
  floorId: FacilityFloorId;
  sourceVenueId?: number;
};

const FLOOR_ONE: FacilityFloorDefinition = {
  id: "floor-1",
  label: "Floor 1",
  shortLabel: "1",
  subtitle: "Primary layout",
  canvasScale: 1,
  emptyTitle: "Drag equipment here to start",
  emptySubtitle: "Equipment will snap to the Floor 1 grid"
};

const FLOOR_TWO: FacilityFloorDefinition = {
  id: "floor-2",
  label: "Floor 2",
  shortLabel: "2",
  subtitle: "Smaller upper deck",
  canvasScale: 0.82,
  emptyTitle: "Floor 2 is ready",
  emptySubtitle: "Use the toggle to compare the upper deck layout"
};

export const FACILITY_FLOORS = [FLOOR_ONE, FLOOR_TWO] as const;

export const FACILITY_FLOOR_MAP: Record<FacilityFloorId, FacilityFloorDefinition> = {
  "floor-1": FLOOR_ONE,
  "floor-2": FLOOR_TWO
};

function sortVenues(a: VenueRecord, b: VenueRecord) {
  const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return (a.name ?? "").localeCompare(b.name ?? "");
}

function mapFloorOneVenue(venue: VenueRecord): FloorVenueRecord {
  return {
    ...venue,
    mapId: `floor-1-${venue.slug ?? venue.id}`,
    floorId: "floor-1",
    sourceVenueId: venue.id
  };
}

function createFloorTwoVenue(
  baseVenue: VenueRecord | undefined,
  overrides: Omit<FloorVenueRecord, "sourceVenueId">
): FloorVenueRecord {
  return {
    ...(baseVenue ?? {}),
    ...overrides,
    sourceVenueId: baseVenue?.id
  };
}

export function buildFacilityFloorVenues(venues: VenueRecord[]): Record<FacilityFloorId, FloorVenueRecord[]> {
  const sortedVenues = [...venues].sort(sortVenues);
  const boxingVenue = sortedVenues.find((venue) =>
    venue.slug === "boxing" || venue.iconKey === "boxing" || venue.name.toLowerCase().includes("boxing")
  );
  const gymVenue = sortedVenues.find((venue) =>
    venue.slug?.startsWith("gym") || venue.iconKey === "gym-area" || venue.name.toLowerCase().includes("gym area")
  );

  return {
    "floor-1": sortedVenues.map(mapFloorOneVenue),
    "floor-2": [
      createFloorTwoVenue(boxingVenue, {
        id: boxingVenue?.id ?? -201,
        slug: boxingVenue?.slug ?? "boxing-floor-2",
        name: "Boxing Ring",
        description: boxingVenue?.description ?? "Professional boxing ring for sparring, pad work, and coached sessions.",
        iconKey: "boxing",
        capacity: boxingVenue?.capacity ?? 4,
        hourlyRate: boxingVenue?.hourlyRate ?? 29,
        minimumHours: boxingVenue?.minimumHours ?? 1,
        isReservable: boxingVenue?.isReservable ?? true,
        isSystem: boxingVenue?.isSystem ?? false,
        isActive: true,
        displayOrder: 1,
        gridColumn: 5,
        gridRow: 3,
        gridWidth: 4,
        gridHeight: 4,
        mapId: "floor-2-boxing-ring",
        floorId: "floor-2"
      }),
      createFloorTwoVenue(gymVenue, {
        id: gymVenue?.id ?? -202,
        slug: gymVenue?.slug ?? "gym-area-floor-2",
        name: "Gym Area",
        description: "Upper deck training zone with free weights, bags, and mobility stations.",
        iconKey: "gym-area",
        capacity: gymVenue?.capacity ?? 20,
        hourlyRate: gymVenue?.hourlyRate ?? null,
        minimumHours: gymVenue?.minimumHours ?? 1,
        isReservable: gymVenue?.isReservable ?? false,
        isSystem: true,
        isActive: true,
        displayOrder: 2,
        gridColumn: 10,
        gridRow: 2,
        gridWidth: 4,
        gridHeight: 6,
        mapId: "floor-2-gym-area",
        floorId: "floor-2"
      })
    ]
  };
}