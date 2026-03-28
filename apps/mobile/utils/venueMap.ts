import { Activity, Bell, Dumbbell, Swords, type LucideIcon } from "lucide-react-native";
import { Waves } from "lucide-react-native";

export type VenueIconKey =
  | "basketball"
  | "volleyball"
  | "boxing"
  | "reception"
  | "gym-area"
  | "dumbbell"
  | "yoga";

const VENUE_ICONS: Record<VenueIconKey, LucideIcon> = {
  basketball: Activity,
  volleyball: Activity,
  boxing: Swords,
  reception: Bell,
  "gym-area": Dumbbell,
  dumbbell: Dumbbell,
  yoga: Waves
};

export function normalizeVenueIconKey(value?: string | null): VenueIconKey {
  if (value === "basketball") return value;
  if (value === "volleyball") return value;
  if (value === "boxing") return value;
  if (value === "reception") return value;
  if (value === "gym-area") return value;
  if (value === "yoga") return value;
  return "dumbbell";
}

export function getVenueIcon(iconKey?: string | null): LucideIcon {
  return VENUE_ICONS[normalizeVenueIconKey(iconKey)];
}
