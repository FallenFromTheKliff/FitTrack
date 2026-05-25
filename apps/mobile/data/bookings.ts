import type { TimeSlot } from "@/components/modals/shared/TimeSlotModal";

export const TIME_SLOTS: TimeSlot[] = [
  { time: "08:00 AM", duration: "1 hr", status: "available" },
  { time: "09:00 AM", duration: "1 hr", status: "available" },
  { time: "10:00 AM", duration: "1 hr", status: "available" },
  { time: "11:00 AM", duration: "1 hr", status: "available" },
  { time: "12:00 PM", duration: "1 hr", status: "available" },
  { time: "01:00 PM", duration: "1 hr", status: "available" },
  { time: "02:00 PM", duration: "1 hr", status: "available" },
  { time: "03:00 PM", duration: "1 hr", status: "available" },
  { time: "04:00 PM", duration: "1 hr", status: "available" },
  { time: "05:00 PM", duration: "1 hr", status: "available" },
  { time: "06:00 PM", duration: "1 hr", status: "available" },
  { time: "07:00 PM", duration: "1 hr", status: "available" },
  { time: "08:00 PM", duration: "1 hr", status: "available" }
];

export const STATUS_COLORS: Record<string, string> = {
  pending: "#3B82F6",
  pending_coach: "#3B82F6",
  pending_downpayment: "#F59E0B",
  pending_payment: "#F59E0B",
  pending_full_payment: "#F59E0B",
  confirmed: "#22C55E",
  completed: "#64748B",
  declined: "#F97316",
  waitlisted: "#F59E0B",
  no_show: "#EF4444",
  cancelled: "#EF4444"
};

export type StatusFilter = "all" | "pending" | "confirmed" | "completed" | "no_show" | "cancelled";

export const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "No Show", value: "no_show" },
  { label: "Cancelled", value: "cancelled" }
];

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
