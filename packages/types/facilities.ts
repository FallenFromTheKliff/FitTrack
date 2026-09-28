import type { EquipmentStatus } from "./base.js";

export type VenueEntityId = string | number;
export type VenueImageFit = "cover" | "contain";

export type VenueRecord = {
  id: VenueEntityId;
  slug: string;
  name: string;
  description?: string | null;
  capacity?: number | null;
  hourlyRate?: number | null;
  minimumHours?: number | null;
  amenities?: string[];
  iconKey?: string | null;
  floorId?: FacilityFloorId | null;
  gridColumn?: number | null;
  gridRow?: number | null;
  gridWidth?: number | null;
  gridHeight?: number | null;
  isReservable?: boolean;
  isSystem?: boolean;
  displayOrder?: number | null;
  isActive?: boolean;
  isMapped?: boolean;
  imageUrl?: string | null;
  imageUrls?: string[];
  imageFit?: VenueImageFit;
  imageFocalX?: number;
  imageFocalY?: number;
  imageCropZoom?: number;
  status?: EquipmentStatus | null;
};

export const VENUE_ICON_KEYS = [
  "basketball",
  "volleyball",
  "boxing",
  "reception",
  "gym-area",
  "yoga"
] as const;

export type VenueIconKey = typeof VENUE_ICON_KEYS[number];

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
  sourceVenueId?: VenueEntityId;
  isBookable?: boolean;
  bookingBlockReason?: string | null;
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

export type FacilityLayoutDefaults = {
  displayOrder: number;
  floorId: FacilityFloorId;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
  iconKey: VenueIconKey;
  isReservable: boolean;
  minimumHours: number;
  slug: string;
};

export const FACILITY_LAYOUT_DEFAULTS: Record<VenueIconKey, FacilityLayoutDefaults> = {
  basketball: {
    displayOrder: 3,
    floorId: "floor-1",
    gridColumn: 9,
    gridHeight: 4,
    gridRow: 1,
    gridWidth: 6,
    iconKey: "basketball",
    isReservable: true,
    minimumHours: 1,
    slug: "basketball-court"
  },
  volleyball: {
    displayOrder: 4,
    floorId: "floor-1",
    gridColumn: 1,
    gridHeight: 5,
    gridRow: 5,
    gridWidth: 7,
    iconKey: "volleyball",
    isReservable: true,
    minimumHours: 1,
    slug: "volleyball-court"
  },
  boxing: {
    displayOrder: 1,
    floorId: "floor-2",
    gridColumn: 3,
    gridHeight: 4,
    gridRow: 3,
    gridWidth: 5,
    iconKey: "boxing",
    isReservable: true,
    minimumHours: 1,
    slug: "boxing-ring"
  },
  reception: {
    displayOrder: 1,
    floorId: "floor-1",
    gridColumn: 1,
    gridHeight: 2,
    gridRow: 1,
    gridWidth: 3,
    iconKey: "reception",
    isReservable: false,
    minimumHours: 1,
    slug: "reception"
  },
  "gym-area": {
    displayOrder: 2,
    floorId: "floor-1",
    gridColumn: 4,
    gridHeight: 4,
    gridRow: 1,
    gridWidth: 5,
    iconKey: "gym-area",
    isReservable: false,
    minimumHours: 1,
    slug: "gym-area"
  },
  yoga: {
    displayOrder: 1,
    floorId: "floor-3",
    gridColumn: 4,
    gridHeight: 6,
    gridRow: 2,
    gridWidth: 8,
    iconKey: "yoga",
    isReservable: true,
    minimumHours: 1,
    slug: "yoga-studio"
  }
};

function sortVenues(a: VenueRecord, b: VenueRecord) {
  const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return (a.name ?? "").localeCompare(b.name ?? "");
}

function normalizeName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function includesVenueHint(value: string, hints: string[]) {
  return hints.some((hint) => value.includes(hint));
}

export function normalizeVenueIconKey(value?: string | null): VenueIconKey {
  const normalized = normalizeName(value);
  if (normalized === "basketball" || normalized === "basketball-court") return "basketball";
  if (normalized === "volleyball" || normalized === "volleyball-court") return "volleyball";
  if (normalized === "boxing" || normalized === "boxing-ring") return "boxing";
  if (normalized === "reception" || normalized === "front-desk" || normalized === "desk") return "reception";
  if (
    normalized === "gym-area" ||
    normalized === "gym" ||
    normalized === "dumbbell" ||
    normalized === "weights" ||
    normalized === "strength" ||
    normalized === "cardio"
  ) {
    return "gym-area";
  }
  if (normalized === "yoga" || normalized === "yoga-studio") return "yoga";
  return "gym-area";
}

export function resolveVenueIconKey(input: Pick<VenueRecord, "iconKey" | "slug" | "name">): VenueIconKey {
  const explicit = normalizeName(input.iconKey);
  if (explicit) {
    const normalized = normalizeVenueIconKey(explicit);
    if (normalized !== "gym-area" || includesVenueHint(explicit, ["gym", "dumbbell", "weights", "strength", "cardio"])) {
      return normalized;
    }
  }

  const haystack = [input.slug, input.name, input.iconKey]
    .map(normalizeName)
    .filter(Boolean)
    .join(" ");

  if (includesVenueHint(haystack, ["basketball"])) return "basketball";
  if (includesVenueHint(haystack, ["volleyball"])) return "volleyball";
  if (includesVenueHint(haystack, ["boxing", "ring"])) return "boxing";
  if (includesVenueHint(haystack, ["reception", "front desk", "front-desk"])) return "reception";
  if (includesVenueHint(haystack, ["yoga", "studio"])) return "yoga";
  return "gym-area";
}

export function inferFacilityFloorId(input: Pick<VenueRecord, "floorId" | "iconKey" | "slug" | "name">): FacilityFloorId {
  if (
    input.floorId === "floor-1" ||
    input.floorId === "floor-2" ||
    input.floorId === "floor-3"
  ) {
    return input.floorId;
  }

  const iconKey = resolveVenueIconKey(input);
  return FACILITY_LAYOUT_DEFAULTS[iconKey].floorId;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "venue";
}

function toFloorVenueRecord(venue: VenueRecord): FloorVenueRecord {
  const iconKey = resolveVenueIconKey(venue);
  const defaults = FACILITY_LAYOUT_DEFAULTS[iconKey];
  const floorId = inferFacilityFloorId(venue);

  return {
    ...venue,
    slug: venue.slug?.trim() || defaults.slug || slugify(venue.name),
    minimumHours: venue.minimumHours ?? defaults.minimumHours,
    iconKey,
    floorId,
    gridColumn: venue.gridColumn ?? defaults.gridColumn,
    gridRow: venue.gridRow ?? defaults.gridRow,
    gridWidth: venue.gridWidth ?? defaults.gridWidth,
    gridHeight: venue.gridHeight ?? defaults.gridHeight,
    isReservable: venue.isReservable ?? defaults.isReservable,
    displayOrder: venue.displayOrder ?? defaults.displayOrder,
    mapId: `venue-${String(venue.id)}`,
    sourceVenueId: venue.id
  };
}

export type BuildFacilityFloorVenuesOptions = {
  includeUnmapped?: boolean;
};

export function buildFacilityFloorVenues(
  venues: VenueRecord[],
  options: BuildFacilityFloorVenuesOptions = {},
): Record<FacilityFloorId, FloorVenueRecord[]> {
  const grouped: Record<FacilityFloorId, FloorVenueRecord[]> = {
    "floor-1": [],
    "floor-2": [],
    "floor-3": []
  };

  [...venues]
    .filter((venue) => options.includeUnmapped || venue.isMapped !== false)
    .sort(sortVenues)
    .map((venue) => toFloorVenueRecord(venue))
    .forEach((venue) => {
      grouped[venue.floorId].push(venue);
    });

  return {
    "floor-1": grouped["floor-1"].sort(sortVenues),
    "floor-2": grouped["floor-2"].sort(sortVenues),
    "floor-3": grouped["floor-3"].sort(sortVenues)
  };
}
