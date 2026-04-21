import type {
  AnalyticsAttendanceRecord,
  AnalyticsPaginatedResult,
  BusinessInsightRunDetailRecord,
  AnalyticsRevenueRecord
} from "@fittrack/types";

export function getAnalyticsPieColors(colors: {
  brand: string;
  textSecondary: string;
  success: string;
  warning?: string;
}) {
  return [colors.brand, colors.textSecondary, colors.success, colors.warning ?? colors.brand];
}

export const ANALYTICS_DEFAULT_PERIOD = "6m";
export const ANALYTICS_REPORT_EXPORT_ID = "analytics-report-export";

export function formatCompactMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function buildAnalyticsQuickAnalysisPrompt(
  periodLabel: string,
  insight?: BusinessInsightRunDetailRecord
) {
  if (!insight) {
    return `Create a quick FitTrack analytics readout for ${periodLabel.toLowerCase()}. Summarize revenue movement, membership growth, check-in momentum, coach performance, anomalies, risks, and the 3 most important actions to take next.`;
  }

  const promptParts = [
    `You are helping a FitTrack admin review analytics for ${periodLabel.toLowerCase()}.`,
    "Use the business insight below as the source of truth and turn it into a short operator-friendly briefing.",
    `Insight summary: ${insight.summary}`,
    insight.highlights.length ? `Highlights: ${insight.highlights.join(" | ")}` : "",
    insight.risks.length ? `Risks: ${insight.risks.join(" | ")}` : "",
    insight.opportunities.length ? `Opportunities: ${insight.opportunities.join(" | ")}` : "",
    insight.recommendedActions.length
      ? `Recommended actions: ${insight.recommendedActions.join(" | ")}`
      : "",
    "Reply with three parts: what changed, what needs attention, and the top next actions."
  ].filter(Boolean);

  return promptParts.join("\n");
}

export function toPeriodWindow(period: string) {
  const end = new Date();
  const start = new Date(end);
  if (period === "7d") {
    start.setDate(end.getDate() - 6);
    return {
      period: "daily" as const,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }
  if (period === "30d") {
    start.setDate(end.getDate() - 29);
    return {
      period: "daily" as const,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }
  if (period === "3m") {
    start.setMonth(end.getMonth() - 2, 1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  } else {
    start.setMonth(end.getMonth() - 5, 1);
  }

  return {
    period: "monthly" as const,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

export function toLastSevenDaysWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    period: "daily" as const,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

export function formatAnalyticsPeriodLabel(period: string) {
  if (period === "7d") return "Last 7 days";
  if (period === "30d") return "Last 30 days";
  if (period === "3m") return "Last 3 months";
  if (period === "year") return "Year to date";
  return "Last 6 months";
}

export function defaultAnalyticsPaginatedResult<T>(): AnalyticsPaginatedResult<T> {
  return {
    data: [],
    meta: { page: 1, limit: 0, total: 0, total_pages: 0 }
  };
}

export function toAnalyticsPieData(revenue: AnalyticsRevenueRecord | undefined) {
  const totals = revenue?.totals;
  return [
    { name: "Membership", value: totals?.membershipRevenue ?? 0 },
    { name: "Bookings", value: totals?.bookingRevenue ?? 0 },
    { name: "Products", value: totals?.productRevenue ?? 0 },
    { name: "Coaching Gym", value: totals?.coachingGymRevenue ?? 0 }
  ].filter((entry) => entry.value > 0);
}

function formatRevenueBucket(bucketStart: string, period: string) {
  const date = new Date(bucketStart);
  if (period === "7d" || period === "30d") {
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function toAnalyticsRevenueSeries(
  revenue: AnalyticsRevenueRecord | undefined,
  period: string
) {
  return revenue?.series.map((point) => ({
    bucket: formatRevenueBucket(point.bucketStart, period),
    totalRevenue: point.totalRevenue,
    gymShare: point.coachingGymRevenue
  })) ?? [];
}

export function toAnalyticsAttendanceSeries(attendance: AnalyticsAttendanceRecord | undefined) {
  return attendance?.series.map((point) => ({
    day: new Date(point.bucketStart).toLocaleDateString("en-US", { weekday: "short" }),
    checkIns: point.checkIns
  })) ?? [];
}
