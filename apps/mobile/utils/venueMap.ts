import { ConciergeBell, Dribbble, Dumbbell, Swords, Volleyball, Waves, type LucideIcon } from "lucide-react-native";
import { normalizeVenueIconKey, type VenueIconKey } from "@fittrack/types";

export { normalizeVenueIconKey };
export type { VenueIconKey };

const VENUE_ICONS: Record<VenueIconKey, LucideIcon> = {
  basketball: Dribbble,
  volleyball: Volleyball,
  boxing: Swords,
  reception: ConciergeBell,
  "gym-area": Dumbbell,
  yoga: Waves
};

export function getVenueIcon(iconKey?: string | null): LucideIcon {
  return VENUE_ICONS[normalizeVenueIconKey(iconKey)];
}
