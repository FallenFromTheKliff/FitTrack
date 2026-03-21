import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";

export const formatDate = (iso: string, pat = "MMM d, yyyy") => {
  const d = parseISO(iso);
  return isValid(d) ? format(d, pat) : "—";
};
export const formatDateTime = (iso: string) => formatDate(iso, "MMM d, yyyy · h:mm a");
export function formatTodayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
export function parseYMD(s: string) {
  const [y = 0, m = 0, d = 0] = (s || "").split("-").map(Number);
  return { year: y, month: m, day: d };
}
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function formatBookingDate(dateStr: string): string {
  if (!dateStr) return "Select a date";
  const { year, month, day } = parseYMD(dateStr);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatShortDate(iso: string): string {
  return formatDate(iso, "MMM d");
}
export function formatLongDate(iso: string): string {
  return formatDate(iso, "MMMM d, yyyy");
}
export function formatMonthYear(iso: string): string {
  return formatDate(iso, "MMM yyyy");
}

export function formatTime(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
export const timeAgo = (iso: string) => {
  const d = parseISO(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "—";
};

export function calcBMI(weightKg: number, heightCm: number) {
  const hm = heightCm / 100;
  const bmi = Math.round((weightKg / (hm * hm)) * 10) / 10;
  const status = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  return { bmi, status };
}

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

export const formatNumber = (n: number) => new Intl.NumberFormat("en-PH").format(n);

export function slotLabel(booked: number, capacity: number): string {
  if (booked >= capacity) return "Full";
  if (booked >= capacity * 0.8) return "Almost Full";
  return `${capacity - booked} left`;
}

export const revisePassword = (password: string) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial };
};

export function splitFullName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}