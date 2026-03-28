export type { VenueRecord } from "@fittrack/types";
import type { VenueRecord } from "@fittrack/types";
import type { LucideIcon } from "lucide-react";
import { Activity, Bell, Bike, CircleDot, Dumbbell, Timer, Waves, Square, Flame, Swords } from "lucide-react";

export const COLS = 14;
export const ROWS = 10;
export const LAYOUT_KEY = "fittrack_facilities_layout";

export type EquipmentDef = {
  id: string;
  name: string;
  category: string;
  icon: LucideIcon;
  color: string;
};

export type VenueEquipmentAssignments = Record<string, string[]>;

export const VENUE_ICONS: Record<string, LucideIcon> = {
  basketball: Activity,
  volleyball: Activity,
  boxing: Swords,
  reception: Bell,
  "gym-area": Dumbbell,
  yoga: Waves
};

export function getVenueIcon(iconKey?: string | null): LucideIcon {
  return VENUE_ICONS[iconKey ?? "gym-area"] ?? Dumbbell;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: "treadmill", name: "Treadmill", category: "Cardio", icon: Activity, color: "var(--fit-danger)" },
  { id: "bike", name: "Bike", category: "Cardio", icon: Bike, color: "var(--fit-danger)" },
  { id: "elliptical", name: "Elliptical", category: "Cardio", icon: CircleDot, color: "var(--fit-danger)" },
  { id: "bench", name: "Bench", category: "Strength", icon: Dumbbell, color: "var(--fit-brand-light)" },
  { id: "squat-rack", name: "Squat Rack", category: "Strength", icon: Square, color: "var(--fit-brand-light)" },
  { id: "dumbbells", name: "Dumbbells", category: "Strength", icon: Dumbbell, color: "var(--fit-brand-light)" },
  { id: "yoga-area", name: "Yoga Area", category: "Accessories", icon: Waves, color: "var(--fit-success)" },
  { id: "cable-machine", name: "Cable Machine", category: "Strength", icon: Timer, color: "var(--fit-brand-light)" },
  { id: "recovery-zone", name: "Recovery Zone", category: "Mobility", icon: Waves, color: "var(--fit-brand-light)" },
  { id: "hiit-zone", name: "HIIT Zone", category: "Conditioning", icon: Flame, color: "var(--fit-warning)" }
];
