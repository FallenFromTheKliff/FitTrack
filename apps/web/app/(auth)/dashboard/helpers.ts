import type { DashboardActivityItem } from "@/data/charts/dashboard";

export function getDashboardActivityStatusColor(
  status: "active" | "success" | "muted",
  colors: { brand: string; success: string; textMuted: string }
) {
  if (status === "active") return colors.brand;
  if (status === "success") return colors.success;
  return colors.textMuted;
}

export const DASHBOARD_DEFAULT_PERIOD = "this-month";
export const DASHBOARD_DEFAULT_ACTIVITY_FILTER = "all";
export const DASHBOARD_REPORT_EXPORT_ID = "dashboard-report-export";

export function filterDashboardSeries<T>(series: T[], period: string) {
  if (period === "last-3-months") return series.slice(-3);
  if (period === "last-month") {
    const previousPoint = series.at(-2);
    return previousPoint ? [previousPoint] : series.slice(-1);
  }
  return series.slice(-1);
}

export function getDashboardPeriodSubtitle(period: string) {
  if (period === "last-3-months") return "Last 3 months";
  if (period === "last-month") return "Last month snapshot";
  return "This month snapshot";
}

export function filterDashboardActivityRows(
  rows: DashboardActivityItem[],
  filter: string
) {
  if (filter === "checkins") {
    return rows.filter((row) => /check/i.test(row.action));
  }
  if (filter === "bookings") {
    return rows.filter((row) => /book/i.test(row.action));
  }
  return rows;
}
