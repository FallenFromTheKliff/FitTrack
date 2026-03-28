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