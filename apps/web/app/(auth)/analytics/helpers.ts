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
  "hourly" | "daily" | "weekly" | "monthly" | "yearly"
>;

export type AnalyticsAggregationPeriod = Extract<
  AnalyticsPeriod,
  "weekly" | "monthly" | "yearly"
>;

export type AnalyticsTimeMode = "custom" | "day" | "week" | "month" | "year";

export type AnalyticsTimeModeOption = {
  label: string;
  value: AnalyticsTimeMode;
};

export type AnalyticsDateWindow = {
  endDate: string;
  label: string;
  period: AnalyticsAttendanceFilter;
  startDate: string;
};

export type AnalyticsTimeframeDraft = {
  anchorDate?: string;
  endDate?: string;
  month?: number;
  startDate?: string;
  year?: number;
};

export type AnalyticsWeekOption = {
  label: string;
  value: string;
};

export type AnalyticsAttendanceChartPoint = {
  bucketStart: string;
  checkIns: number;
  label: string;
};

export type AnalyticsRevenueChartPoint = {
  bucket: string;
  bookingRevenue: number;
  coachingGymRevenue: number;
  membershipRevenue: number;
  productRevenue: number;
  totalRevenue: number;
};

export type AnalyticsRevenueWindowFilter = "today" | "1m" | "6m" | "all";

export type AnalyticsExportInsights = {
  attendance?: string;
  inventory?: string;
  operations?: string;
  overview?: string;
  revenue?: string;
};

export const ANALYTICS_DEFAULT_ATTENDANCE_FILTER: AnalyticsAttendanceFilter = "daily";
export const ANALYTICS_AGGREGATION_PERIOD_OPTIONS: Array<{
  label: string;
  value: AnalyticsAggregationPeriod;
}> = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" }
];
export const ANALYTICS_TIME_MODE_OPTIONS: AnalyticsTimeModeOption[] = [
  { label: "Custom range", value: "custom" },
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" }
];
export const ANALYTICS_REVENUE_WINDOW_OPTIONS: Array<{
  label: string;
  value: AnalyticsRevenueWindowFilter;
}> = [
  { label: "Today", value: "today" },
  { label: "1 Month", value: "1m" },
  { label: "6 Months", value: "6m" },
  { label: "All Time", value: "all" }
];

export const ANALYTICS_ATTENDANCE_FILTER_OPTIONS: Array<{
  label: string;
  value: AnalyticsAttendanceFilter;
}> = [
  { label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
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

function startOfUtcHour(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      0,
      0,
      0
    )
  );
}

function startOfUtcWeek(value: Date) {
  const start = startOfUtcDay(value);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
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
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function formatFullMoney(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function getAnalyticsPieColors(colors: Pick<ThemeColors, "brand" | "success" | "warning" | "textSecondary">) {
  return [colors.brand, colors.success, colors.warning, colors.textSecondary];
}

export type AnalyticsRevenueColorKey =
  | "bookingRevenue"
  | "coachingGymRevenue"
  | "membershipRevenue"
  | "productRevenue"
  | "totalRevenue";

export function getAnalyticsRevenueColors(
  colors: Pick<
    ThemeColors,
    "brand" | "success" | "warning" | "textPrimary" | "textSecondary"
  >,
): Record<AnalyticsRevenueColorKey, string> {
  return {
    bookingRevenue: colors.success,
    coachingGymRevenue: colors.warning,
    membershipRevenue: colors.brand,
    productRevenue: colors.textSecondary,
    totalRevenue: colors.textPrimary,
  };
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
    return `Create a quick FitTrack analytics readout for ${periodLabel.toLowerCase()}. Use Philippine Peso (₱) for every money value. Summarize revenue movement, membership growth, check-in momentum, coach performance, anomalies, risks, and the 3 most important actions to take next.`;
  }

  const promptParts = [
    `You are helping a FitTrack admin review analytics for ${periodLabel.toLowerCase()}.`,
    "Use the business insight below as the source of truth and turn it into a short operator-friendly briefing.",
    "Use Philippine Peso (₱) for every money value.",
    `Insight summary: ${insight.summary}`,
    insight.highlights?.length ? `Highlights: ${insight.highlights.join(" | ")}` : "",
    insight.risks?.length ? `Risks: ${insight.risks.join(" | ")}` : "",
    insight.opportunities?.length ? `Opportunities: ${insight.opportunities.join(" | ")}` : "",
    insight.recommendedActions?.length
      ? `Recommended actions: ${insight.recommendedActions.join(" | ")}`
      : "",
    "Reply with three parts: what changed, what needs attention, and the top next actions."
  ].filter(Boolean);

  return promptParts.join("\n");
}

export function toRevenueWindow(
  filter: AnalyticsRevenueWindowFilter
): AnalyticsDateWindow {
  const end = new Date();

  if (filter === "today") {
    const start = startOfUtcDay(end);

    return {
      endDate: toDateOnly(endOfUtcDay(end)),
      label: "Today",
      period: "daily",
      startDate: toDateOnly(start)
    };
  }

  if (filter === "1m") {
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 0, 0, 0, 0)
    );

    return {
      endDate: toDateOnly(end),
      label: "Last 1 month",
      period: "daily",
      startDate: toDateOnly(start)
    };
  }

  if (filter === "all") {
    return {
      endDate: toDateOnly(end),
      label: "All time",
      period: "yearly",
      startDate: "1970-01-01"
    };
  }

  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1, 0, 0, 0, 0)
  );

  return {
    endDate: toDateOnly(end),
    label: "Last 6 months",
    period: "monthly",
    startDate: toDateOnly(start)
  };
}

export function getDefaultAnalyticsDateWindow(): AnalyticsDateWindow {
  return {
    ...toRevenueWindow("6m"),
    period: "monthly"
  };
}

export function createAnalyticsDateWindow(
  startDate: string,
  endDate: string,
  period: AnalyticsAttendanceFilter
): AnalyticsDateWindow {
  return {
    endDate,
    label: `${formatAnalyticsDate(startDate)} - ${formatAnalyticsDate(endDate)}`,
    period,
    startDate
  };
}

const ANALYTICS_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function parseAnalyticsDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : isDateOnly
        ? new Date(`${value}T00:00:00.000Z`)
        : new Date(value);

  if (!Number.isFinite(date.getTime())) return null;
  const normalized = startOfUtcDay(date);
  if (isDateOnly && toDateOnly(normalized) !== value) return null;
  return normalized;
}

function firstAnalyticsDate(
  ...values: Array<string | Date | null | undefined>
) {
  for (const value of values) {
    const date = parseAnalyticsDate(value);
    if (date) return date;
  }

  return null;
}

function formatAnalyticsDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function createResolvedAnalyticsWindow(
  startDate: Date,
  endDate: Date,
  period: AnalyticsAttendanceFilter,
  label: string
) {
  return {
    ...createAnalyticsDateWindow(
      toDateOnly(startDate),
      toDateOnly(endDate),
      period
    ),
    label
  };
}

function normalizeAnalyticsDateBounds(
  startDate: Date | null,
  endDate: Date | null,
) {
  if (!startDate || !endDate) return null;

  return startDate <= endDate
    ? { end: endDate, start: startDate }
    : { end: startDate, start: endDate };
}

function isAnalyticsMonth(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 12;
}

function isAnalyticsYear(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 9999;
}

export function deriveAnalyticsCustomPeriod(
  startDate: string,
  endDate: string
): AnalyticsAttendanceFilter | null {
  const start = parseAnalyticsDate(startDate);
  const end = parseAnalyticsDate(endDate);

  const bounds = normalizeAnalyticsDateBounds(start, end);
  if (!bounds) return null;

  const inclusiveDays =
    Math.floor(
      (bounds.end.getTime() - bounds.start.getTime()) /
        ANALYTICS_DAY_MILLISECONDS
    ) +
    1;

  if (inclusiveDays === 1) return "hourly";
  if (inclusiveDays <= 31) return "daily";
  if (inclusiveDays <= 180) return "weekly";
  if (inclusiveDays <= 1095) return "monthly";
  return "yearly";
}

export function resolveAnalyticsTimeframe(
  mode: AnalyticsTimeMode,
  draft: AnalyticsTimeframeDraft = {},
  now = new Date()
): AnalyticsDateWindow | null {
  if (mode === "custom") {
    if (!draft.startDate || !draft.endDate) return null;

    const start = parseAnalyticsDate(draft.startDate);
    const end = parseAnalyticsDate(draft.endDate);
    const bounds = normalizeAnalyticsDateBounds(start, end);
    if (!bounds) return null;

    const period = deriveAnalyticsCustomPeriod(
      draft.startDate,
      draft.endDate
    );
    if (!period) return null;

    return createAnalyticsDateWindow(
      toDateOnly(bounds.start),
      toDateOnly(bounds.end),
      period
    );
  }

  const configuredStart = parseAnalyticsDate(draft.startDate);
  const configuredEnd = parseAnalyticsDate(draft.endDate);
  const weekYearStart =
    mode === "week" && isAnalyticsYear(draft.year)
      ? getAnalyticsWeekOptions(draft.year)[0]?.value
      : undefined;
  const configuredAnchor = firstAnalyticsDate(draft.anchorDate);
  const fallbackAnchor =
    configuredAnchor ??
    (mode === "month" && isAnalyticsYear(draft.year) && isAnalyticsMonth(draft.month)
      ? new Date(Date.UTC(draft.year, draft.month - 1, 1, 0, 0, 0, 0))
      : null) ??
    (mode === "year" && isAnalyticsYear(draft.year)
      ? new Date(Date.UTC(draft.year, 0, 1, 0, 0, 0, 0))
      : null) ??
    firstAnalyticsDate(weekYearStart, configuredEnd, configuredStart) ??
    parseAnalyticsDate(now) ??
    startOfUtcDay(new Date());
  const bounds = normalizeAnalyticsDateBounds(
    configuredStart ?? fallbackAnchor,
    configuredEnd ?? fallbackAnchor,
  );
  if (!bounds) return null;

  if (mode === "day") {
    const period =
      toDateOnly(bounds.start) === toDateOnly(bounds.end) ? "hourly" : "daily";
    const isSingleDay = period === "hourly";
    return createResolvedAnalyticsWindow(
      bounds.start,
      bounds.end,
      period,
      isSingleDay
        ? formatAnalyticsDate(toDateOnly(bounds.start))
        : `${formatAnalyticsDate(toDateOnly(bounds.start))} - ${formatAnalyticsDate(
            toDateOnly(bounds.end)
          )}`
    );
  }

  if (mode === "week") {
    const start = startOfUtcWeek(bounds.start);
    const endWeekStart = startOfUtcWeek(bounds.end);
    const end = new Date(endWeekStart.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    const period = start.getTime() === endWeekStart.getTime() ? "daily" : "weekly";

    return createResolvedAnalyticsWindow(
      start,
      endOfUtcDay(end),
      period,
      start.getTime() === endWeekStart.getTime()
        ? `Week of ${formatAnalyticsWeekRangeLabel(start, end)}`
        : `${formatAnalyticsWeekDay(start, true)} - ${formatAnalyticsWeekDay(
            end,
            true
          )}`
    );
  }

  if (mode === "month") {
    const start = startOfUtcMonth(bounds.start);
    const endMonthStart = startOfUtcMonth(bounds.end);
    const end = endOfUtcMonth(endMonthStart);
    const isSingleMonth = start.getTime() === endMonthStart.getTime();

    return createResolvedAnalyticsWindow(
      start,
      end,
      "monthly",
      isSingleMonth
        ? start.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
          })
        : `${start.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
          })} - ${endMonthStart.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
          })}`
    );
  }

  const start = startOfUtcYear(bounds.start);
  const endYearStart = startOfUtcYear(bounds.end);
  const end = endOfUtcYear(endYearStart);
  const isSingleYear = start.getTime() === endYearStart.getTime();

  return createResolvedAnalyticsWindow(
    start,
    end,
    "yearly",
    isSingleYear
      ? String(start.getUTCFullYear())
      : `${start.getUTCFullYear()} - ${endYearStart.getUTCFullYear()}`
  );
}

function formatAnalyticsWeekDay(value: Date, includeYear = false) {
  return value.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC"
  });
}

function formatAnalyticsWeekRangeLabel(start: Date, end: Date) {
  const crossesYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const startLabel = formatAnalyticsWeekDay(start, crossesYear);
  const endLabel = formatAnalyticsWeekDay(end, crossesYear);

  if (crossesYear || start.getUTCMonth() !== end.getUTCMonth()) {
    return `${startLabel}–${endLabel}`;
  }

  return `${startLabel}–${end.getUTCDate()}`;
}

export function getAnalyticsWeekOptions(year: number): AnalyticsWeekOption[] {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return [];

  const firstMonday = startOfUtcWeek(new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)));

  const lastMonday = startOfUtcWeek(new Date(Date.UTC(year, 11, 31, 0, 0, 0, 0)));
  const options: AnalyticsWeekOption[] = [];

  for (let start = firstMonday; start <= lastMonday; start.setUTCDate(start.getUTCDate() + 7)) {
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);

    options.push({
      label: formatAnalyticsWeekRangeLabel(start, end),
      value: toDateOnly(start)
    });
  }

  return options;
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

  if (filter === "weekly") {
    const start = new Date(startOfUtcDay(now));
    start.setUTCDate(start.getUTCDate() - 83);

    return {
      startDate: toDateOnly(start),
      endDate: toDateOnly(endOfUtcDay(now)),
      period: "weekly",
      label: "Last 12 weeks"
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

  if (filter === "weekly") {
    const end = new Date(startOfUtcDay(bucketDate));
    end.setUTCDate(end.getUTCDate() + 6);

    return {
      startDate: toDateOnly(startOfUtcDay(bucketDate)),
      endDate: toDateOnly(endOfUtcDay(end)),
      period: "daily",
      label: `Daily breakdown for the week of ${bucketDate.toLocaleDateString(
        "en-PH",
        {
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      )}`
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

function formatRevenueBucket(bucketStart: string, period: AnalyticsPeriod) {
  const date = new Date(bucketStart);

  if (period === "daily") {
    return date.toLocaleDateString("en-PH", {
      day: "numeric",
      month: "short"
    });
  }

  if (period === "weekly") {
    return `Week of ${date.toLocaleDateString("en-PH", {
      day: "numeric",
      month: "short"
    })}`;
  }

  if (period === "yearly") {
    return date.toLocaleDateString("en-PH", {
      year: "numeric"
    });
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric"
  });
}

function getAnalyticsBucketStart(
  value: string | Date,
  period: AnalyticsPeriod
) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  switch (period) {
    case "hourly":
      return startOfUtcHour(date);
    case "daily":
      return startOfUtcDay(date);
    case "weekly":
      return startOfUtcWeek(date);
    case "yearly":
      return startOfUtcYear(date);
    case "monthly":
    default:
      return startOfUtcMonth(date);
  }
}

function advanceAnalyticsBucket(value: Date, period: AnalyticsPeriod) {
  const next = new Date(value.getTime());

  switch (period) {
    case "hourly":
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    case "monthly":
    default:
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }

  return next;
}

function getAnalyticsBucketStarts(
  startDate: string,
  endDate: string,
  period: AnalyticsPeriod
) {
  const start = getAnalyticsBucketStart(startDate, period);
  const end = getAnalyticsBucketStart(endDate, period);
  if (!start || !end || start > end) return [];

  const buckets: Date[] = [];
  let cursor = start;

  for (let index = 0; cursor <= end && index < 5000; index += 1) {
    buckets.push(new Date(cursor.getTime()));
    const next = advanceAnalyticsBucket(cursor, period);
    if (next <= cursor) break;
    cursor = next;
  }

  return buckets;
}

function toAnalyticsBucketKey(value: string, period: AnalyticsPeriod) {
  return getAnalyticsBucketStart(value, period)?.toISOString() ?? null;
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

  if (filter === "weekly") {
    return `Week of ${date.toLocaleDateString("en-PH", {
      day: "numeric",
      month: "short"
    })}`;
  }

  if (filter === "monthly") {
    return date.toLocaleDateString("en-PH", {
      month: "short",
      year: "numeric"
    });
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric"
  });
}

export function toRevenueChartSeries(
  revenue: AnalyticsRevenueRecord | undefined
): AnalyticsRevenueChartPoint[] {
  if (!revenue) return [];

  const pointsByBucket = new Map<
    string,
    AnalyticsRevenueRecord["series"][number]
  >();
  revenue.series.forEach((point) => {
    const key = toAnalyticsBucketKey(point.bucketStart, revenue.period);
    if (key) pointsByBucket.set(key, point);
  });

  const toChartPoint = (
    bucketStart: Date,
    point?: AnalyticsRevenueRecord["series"][number]
  ): AnalyticsRevenueChartPoint => ({
    bookingRevenue: point?.bookingRevenue ?? 0,
    bucket: formatRevenueBucket(bucketStart.toISOString(), revenue.period),
    coachingGymRevenue: point?.coachingGymRevenue ?? 0,
    membershipRevenue: point?.membershipRevenue ?? 0,
    productRevenue: point?.productRevenue ?? 0,
    totalRevenue: point?.totalRevenue ?? 0,
  });

  const bucketStarts = getAnalyticsBucketStarts(
    revenue.startDate,
    revenue.endDate,
    revenue.period
  );
  if (bucketStarts.length) {
    return bucketStarts.map((bucketStart) =>
      toChartPoint(
        bucketStart,
        pointsByBucket.get(bucketStart.toISOString())
      )
    );
  }

  return [...revenue.series]
    .sort(
      (left, right) =>
        new Date(left.bucketStart).getTime() -
        new Date(right.bucketStart).getTime()
    )
    .map((point) => toChartPoint(new Date(point.bucketStart), point));
}

export function toAttendanceChartSeries(
  attendance: AnalyticsAttendanceRecord | undefined,
  filter: AnalyticsAttendanceFilter
): AnalyticsAttendanceChartPoint[] {
  if (!attendance) return [];

  const pointsByBucket = new Map<
    string,
    AnalyticsAttendanceRecord["series"][number]
  >();
  attendance.series.forEach((point) => {
    const key = toAnalyticsBucketKey(point.bucketStart, filter);
    if (key) pointsByBucket.set(key, point);
  });

  const toChartPoint = (
    bucketStart: Date,
    point?: AnalyticsAttendanceRecord["series"][number]
  ): AnalyticsAttendanceChartPoint => ({
    bucketStart: bucketStart.toISOString(),
    checkIns: point?.checkIns ?? 0,
    label: formatAttendanceBucket(bucketStart.toISOString(), filter)
  });

  const bucketStarts = getAnalyticsBucketStarts(
    attendance.startDate,
    attendance.endDate,
    filter
  );
  if (bucketStarts.length) {
    return bucketStarts.map((bucketStart) =>
      toChartPoint(
        bucketStart,
        pointsByBucket.get(bucketStart.toISOString())
      )
    );
  }

  return [...attendance.series]
    .sort(
      (left, right) =>
        new Date(left.bucketStart).getTime() -
        new Date(right.bucketStart).getTime()
    )
    .map((point) => toChartPoint(new Date(point.bucketStart), point));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
      title: "Operations Snapshot",
      subtitle: "Current operating totals and selected-window activity trends",
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
      subtitle: "Selected revenue window",
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
