import type { FieldConfig } from "@/components/modals/DetailsModal";

export const SCHEDULE_STATS = [
  { label: "Total Bookings", value: "9" },
  { label: "Facility Bookings", value: "5" },
  { label: "Trainer Sessions", value: "4" },
  { label: "Utilization Rate", value: "14%" }
];

export const SCHEDULE_EMOJI_OPTIONS = [
  "🧑‍🏫", "🧑‍💼", "🧑‍🔧", "🧑‍🎓", "🏋️", "💪",
  "🥊", "🎯", "⚡", "🏀", "🎾", "🏊", "🧘", "🚴"
];

export const STAFF_ACTIVITY = [
  { id: "a1", label: "Schedule updated for this week", date: "Mar 11, 2026" },
  { id: "a2", label: "Profile details verified by Admin", date: "Mar 10, 2026" },
  { id: "a3", label: "New client booking assigned", date: "Mar 09, 2026" }
];

export const DEFAULT_FACILITY_ICON = "🏋️";
export const DEFAULT_STAFF_ICON = "🧑‍💼";

export const BOOKING_COLOR_OPTIONS = [
  { label: "Blue", value: "var(--fit-text-secondary)" },
  { label: "Orange", value: "var(--fit-brand)" },
  { label: "Green", value: "var(--fit-success)" },
  { label: "Purple", value: "var(--fit-brand-light)" },
  { label: "Pink", value: "var(--fit-warning)" },
  { label: "Teal", value: "var(--fit-surface-raised)" }
];

export const BOOKING_FIELDS: FieldConfig[] = [
  { name: "resource", label: "Resource", type: "select", required: true, options: [] },
  { name: "title", label: "Title", type: "text", required: true, placeholder: "e.g., Team Practice - Eagles" },
  { name: "startTime", label: "Start Time", type: "time", required: true },
  { name: "endTime", label: "End Time", type: "time", required: true },
  { name: "color", label: "Color", type: "select", options: BOOKING_COLOR_OPTIONS }
];