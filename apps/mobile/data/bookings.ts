import type { TimeSlot } from "@/components/modals/shared/TimeSlotModal";
import type { VenueIconKey } from "@/utils/venueMap";

export type AmenityItem = {
  id: string;
  name: string;
  iconKey: VenueIconKey;
  maxSlots: number;
  price: number;
  unit: string;
  isReservable: boolean;
};

export const AMENITIES: AmenityItem[] = [
  { id: "basketball", name: "Basketball Court", iconKey: "basketball", maxSlots: 10, price: 153, unit: "hr", isReservable: true },
  { id: "boxing", name: "Boxing Ring", iconKey: "boxing", maxSlots: 4, price: 29, unit: "hr", isReservable: true },
  { id: "volleyball", name: "Volleyball Court", iconKey: "volleyball", maxSlots: 12, price: 120, unit: "hr", isReservable: true },
  { id: "gym-front", name: "Gym Area (Front)", iconKey: "gym-area", maxSlots: 30, price: 0, unit: "session", isReservable: false },
  { id: "gym-back", name: "Gym Area (Back)", iconKey: "gym-area", maxSlots: 30, price: 0, unit: "session", isReservable: false },
  { id: "reception", name: "Reception", iconKey: "reception", maxSlots: 1, price: 0, unit: "visit", isReservable: false }
];

export const FACILITIES_ONLY_IDS = new Set<string>(["gym-front", "gym-back", "reception"]);

export const TIME_SLOTS: TimeSlot[] = [
  { time: "08:00 AM", duration: "1 hr", status: "available", spots: 3 },
  { time: "09:00 AM", duration: "1 hr", status: "waitlisted", spots: 0 },
  { time: "10:00 AM", duration: "1 hr", status: "available", spots: 9 },
  { time: "11:00 AM", duration: "1 hr", status: "available", spots: 5 },
  { time: "12:00 PM", duration: "1 hr", status: "waitlisted", spots: 1 },
  { time: "02:00 PM", duration: "1 hr", status: "available", spots: 12 },
  { time: "03:00 PM", duration: "1 hr", status: "available", spots: 4 },
  { time: "04:00 PM", duration: "1 hr", status: "available", spots: 2 },
  { time: "05:00 PM", duration: "1 hr", status: "full", spots: 0 },
  { time: "06:00 PM", duration: "1 hr", status: "available", spots: 8 },
  { time: "07:00 PM", duration: "1 hr", status: "available", spots: 6 },
  { time: "08:00 PM", duration: "1 hr", status: "available", spots: 10 }
];

export const STATUS_COLORS: Record<string, string> = {
  pending: "#3B82F6",
  confirmed: "#22C55E",
  completed: "#64748B",
  declined: "#F97316",
  waitlisted: "#F59E0B",
  cancelled: "#EF4444"
};

export type StatusFilter = "all" | "confirmed" | "cancelled";

export const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "confirmed" },
  { label: "Cancelled", value: "cancelled" }
];

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
