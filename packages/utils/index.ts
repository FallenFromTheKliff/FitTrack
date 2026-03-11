import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";

export const formatDate = (iso: string, pat = "MMM d, yyyy") => {
  const d = parseISO(iso);
  return isValid(d) ? format(d, pat) : "—";
};

export const formatDateTime = (iso: string) =>
  formatDate(iso, "MMM d, yyyy · h:mm a");

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

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-PH").format(n);

export function slotLabel(booked: number, capacity: number): string {
  if (booked >= capacity) return "Full";
  if (booked >= capacity * 0.8) return "Almost Full";
  return `${capacity - booked} left`;
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

export const revisePassword = (password: string) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial };
};
