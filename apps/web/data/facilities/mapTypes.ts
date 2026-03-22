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

export type PlacedMap = Record<string, string>;

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

export const VENUE_ICONS: Record<string, LucideIcon> = {
  basketball: Activity,
  volleyball: Activity,
  boxing: Swords,
  reception: Bell,
  "gym-area": Dumbbell
};

export function getVenueIcon(iconKey?: string | null): LucideIcon {
  return VENUE_ICONS[iconKey ?? "gym-area"] ?? Dumbbell;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: "treadmill", name: "Treadmill", category: "Cardio", icon: Activity, color: "var(--fit-brand)" },
  { id: "bike", name: "Bike", category: "Cardio", icon: Bike, color: "var(--fit-success)" },
  { id: "elliptical", name: "Elliptical", category: "Cardio", icon: CircleDot, color: "var(--fit-warning)" },
  { id: "bench", name: "Bench", category: "Strength", icon: Dumbbell, color: "var(--fit-text-muted)" },
  { id: "squat-rack", name: "Squat Rack", category: "Strength", icon: Square, color: "var(--fit-danger)" },
  { id: "dumbbells", name: "Dumbbells", category: "Strength", icon: Dumbbell, color: "var(--fit-warning)" },
  { id: "yoga-area", name: "Yoga Area", category: "Accessories", icon: Waves, color: "var(--fit-success)" },
  { id: "cable-machine", name: "Cable Machine", category: "Strength", icon: Timer, color: "var(--fit-text-muted)" },
  { id: "recovery-zone", name: "Recovery Zone", category: "Mobility", icon: Waves, color: "var(--fit-brand-light)" },
  { id: "hiit-zone", name: "HIIT Zone", category: "Conditioning", icon: Flame, color: "var(--fit-warning)" }
];