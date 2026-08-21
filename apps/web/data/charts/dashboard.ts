import {
  AlertTriangle,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon
} from "lucide-react";

export type DashboardKpi = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: string;
};

export type DashboardActivityItem = {
  member: string;
  action: string;
  time: string;
  status: "active" | "success" | "muted";
};

export type DashboardAlert = {
  icon: LucideIcon;
  colorKey: "warning" | "textSecondary";
  title: string;
  body: string;
  action: string;
};

export const DASHBOARD_PERIOD_OPTIONS = [
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 3 Months", value: "last-3-months" }
];

export const DASHBOARD_ACTIVITY_FILTER_OPTIONS = [
  { label: "All Activities", value: "all" },
  { label: "Check-ins", value: "checkins" },
  { label: "Bookings", value: "bookings" }
];

export const DASHBOARD_KPIS: DashboardKpi[] = [
  { icon: Users, label: "Active Members", value: "580", delta: "+12%" },
  { icon: CalendarDays, label: "Sessions Today", value: "124", delta: "+8%" },
  { icon: DollarSign, label: "Monthly Revenue", value: "₱2.7M", delta: "+15%" },
  { icon: TrendingUp, label: "Avg. Attendance", value: "87%", delta: "+5%" }
];

export const DASHBOARD_GROWTH = [
  { m: "Jan", v: 280 },
  { m: "Feb", v: 320 },
  { m: "Mar", v: 390 },
  { m: "Apr", v: 450 },
  { m: "May", v: 490 },
  { m: "Jun", v: 570 }
];

export const DASHBOARD_REVENUE = [
  { m: "Jan", v: 29000 },
  { m: "Feb", v: 32000 },
  { m: "Mar", v: 35000 },
  { m: "Apr", v: 38000 },
  { m: "May", v: 42000 },
  { m: "Jun", v: 46000 }
];

export const DASHBOARD_ACTIVITY: DashboardActivityItem[] = [
  { member: "Sarah Johnson", action: "Checked in", time: "5 min ago", status: "active" },
  { member: "Mike Chen", action: "Booked class", time: "12 min ago", status: "active" },
  { member: "Emily Rodriguez", action: "Membership renewed", time: "1h ago", status: "success" },
  { member: "David Thompson", action: "Checked out", time: "2h ago", status: "muted" }
];

export const DASHBOARD_ALERTS: DashboardAlert[] = [
  {
    icon: AlertTriangle,
    colorKey: "warning",
    title: "Low Stock Alert",
    body: "Whey Protein - Vanilla is below reorder threshold (8 units left).",
    action: "Restock"
  },
  {
    icon: Wrench,
    colorKey: "textSecondary",
    title: "Maintenance Due",
    body: "Treadmill #3 is due for quarterly maintenance inspection.",
    action: "Schedule"
  }
];
