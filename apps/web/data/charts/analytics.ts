import { Activity, DollarSign, TrendingUp, Users, type LucideIcon } from "lucide-react";

export type AnalyticsKpi = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: string;
  colorKey: "success" | "brand" | "textSecondary";
};

export const ANALYTICS_PERIOD_OPTIONS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 6 Months", value: "6m" },
  { label: "Last 3 Months", value: "3m" },
  { label: "This Year", value: "year" }
];

export const ANALYTICS_REVENUE_DATA = [
  { m: "Jan", revenue: 29000, expense: 16000 },
  { m: "Feb", revenue: 32000, expense: 18000 },
  { m: "Mar", revenue: 35000, expense: 17000 },
  { m: "Apr", revenue: 38000, expense: 19000 },
  { m: "May", revenue: 42000, expense: 18500 },
  { m: "Jun", revenue: 46000, expense: 17500 }
];

export const ANALYTICS_WEEK_DATA = [
  { d: "Mon", morning: 80, afternoon: 60, evening: 40 },
  { d: "Tue", morning: 90, afternoon: 70, evening: 50 },
  { d: "Wed", morning: 75, afternoon: 80, evening: 60 },
  { d: "Thu", morning: 85, afternoon: 65, evening: 55 },
  { d: "Fri", morning: 110, afternoon: 90, evening: 80 },
  { d: "Sat", morning: 100, afternoon: 95, evening: 70 },
  { d: "Sun", morning: 60, afternoon: 50, evening: 30 }
];

export const ANALYTICS_PIE_DATA = [
  { name: "Premium", value: 240 },
  { name: "Standard", value: 180 },
  { name: "Basic", value: 160 }
];

export const ANALYTICS_PEAK_DATA = [
  { h: "6AM", v: 20 },
  { h: "7AM", v: 35 },
  { h: "8AM", v: 60 },
  { h: "9AM", v: 80 },
  { h: "10AM", v: 50 },
  { h: "11AM", v: 40 },
  { h: "12PM", v: 90 },
  { h: "1PM", v: 120 },
  { h: "2PM", v: 100 }
];

export const ANALYTICS_KPIS: AnalyticsKpi[] = [
  { icon: DollarSign, label: "Total Revenue", value: "$223K", delta: "+24%", colorKey: "success" },
  { icon: Users, label: "New Members", value: "240", delta: "+18%", colorKey: "brand" },
  { icon: Activity, label: "Avg. Daily Visits", value: "342", delta: "+12%", colorKey: "textSecondary" },
  { icon: TrendingUp, label: "Retention Rate", value: "94%", delta: "+8%", colorKey: "success" }
];
