import type { VenueRecord } from "@/components/map";
import {
  SCHEDULE_EMOJI_OPTIONS,
  type ResourceDraft,
  type ScheduleResourceType
} from "@/data/facilities/resources";
import { VENUE_INITIAL_VALUES } from "@/data/facilities/venueFields";

export function getDefaultResourceDraft(): ResourceDraft {
  return {
    name: "",
    type: "",
    icon: SCHEDULE_EMOJI_OPTIONS[0]
  };
}

export function createScheduleResourceId(type: ScheduleResourceType, name: string) {
  return `${type}-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
}

export function buildVenueInitialValues(venueEditTarget: VenueRecord | null) {
  if (!venueEditTarget) {
    return VENUE_INITIAL_VALUES;
  }

  return {
    name: venueEditTarget.name ?? "",
    description: venueEditTarget.description ?? "",
    capacity: String(venueEditTarget.capacity ?? ""),
    hourlyRate: String(venueEditTarget.hourlyRate ?? ""),
    minimumHours: String(venueEditTarget.minimumHours ?? 1),
    iconKey: venueEditTarget.iconKey ?? "gym-area",
    gridColumn: String(venueEditTarget.gridColumn ?? 1),
    gridRow: String(venueEditTarget.gridRow ?? 1),
    gridWidth: String(venueEditTarget.gridWidth ?? 2),
    gridHeight: String(venueEditTarget.gridHeight ?? 2),
    isReservable: String(venueEditTarget.isReservable !== false),
    displayOrder: String(venueEditTarget.displayOrder ?? 0)
  };
}

export function isCompactViewport(viewportWidth: number) {
  return (
    viewportWidth > 0 &&
    viewportWidth <=
      (window.screen?.availWidth || window.screen?.width || window.innerWidth) * 0.6
  );
}