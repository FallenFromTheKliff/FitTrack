import {
  FACILITY_LAYOUT_DEFAULTS,
  inferFacilityFloorId,
  type EquipmentStatus,
  type VenueImageFit,
  type VenueRecord
} from "@fittrack/types";

type VenueLikePayload = {
  capacity: number;
  description?: string;
  displayOrder: number;
  floorId: string;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
  hourlyRate?: number;
  iconKey: string;
  imageUrl?: string | null;
  imageFit?: VenueImageFit;
  imageFocalX?: number;
  imageFocalY?: number;
  imageCropZoom?: number;
  isMapped?: boolean;
  isReservable: boolean;
  minimumHours: number;
  name: string;
  status?: EquipmentStatus | null;
};

export type CompatibleVenueId = string | number;

export type AmenityApiRecord = {
  capacity?: number | null;
  description?: string | null;
  display_order?: number | null;
  floor_id?: string | null;
  grid_column?: number | null;
  grid_height?: number | null;
  grid_row?: number | null;
  grid_width?: number | null;
  hourly_rate?: number | string | null;
  id: string;
  is_active?: boolean;
  is_reservable?: boolean | null;
  minimum_hours?: number | null;
  name?: string | null;
  icon_key?: string | null;
  image_url?: string | null;
  image_fit?: VenueImageFit | null;
  image_focal_x?: number | string | null;
  image_focal_y?: number | string | null;
  image_crop_zoom?: number | string | null;
  is_mapped?: boolean;
  requires_subscription?: boolean;
  type?: string | null;
  status?: EquipmentStatus | null;
};

type AmenityAvailabilitySlotApiRecord = {
  available: boolean;
  ends_at: string;
  starts_at: string;
};

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "amenity";
}

function humanizeAmenityType(type?: string | null) {
  switch (normalizeText(type)) {
    case "basketball_court":
      return "Basketball Court";
    case "boxing_ring":
      return "Boxing Ring";
    default:
      return "Amenity";
  }
}

function toHourlyRate(value?: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInteger(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toFiniteNumber(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function inferAmenityIconKey(input: {
  iconKey?: string | null;
  name?: string | null;
  type?: string | null;
}) {
  const iconKey = normalizeText(input.iconKey);
  const name = normalizeText(input.name);
  const type = normalizeText(input.type);
  const combined = [iconKey, name, type].filter(Boolean).join(" ");

  if (combined.includes("basketball")) return "basketball" as const;
  if (combined.includes("volleyball")) return "volleyball" as const;
  if (combined.includes("boxing")) return "boxing" as const;
  if (combined.includes("yoga")) return "yoga" as const;
  if (combined.includes("reception") || combined.includes("front desk")) return "reception" as const;
  if (combined.includes("gym")) return "gym-area" as const;
  return "gym-area" as const;
}

export function resolveAmenityId(value: CompatibleVenueId) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function inferAmenityType(payload: Pick<VenueLikePayload, "iconKey" | "name">) {
  const iconKey = inferAmenityIconKey(payload);
  if (iconKey === "basketball") return "basketball_court" as const;
  if (iconKey === "boxing") return "boxing_ring" as const;
  return "other" as const;
}

export function mapAmenityToVenueRecord(record: AmenityApiRecord): VenueRecord {
  const name = record.name?.trim() || humanizeAmenityType(record.type);
  const iconKey = inferAmenityIconKey({
    iconKey: record.icon_key,
    name: record.name,
    type: record.type
  });
  const layout = FACILITY_LAYOUT_DEFAULTS[iconKey];
  const hourlyRate = toHourlyRate(record.hourly_rate);
  const floorId = inferFacilityFloorId({
    floorId: record.floor_id as VenueRecord["floorId"],
    iconKey,
    name,
    slug: layout?.slug
  });

  return {
    id: record.id,
    slug: layout?.slug ?? slugify(name),
    name,
    description: record.description ?? null,
    capacity: record.capacity ?? 1,
    hourlyRate: hourlyRate ?? 0,
    minimumHours: toInteger(record.minimum_hours) ?? layout.minimumHours,
    iconKey,
    floorId,
    gridColumn: toInteger(record.grid_column) ?? layout.gridColumn,
    gridRow: toInteger(record.grid_row) ?? layout.gridRow,
    gridWidth: toInteger(record.grid_width) ?? layout.gridWidth,
    gridHeight: toInteger(record.grid_height) ?? layout.gridHeight,
    isReservable: record.is_reservable ?? layout.isReservable,
    isSystem: false,
    displayOrder: toInteger(record.display_order) ?? layout.displayOrder,
    isActive: record.is_active ?? true,
    isMapped: record.is_mapped ?? true,
    imageUrl: record.image_url ?? null,
    imageFit: record.image_fit === "contain" ? "contain" : "cover",
    imageFocalX: clampNumber(toFiniteNumber(record.image_focal_x) ?? 0.5, 0, 1),
    imageFocalY: clampNumber(toFiniteNumber(record.image_focal_y) ?? 0.5, 0, 1),
    imageCropZoom: clampNumber(toFiniteNumber(record.image_crop_zoom) ?? 1, 1, 4),
    status: record.status ?? null
  };
}

export function mapVenueMutationPayloadToAmenityPayload(payload: VenueLikePayload) {
  return {
    capacity: payload.capacity,
    description: payload.description?.trim() || undefined,
    display_order: payload.displayOrder,
    floor_id: payload.floorId,
    grid_column: payload.gridColumn,
    grid_height: payload.gridHeight,
    grid_row: payload.gridRow,
    grid_width: payload.gridWidth,
    ...(payload.hourlyRate !== undefined
      ? { hourly_rate: payload.hourlyRate }
      : payload.isReservable
        ? {}
        : { hourly_rate: 0 }),
    icon_key: payload.iconKey,
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.imageFit !== undefined ? { image_fit: payload.imageFit } : {}),
    ...(payload.imageFocalX !== undefined ? { image_focal_x: payload.imageFocalX } : {}),
    ...(payload.imageFocalY !== undefined ? { image_focal_y: payload.imageFocalY } : {}),
    ...(payload.imageCropZoom !== undefined ? { image_crop_zoom: payload.imageCropZoom } : {}),
    ...(payload.isMapped !== undefined ? { is_mapped: payload.isMapped } : {}),
    is_reservable: payload.isReservable,
    minimum_hours: payload.minimumHours,
    name: payload.name.trim(),
    requires_subscription: false,
    type: inferAmenityType(payload),
    ...(payload.status !== undefined ? { status: payload.status } : {})
  };
}

export function mapAmenityAvailabilityToVenueAvailabilityRecord(
  record: AmenityAvailabilitySlotApiRecord
) {
  return {
    endTime: record.ends_at,
    startTime: record.starts_at,
    status: record.available ? "available" : "confirmed"
  };
}
