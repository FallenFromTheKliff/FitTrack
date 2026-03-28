export type VenueRecord = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  capacity?: number | null;
  hourlyRate?: number | null;
  minimumHours?: number | null;
  amenities?: string[];
  iconKey?: string | null;
  gridColumn?: number | null;
  gridRow?: number | null;
  gridWidth?: number | null;
  gridHeight?: number | null;
  isReservable?: boolean;
  isSystem?: boolean;
  displayOrder?: number | null;
  isActive?: boolean;
};

export type FacilityFloorId = "floor-1" | "floor-2" | "floor-3";

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
  subtitle: "Training annex",
  canvasScale: 1,
  emptyTitle: "Drag equipment here to start",
  emptySubtitle: "Equipment will snap to the Floor 2 grid"
};

const FLOOR_THREE: FacilityFloorDefinition = {
  id: "floor-3",
  label: "Floor 3",
  shortLabel: "3",
  subtitle: "Yoga studio level",
  canvasScale: 1,
  emptyTitle: "Drag equipment here to start",
  emptySubtitle: "Equipment will snap to the Floor 3 grid"
};

export const FACILITY_FLOORS = [FLOOR_ONE, FLOOR_TWO, FLOOR_THREE] as const;

export const FACILITY_FLOOR_MAP: Record<FacilityFloorId, FacilityFloorDefinition> = {
  "floor-1": FLOOR_ONE,
  "floor-2": FLOOR_TWO,
  "floor-3": FLOOR_THREE
};

function sortVenues(a: VenueRecord, b: VenueRecord) {
  const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return (a.name ?? "").localeCompare(b.name ?? "");
}

function normalizeName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function createFloorVenue(
  baseVenue: VenueRecord | undefined,
  overrides: Omit<FloorVenueRecord, "sourceVenueId">
): FloorVenueRecord {
  return {
    ...(baseVenue ?? {}),
    ...overrides,
    sourceVenueId: baseVenue?.id
  };
}

function findVenue(venues: VenueRecord[], matcher: (venue: VenueRecord) => boolean) {
  return venues.find(matcher);
}

export function buildFacilityFloorVenues(venues: VenueRecord[]): Record<FacilityFloorId, FloorVenueRecord[]> {
  const sortedVenues = [...venues].sort(sortVenues);
  const receptionVenue = findVenue(sortedVenues, (venue) =>
    venue.slug === "reception" || venue.iconKey === "reception" || normalizeName(venue.name).includes("reception")
  );
  const basketballVenue = findVenue(sortedVenues, (venue) =>
    venue.slug === "basketball" || venue.iconKey === "basketball" || normalizeName(venue.name).includes("basketball")
  );
  const volleyballVenue = findVenue(sortedVenues, (venue) =>
    venue.slug === "volleyball" || venue.iconKey === "volleyball" || normalizeName(venue.name).includes("volleyball")
  );
  const boxingVenue = findVenue(sortedVenues, (venue) =>
    venue.slug === "boxing" || venue.iconKey === "boxing" || normalizeName(venue.name).includes("boxing")
  );
  const gymVenue = findVenue(sortedVenues, (venue) =>
    venue.slug?.startsWith("gym") ||
    venue.iconKey === "gym-area" ||
    normalizeName(venue.name).includes("gym area")
  );
  const yogaVenue = findVenue(sortedVenues, (venue) =>
    venue.slug === "yoga-studio" ||
    venue.iconKey === "yoga" ||
    normalizeName(venue.name).includes("yoga")
  );

  return {
    "floor-1": [
      createFloorVenue(receptionVenue, {
        id: receptionVenue?.id ?? -101,
        slug: receptionVenue?.slug ?? "reception",
        name: "Reception",
        description: receptionVenue?.description ?? "Member welcome area, assistance desk, and entry check-in point.",
        iconKey: "reception",
        capacity: receptionVenue?.capacity ?? 2,
        hourlyRate: receptionVenue?.hourlyRate ?? null,
        minimumHours: receptionVenue?.minimumHours ?? 1,
        isReservable: false,
        isSystem: true,
        isActive: true,
        displayOrder: 1,
        gridColumn: 1,
        gridRow: 1,
        gridWidth: 3,
        gridHeight: 2,
        mapId: "floor-1-reception",
        floorId: "floor-1"
      }),
      createFloorVenue(gymVenue, {
        id: gymVenue?.id ?? -102,
        slug: gymVenue?.slug ?? "gym-area",
        name: "Gym Area",
        description: gymVenue?.description ?? "Primary free-weight and machine zone for daily member training.",
        iconKey: "gym-area",
        capacity: gymVenue?.capacity ?? 30,
        hourlyRate: gymVenue?.hourlyRate ?? null,
        minimumHours: gymVenue?.minimumHours ?? 1,
        isReservable: false,
        isSystem: true,
        isActive: true,
        displayOrder: 2,
        gridColumn: 4,
        gridRow: 1,
        gridWidth: 5,
        gridHeight: 4,
        mapId: "floor-1-gym-area",
        floorId: "floor-1"
      }),
      createFloorVenue(basketballVenue, {
        id: basketballVenue?.id ?? -103,
        slug: basketballVenue?.slug ?? "basketball-court",
        name: "Basketball Court",
        description: basketballVenue?.description ?? "Full court booking area for drills, team training, and scrimmages.",
        iconKey: "basketball",
        capacity: basketballVenue?.capacity ?? 10,
        hourlyRate: basketballVenue?.hourlyRate ?? 153,
        minimumHours: basketballVenue?.minimumHours ?? 1,
        isReservable: basketballVenue?.isReservable ?? true,
        isSystem: basketballVenue?.isSystem ?? false,
        isActive: true,
        displayOrder: 3,
        gridColumn: 9,
        gridRow: 1,
        gridWidth: 6,
        gridHeight: 4,
        mapId: "floor-1-basketball-court",
        floorId: "floor-1"
      }),
      createFloorVenue(volleyballVenue, {
        id: volleyballVenue?.id ?? -104,
        slug: volleyballVenue?.slug ?? "volleyball-court",
        name: "Volleyball Court",
        description: volleyballVenue?.description ?? "Open court space for league practice, clinics, and private sessions.",
        iconKey: "volleyball",
        capacity: volleyballVenue?.capacity ?? 12,
        hourlyRate: volleyballVenue?.hourlyRate ?? 120,
        minimumHours: volleyballVenue?.minimumHours ?? 1,
        isReservable: volleyballVenue?.isReservable ?? true,
        isSystem: volleyballVenue?.isSystem ?? false,
        isActive: true,
        displayOrder: 4,
        gridColumn: 1,
        gridRow: 5,
        gridWidth: 7,
        gridHeight: 5,
        mapId: "floor-1-volleyball-court",
        floorId: "floor-1"
      })
    ],
    "floor-2": [
      createFloorVenue(boxingVenue, {
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
        gridColumn: 3,
        gridRow: 3,
        gridWidth: 5,
        gridHeight: 4,
        mapId: "floor-2-boxing-ring",
        floorId: "floor-2"
      }),
      createFloorVenue(gymVenue, {
        id: gymVenue?.id ?? -202,
        slug: gymVenue?.slug ?? "gym-area-floor-2",
        name: "Gym Area",
        description: "Upper deck training zone with free weights, bags, and mobility stations.",
        iconKey: "gym-area",
        capacity: gymVenue?.capacity ?? 20,
        hourlyRate: gymVenue?.hourlyRate ?? null,
        minimumHours: gymVenue?.minimumHours ?? 1,
        isReservable: false,
        isSystem: true,
        isActive: true,
        displayOrder: 2,
        gridColumn: 9,
        gridRow: 2,
        gridWidth: 5,
        gridHeight: 6,
        mapId: "floor-2-gym-area",
        floorId: "floor-2"
      })
    ],
    "floor-3": [
      createFloorVenue(yogaVenue, {
        id: yogaVenue?.id ?? -301,
        slug: yogaVenue?.slug ?? "yoga-studio",
        name: "Yoga Studio",
        description: yogaVenue?.description ?? "Quiet studio for yoga flows, stretching classes, and low-impact recovery work.",
        iconKey: "yoga",
        capacity: yogaVenue?.capacity ?? 16,
        hourlyRate: yogaVenue?.hourlyRate ?? 18,
        minimumHours: yogaVenue?.minimumHours ?? 1,
        isReservable: yogaVenue?.isReservable ?? true,
        isSystem: yogaVenue?.isSystem ?? false,
        isActive: true,
        displayOrder: 1,
        gridColumn: 4,
        gridRow: 2,
        gridWidth: 8,
        gridHeight: 6,
        mapId: "floor-3-yoga-studio",
        floorId: "floor-3"
      })
    ]
  };
}
