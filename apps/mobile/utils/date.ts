import { MONTH_NAMES_SHORT } from "@/data/calendar";

export function formatGroupLabel(dateStr: string): string {
  const normalized = dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr;
  const date = new Date(normalized);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date.getTime() === today.getTime()) return "Today";
  return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function nextDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
