export type Role = "ADMIN" | "STAFF" | "USER" | "COACH";
export type ThemeKey = "night" | "sunlight" | "dark" | "light" | "navy";
export type FontKey = "standard" | "retro" | "painter";
export type AnimationLevel = "full" | "minimal" | "none";
export type SlotStatus = "available" | "full" | "waitlist";
export type BookingStatus =
  | "pending"
  | "pending_downpayment"
  | "pending_payment"
  | "pending_full_payment"
  | "confirmed"
  | "completed"
  | "waitlisted"
  | "no_show"
  | "cancelled";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type EquipmentStatus = "available" | "maintenance" | "occupied";
export type MemberTier = "Basic" | "Premium" | "Elite";
export type CalendarViewMode = "DAYS" | "MONTHS" | "YEARS";
