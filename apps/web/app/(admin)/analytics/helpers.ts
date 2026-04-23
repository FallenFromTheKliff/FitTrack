"use client";

import type {
  AnalyticsAttendanceRecord,
  AnalyticsPeriod,
  AnalyticsRevenueRecord,
  AnalyticsSnapshotRecord,
  BusinessInsightRunDetailRecord
} from "@fittrack/types";
import type { ThemeColors } from "@fittrack/ui/tokens";

export type AnalyticsAttendanceFilter = Extract<
  AnalyticsPeriod,
  "hourly" | "daily" | "monthly" | "yearly"
>;

export type AnalyticsDateWindow = {
  endDate: string;
  label: string;
  period: AnalyticsAttendanceFilter | "weekly";
  startDate: string;
};

export type AnalyticsAttendanceChartPoint = {
  bucketStart: string;
  checkIns: number;
  label: string;
};

export type AnalyticsRevenueChartPoint = {
  bucket: string;
  gymShare: number;
  totalRevenue: number;
};

export type AnalyticsExportInsights = {
  attendance?: string;
  inventory?: string;
  operations?: string;
  overview?: string;
  revenue?: string;
};

export const ANALYTICS_DEFAULT_ATTENDANCE_FILTER: AnalyticsAttendanceFilter = "daily";
export const ANALYTICS_REVENUE_PERIOD_LABEL = "Last 6 months";

export const ANALYTICS_ATTENDANCE_FILTER_OPTIONS: Array<{
  label: string;
  value: AnalyticsAttendanceFilter;
}> = [
  { label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" }
];

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function endOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function startOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function startOfUtcYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

function endOfUtcYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

export function formatCompactMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function formatFullMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function getAnalyticsPieColors(colors: Pick<ThemeColors, "brand" | "success" | "warning" | "textSecondary">) {
  return [colors.brand, colors.success, colors.warning, colors.textSecondary];
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
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

export function toRevenueWindow(): AnalyticsDateWindow {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1, 0, 0, 0, 0));

  return {
    endDate: toDateOnly(end),
    label: ANALYTICS_REVENUE_PERIOD_LABEL,
    period: "monthly",
    startDate: toDateOnly(start)
  };
}

export function toAttendanceWindow(filter: AnalyticsAttendanceFilter): AnalyticsDateWindow {
  const now = new Date();

  if (filter === "hourly") {
    return {
      startDate: toDateOnly(startOfUtcDay(now)),
      endDate: toDateOnly(endOfUtcDay(now)),
      period: "hourly",
      label: "Today by hour"
    };
  }

  if (filter === "daily") {
    const start = new Date(startOfUtcDay(now));
    start.setUTCDate(start.getUTCDate() - 13);

    return {
      startDate: toDateOnly(start),
      endDate: toDateOnly(endOfUtcDay(now)),
      period: "daily",
      label: "Last 14 days"
    };
  }

  if (filter === "monthly") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0));

    return {
      startDate: toDateOnly(start),
      endDate: toDateOnly(endOfUtcMonth(now)),
      period: "monthly",
      label: "Last 12 months"
    };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear() - 4, 0, 1, 0, 0, 0, 0));

  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(endOfUtcYear(now)),
    period: "yearly",
    label: "Last 5 years"
  };
}

export function deriveAttendanceDrilldownWindow(
  bucketStart: string,
  filter: AnalyticsAttendanceFilter
): AnalyticsDateWindow | null {
  const bucketDate = new Date(bucketStart);

  if (filter === "hourly") return null;

  if (filter === "daily") {
    return {
      startDate: toDateOnly(startOfUtcDay(bucketDate)),
      endDate: toDateOnly(endOfUtcDay(bucketDate)),
      period: "hourly",
      label: `Hourly breakdown for ${bucketDate.toLocaleDateString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })}`
    };
  }

  if (filter === "monthly") {
    return {
      startDate: toDateOnly(startOfUtcMonth(bucketDate)),
      endDate: toDateOnly(endOfUtcMonth(bucketDate)),
      period: "daily",
      label: `Daily breakdown for ${bucketDate.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric"
      })}`
    };
  }

  return {
    startDate: toDateOnly(startOfUtcYear(bucketDate)),
    endDate: toDateOnly(endOfUtcYear(bucketDate)),
    period: "monthly",
    label: `Monthly breakdown for ${bucketDate.getUTCFullYear()}`
  };
}

function formatRevenueBucket(bucketStart: string) {
  return new Date(bucketStart).toLocaleDateString("en-PH", {
    month: "short",
    year: "2-digit"
  });
}

function formatAttendanceBucket(bucketStart: string, filter: AnalyticsAttendanceFilter) {
  const date = new Date(bucketStart);

  if (filter === "hourly") {
    return date.toLocaleTimeString("en-PH", {
      hour: "numeric"
    });
  }

  if (filter === "daily") {
    return date.toLocaleDateString("en-PH", {
      day: "numeric",
      month: "short"
    });
  }

  if (filter === "monthly") {
    return date.toLocaleDateString("en-PH", {
      month: "short",
      year: "2-digit"
    });
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric"
  });
}

export function toRevenueChartSeries(
  revenue: AnalyticsRevenueRecord | undefined
): AnalyticsRevenueChartPoint[] {
  return revenue?.series.map((point) => ({
    bucket: formatRevenueBucket(point.bucketStart),
    totalRevenue: point.totalRevenue,
    gymShare: point.coachingGymRevenue
  })) ?? [];
}

export function toAttendanceChartSeries(
  attendance: AnalyticsAttendanceRecord | undefined,
  filter: AnalyticsAttendanceFilter
): AnalyticsAttendanceChartPoint[] {
  return attendance?.series.map((point) => ({
    bucketStart: point.bucketStart,
    checkIns: point.checkIns,
    label: formatAttendanceBucket(point.bucketStart, filter)
  })) ?? [];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInsightBlock(label: string, insight?: string) {
  const copy = insight?.trim() || `${label} insight was unavailable when the export was generated.`;

  return `
    <div style="margin-top:12px;padding:14px 16px;border:1px solid #fed7aa;border-radius:16px;background:#fff7ed;">
      <div style="font-size:11px;letter-spacing:0.14em;font-weight:700;color:#c2410c;text-transform:uppercase;">AI Insight</div>
      <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#7c2d12;">${escapeHtml(copy)}</p>
    </div>
  `;
}

function renderTableSection(args: {
  columns: string[];
  insight?: string;
  rows: string[][];
  subtitle?: string;
  title: string;
}) {
  const headerHtml = args.columns
    .map(
      (column) => `
        <th style="padding:10px 12px;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">
          ${escapeHtml(column)}
        </th>
      `
    )
    .join("");
  const rowsHtml = args.rows
    .map(
      (row) => `
        <tr>
          ${row
            .map(
              (cell) => `
                <td style="padding:10px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;vertical-align:top;">
                  ${escapeHtml(cell)}
                </td>
              `
            )
            .join("")}
        </tr>
      `
    )
    .join("");

  return `
    <section style="margin-top:24px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;">
        <div>
          <h2 style="margin:0;font-size:20px;line-height:1.2;color:#111827;">${escapeHtml(args.title)}</h2>
          ${args.subtitle ? `<p style="margin:6px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(args.subtitle)}</p>` : ""}
        </div>
      </div>
      <div style="margin-top:12px;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#ffffff;">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="background:#f9fafb;">
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="${args.columns.length}" style="padding:16px 12px;color:#6b7280;">No data available.</td></tr>`}</tbody>
        </table>
      </div>
      ${renderInsightBlock(args.title, args.insight)}
    </section>
  `;
}

export function buildAnalyticsPdfBody(args: {
  attendance: AnalyticsAttendanceRecord | undefined;
  attendanceLabel: string;
  exportInsights: AnalyticsExportInsights;
  generatedAt: string;
  revenue: AnalyticsRevenueRecord | undefined;
  snapshot: AnalyticsSnapshotRecord | undefined;
}) {
  const snapshot = args.snapshot;
  const revenue = args.revenue;
  const attendance = args.attendance;
  const peakHoursLabel = attendance?.peakHours.length
    ? attendance.peakHours.map((entry) => `${entry.hourLabel} (${entry.checkIns})`).join(", ")
    : "No peak-hour data available yet.";

  const sections = [
    renderTableSection({
      title: "Daily Insights",
      subtitle: "Live account and activity pulse",
      insight: args.exportInsights.overview,
      columns: ["Metric", "Value"],
      rows: snapshot
        ? [
            ["Active Members", String(snapshot.dailyInsights.activeMembers)],
            ["Sessions Today", String(snapshot.dailyInsights.sessionsToday)],
            ["Recent Activities", String(snapshot.dailyInsights.recentActivities)]
          ]
        : []
    }),
    renderTableSection({
      title: "Performance KPIs",
      subtitle: "Current month operational performance",
      insight: args.exportInsights.overview,
      columns: ["KPI", "Value"],
      rows: snapshot
        ? [
            ["Total Revenue", formatFullMoney(snapshot.performanceKpis.totalRevenue)],
            ["Total Venue Bookings", String(snapshot.performanceKpis.totalVenueBookings)],
            ["Total Coaching Appointments", String(snapshot.performanceKpis.totalCoachingAppointments)],
            ["New Members", String(snapshot.performanceKpis.newMembers)],
            ["Check-ins", String(snapshot.performanceKpis.checkIns)],
            ["Coaching Sessions", String(snapshot.performanceKpis.coachingSessions)]
          ]
        : []
    }),
    renderTableSection({
      title: "Revenue",
      subtitle: ANALYTICS_REVENUE_PERIOD_LABEL,
      insight: args.exportInsights.revenue,
      columns: ["Revenue Source", "Amount"],
      rows: revenue
        ? [
            ["Total Generated Revenue", formatFullMoney(revenue.totals.totalRevenue)],
            ...revenue.topRevenueSources.map((entry) => [
              `${entry.sourceLabel} (${entry.sharePercentage.toFixed(1)}%)`,
              formatFullMoney(entry.revenue)
            ])
          ]
        : []
    }),
    renderTableSection({
      title: "Attendance",
      subtitle: `${args.attendanceLabel} • Peak hours: ${peakHoursLabel}`,
      insight: args.exportInsights.attendance,
      columns: ["Bucket", "Check-ins"],
      rows:
        attendance?.series.map((entry) => [
          formatAttendanceBucket(entry.bucketStart, attendance.period as AnalyticsAttendanceFilter),
          String(entry.checkIns)
        ]) ?? []
    }),
    renderTableSection({
      title: "System Alerts",
      subtitle: "Live stock and equipment warnings",
      insight: args.exportInsights.inventory,
      columns: ["Alert", "Action", "Details"],
      rows:
        snapshot?.systemAlerts.map((alert) => [
          alert.title,
          alert.actionLabel,
          alert.body
        ]) ?? []
    }),
    renderTableSection({
      title: "Recent Activities",
      subtitle: "Latest operational timeline",
      insight: args.exportInsights.operations ?? args.exportInsights.overview,
      columns: ["Time", "Title", "Status", "Details"],
      rows:
        snapshot?.recentActivities.map((activity) => [
          formatDateTime(activity.occurredAt),
          activity.title,
          activity.status.replace(/_/g, " "),
          activity.description
        ]) ?? []
    })
  ];

  return `
    <div style="font-family: Inter, Arial, sans-serif; color:#111827;">
      <header style="padding-bottom:20px;border-bottom:2px solid #ea580c;">
        <div style="font-size:12px;letter-spacing:0.16em;font-weight:700;text-transform:uppercase;color:#ea580c;">FitTrack Analytics</div>
        <h1 style="margin:10px 0 0;font-size:32px;line-height:1.1;">Analytics Export</h1>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#4b5563;">
          Generated ${escapeHtml(formatDateTime(args.generatedAt))}. This print-ready export is intended to be saved as PDF and includes AI-assisted observations after each analytics table.
        </p>
      </header>
      ${sections.join("")}
    </div>
  `;
}
