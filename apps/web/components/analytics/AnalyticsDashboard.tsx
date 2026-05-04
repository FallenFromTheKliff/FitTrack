"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarClock,
  Clock3,
  Download,
  PackageSearch,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  ANALYTICS_ATTENDANCE_FILTER_OPTIONS,
  formatCompactMoney,
  formatDateTime,
  formatFullMoney,
} from "@/app/(admin)/analytics/helpers";
import {
  FitButton,
  FitChartContainer,
  FitSection,
  FitSelect,
  FitText,
} from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useAnalyticsSectionFilter } from "@/contexts/AnalyticsSectionFilterContext";
import { useAnalyticsDashboard } from "../../hooks/analytics/useAnalyticsDashboard";

type RevenueSourceFilter =
  | "all"
  | "membership"
  | "bookings"
  | "products"
  | "coaching";

const REVENUE_SOURCE_FILTER_OPTIONS = [
  { label: "All Business Revenue", value: "all" },
  { label: "Membership", value: "membership" },
  { label: "Venue Booking", value: "bookings" },
  { label: "Retail Product", value: "products" },
  { label: "Coaching Gym Share", value: "coaching" },
] as const;

const REVENUE_SOURCE_SERIES_KEY: Record<
  RevenueSourceFilter,
  | "bookingRevenue"
  | "coachingGymRevenue"
  | "membershipRevenue"
  | "productRevenue"
  | "totalRevenue"
> = {
  all: "totalRevenue",
  bookings: "bookingRevenue",
  coaching: "coachingGymRevenue",
  membership: "membershipRevenue",
  products: "productRevenue",
};

function getAlertIcon(kind: string) {
  if (kind === "maintenance_due") return Wrench;
  return PackageSearch;
}

function getAlertLaneLabel(kind: string) {
  return kind === "maintenance_due" ? "Equipment warning" : "Inventory warning";
}

export function AnalyticsDashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const analytics = useAnalyticsDashboard();
  const { shouldShowSection } = useAnalyticsSectionFilter();
  const [revenueSourceFilter, setRevenueSourceFilter] =
    useState<RevenueSourceFilter>("all");

  const systemAlerts = analytics.snapshot?.systemAlerts ?? [];
  const selectedRevenueValue = useMemo(() => {
    const totals = analytics.revenue?.totals;
    if (!totals) return 0;

    switch (revenueSourceFilter) {
      case "membership":
        return totals.membershipRevenue;
      case "bookings":
        return totals.bookingRevenue;
      case "products":
        return totals.productRevenue;
      case "coaching":
        return totals.coachingGymRevenue;
      default:
        return totals.totalRevenue;
    }
  }, [analytics.revenue?.totals, revenueSourceFilter]);
  const selectedRevenueLabel = useMemo(() => {
    switch (revenueSourceFilter) {
      case "membership":
        return "Membership Revenue";
      case "bookings":
        return "Venue Booking Revenue";
      case "products":
        return "Retail Product Revenue";
      case "coaching":
        return "Coaching Gym Share";
      default:
        return "All Business Revenue";
    }
  }, [revenueSourceFilter]);
  const selectedRevenueDescription = useMemo(() => {
    switch (revenueSourceFilter) {
      case "membership":
        return "Completed membership payments captured in the selected revenue window.";
      case "bookings":
        return "Completed venue-booking revenue captured in the selected revenue window.";
      case "products":
        return "Completed retail sales captured in the selected revenue window.";
      case "coaching":
        return "Gym-side coaching share captured in the selected revenue window.";
      default:
        return "Combined membership, venue booking, retail product, and coaching gym-share revenue in the selected revenue window.";
    }
  }, [revenueSourceFilter]);
  const selectedRevenueSeriesKey =
    REVENUE_SOURCE_SERIES_KEY[revenueSourceFilter];
  const topRevenueSources = analytics.revenue?.topRevenueSources ?? [];
  const latestRecommendedActions =
    analytics.latestInsight?.recommendedActions ?? [];

  const dailyInsightCards = [
    {
      label: "Active Members",
      value: analytics.visibleActiveMemberCount,
      helper: "Accounts with active member access right now.",
      icon: Users,
    },
    {
      label: "Sessions Today",
      value: analytics.snapshot?.dailyInsights.sessionsToday ?? 0,
      helper: "Check-ins recorded since midnight.",
      icon: Clock3,
    },
    {
      label: "Recent Activities",
      value: analytics.snapshot?.dailyInsights.recentActivities ?? 0,
      helper: "Operational events captured in the last 24 hours.",
      icon: TrendingUp,
    },
  ];

  const performanceKpis = [
    {
      icon: BarChart3,
      label: "All-Time Revenue",
      value: formatCompactMoney(
        analytics.snapshot?.performanceKpis.totalRevenue ?? 0,
      ),
    },
    {
      icon: CalendarClock,
      label: "All-Time Venue Bookings",
      value: String(
        analytics.snapshot?.performanceKpis.totalVenueBookings ?? 0,
      ),
    },
    {
      icon: TrendingUp,
      label: "All-Time Coaching Appointments",
      value: String(
        analytics.snapshot?.performanceKpis.totalCoachingAppointments ?? 0,
      ),
    },
    {
      icon: Users,
      label: "Members Added",
      value: String(analytics.snapshot?.performanceKpis.newMembers ?? 0),
    },
    {
      icon: Clock3,
      label: "All-Time Check-ins",
      value: String(analytics.snapshot?.performanceKpis.checkIns ?? 0),
    },
    {
      icon: Sparkles,
      label: "Completed Coaching Sessions",
      value: String(analytics.snapshot?.performanceKpis.coachingSessions ?? 0),
    },
  ];

  const liveAlertLaneLabel = `${systemAlerts.length} live alert lane${systemAlerts.length === 1 ? "" : "s"}`;
  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={fadeIn}
    >
      {analytics.message ? (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <FitText
            style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}
          >
            {analytics.message}
          </FitText>
        </div>
      ) : null}

      <div className="analytics-shell" style={{ display: "grid", gap: 12 }}>
        {shouldShowSection("insights") ? (
        <div id="analytics-insights" className="analytics-anchor-section">
          <FitSection
            heading="AI Insights"
            bare
            action={
              analytics.generatedAtLabel ? (
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  Updated {analytics.generatedAtLabel}
                </FitText>
              ) : null
            }
          >
            <div
              className="analytics-ai-panel"
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${colors.surfaceRaised}, ${colors.surface})`,
                padding: 18,
                display: "grid",
                gap: 14,
              }}
            >
              <div
                className="analytics-ai-command-row"
                style={{ borderBottom: `1px solid ${colors.border}` }}
              >
                <div className="analytics-inline-icon-row" style={{ gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: `${colors.brand}18`,
                      color: colors.brand,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div style={{ display: "grid", gap: 3 }}>
                    <FitText
                      as="p"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: colors.textMuted,
                        fontWeight: 800,
                      }}
                    >
                      Admin Priority
                    </FitText>
                    <FitText as="p" style={{ fontSize: 17, fontWeight: 800 }}>
                      Generate a fresh analytics readout or export the full
                      report.
                    </FitText>
                  </div>
                </div>
                <div className="analytics-action-buttons">
                  <FitButton
                    variant="primary"
                    icon={Sparkles}
                    label={
                      analytics.isGeneratingInsight
                        ? "GENERATING AI INSIGHT..."
                        : "GENERATE AI INSIGHTS"
                    }
                    onClick={() => {
                      void analytics.handleGenerateInsight();
                    }}
                    disabled={analytics.isGeneratingInsight}
                  />
                  <FitButton
                    variant="ghost"
                    icon={Download}
                    label={
                      analytics.isExportingPdf
                        ? "PREPARING PDF..."
                        : "EXPORT PDF"
                    }
                    onClick={() => {
                      void analytics.handleExportPdf();
                    }}
                    disabled={analytics.isExportingPdf}
                  />
                </div>
              </div>

              <div
                className="analytics-ai-summary-row"
                style={{
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <div
                  className="analytics-inline-icon-row"
                  style={{ alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: `${colors.brand}15`,
                      color: colors.brand,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText as="p" style={{ fontSize: 14, fontWeight: 800 }}>
                      Latest AI Insight
                    </FitText>
                    <FitText
                      as="p"
                      style={{ fontSize: 12, color: colors.textMuted }}
                    >
                      {analytics.latestInsight
                        ? formatDateTime(analytics.latestInsight.createdAt)
                        : "No generated insight yet"}
                    </FitText>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  {analytics.latestInsightIsFallback ? (
                    <FitText
                      as="p"
                      style={{
                        fontSize: 11,
                        color: colors.warning,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Fallback grounded insight
                    </FitText>
                  ) : null}
                  {analytics.latestInsight ? (
                    <FitText
                      as="p"
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        lineHeight: 1.45,
                      }}
                    >
                      Generated insight windows can differ from the live tiles
                      below.
                    </FitText>
                  ) : null}
                  <FitText
                    as="p"
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: colors.textPrimary,
                    }}
                  >
                    {analytics.latestInsightLoading
                      ? "Loading the latest business insight..."
                      : (analytics.latestInsight?.summary ??
                        "No generated insight yet. Use Generate AI Insights to create a fresh business readout.")}
                  </FitText>
                </div>
              </div>

              {latestRecommendedActions.length ? (
                <div className="analytics-recommendation-grid">
                  {latestRecommendedActions.slice(0, 3).map((action) => (
                    <div
                      key={action}
                      className="analytics-inline-icon-row"
                      style={{
                        gap: 8,
                        alignItems: "flex-start",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        padding: 10,
                      }}
                    >
                      <ArrowUpRight
                        size={13}
                        color={colors.brand}
                        style={{ marginTop: 2 }}
                      />
                      <FitText
                        as="p"
                        style={{
                          fontSize: 12,
                          color: colors.textMuted,
                          lineHeight: 1.45,
                        }}
                      >
                        {action}
                      </FitText>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </FitSection>
        </div>
        ) : null}

        {shouldShowSection("alerts") ? (
        <div id="analytics-alerts" className="analytics-operations-stack">
          <FitSection
            heading="System Alerts"
            bare
            action={
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                {liveAlertLaneLabel}
              </FitText>
            }
          >
            <div className="analytics-alert-grid">
              {systemAlerts.length ? (
                systemAlerts.map((alert, index) => {
                  const Icon = getAlertIcon(alert.kind);

                  return (
                    <div
                      key={alert.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(alert.href)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(alert.href);
                        }
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px minmax(0, 1fr)",
                        gap: 10,
                        alignItems: "start",
                        padding: 14,
                        cursor: "pointer",
                        background:
                          index % 2 === 0
                            ? `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`
                            : colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: `${colors.warning}18`,
                          color: colors.warning,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                        <FitText
                          as="p"
                          style={{
                              fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: colors.textMuted,
                          }}
                        >
                          {getAlertLaneLabel(alert.kind)}
                        </FitText>
                        <FitText
                          as="p"
                          style={{ fontSize: 14, fontWeight: 800 }}
                        >
                          {alert.title}
                        </FitText>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                              lineHeight: 1.4,
                          }}
                        >
                          {alert.body}
                        </FitText>
                      </div>
                      <div
                        style={{
                          borderRadius: 10,
                          padding: "8px 12px",
                          backgroundColor: `${colors.surfaceRaised}`,
                          border: `1px solid ${colors.border}`,
                          fontSize: 12,
                          fontWeight: 800,
                          color: colors.textPrimary,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          gridColumn: "2",
                          justifySelf: "start",
                        }}
                      >
                        {alert.actionLabel}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 24 }}>
                  <FitText
                    as="p"
                    style={{
                      fontSize: 14,
                      color: colors.textMuted,
                      lineHeight: 1.7,
                    }}
                  >
                    No system alerts are active right now.
                  </FitText>
                </div>
              )}
            </div>
          </FitSection>

        </div>
        ) : null}

        {shouldShowSection("daily") ? (
        <div id="analytics-daily" className="analytics-anchor-section">
          <FitSection heading="Daily Insights" bare>
          <div className="analytics-card-grid analytics-card-grid--three">
            {dailyInsightCards.map((card) => (
              <div
                key={card.label}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 16,
                  background: `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`,
                  padding: 15,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: `${colors.brand}18`,
                    color: colors.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <card.icon size={18} />
                </div>
                <div>
                  <FitText
                    as="p"
                    style={{ fontSize: 12, color: colors.textMuted }}
                  >
                    {card.label}
                  </FitText>
                  <FitText
                    as="p"
                    style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}
                  >
                    {analytics.snapshotLoading ? "--" : card.value}
                  </FitText>
                </div>
                <FitText
                  as="p"
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    lineHeight: 1.55,
                  }}
                >
                  {card.helper}
                </FitText>
              </div>
            ))}
          </div>
          </FitSection>
        </div>
        ) : null}

        {shouldShowSection("kpis") ? (
        <div id="analytics-kpis" className="analytics-anchor-section">
          <FitSection heading="Performance KPIs" bare>
            <div style={{ marginBottom: 10 }}>
              <FitText
                as="p"
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  lineHeight: 1.5,
                }}
              >
                These KPI cards are all-time business totals. They do not use
                the same window as the revenue chart or generated insight panel
                below.
              </FitText>
            </div>
            <div className="analytics-card-grid analytics-card-grid--three">
              {performanceKpis.map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    className="analytics-inline-icon-row"
                    style={{ gap: 10 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        backgroundColor: colors.surfaceRaised,
                        color: colors.brand,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <kpi.icon size={16} />
                    </div>
                    <FitText
                      as="p"
                      style={{ fontSize: 12, color: colors.textMuted }}
                    >
                      {kpi.label}
                    </FitText>
                  </div>
                  <FitText as="p" style={{ fontSize: 22, fontWeight: 800 }}>
                    {analytics.snapshotLoading ? "--" : kpi.value}
                  </FitText>
                </div>
              ))}
            </div>
          </FitSection>
        </div>
        ) : null}

        {shouldShowSection("revenue") ? (
        <div id="analytics-revenue" className="analytics-anchor-section">
          <FitSection heading="Revenue" bare>
          <div className="analytics-revenue-grid">
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${colors.brand}12, ${colors.surface})`,
                padding: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div
                className="analytics-section-action"
                style={{ justifyContent: "space-between" }}
              >
                <FitText
                  as="p"
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                  }}
                >
                  {analytics.revenueWindow.label}
                </FitText>
                <FitSelect
                  compact
                  value={analytics.revenueWindowFilter}
                  onChange={(event) =>
                    analytics.setRevenueWindowFilter(
                      event.target
                        .value as typeof analytics.revenueWindowFilter,
                    )
                  }
                  options={[...analytics.revenueWindowFilterOptions]}
                  name="analyticsRevenueWindow"
                />
              </div>
              <div
                className="analytics-section-action"
                style={{ justifyContent: "space-between" }}
              >
                <FitText
                  as="p"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: colors.textMuted,
                  }}
                >
                  {selectedRevenueLabel}
                </FitText>
                <FitSelect
                  compact
                  value={revenueSourceFilter}
                  onChange={(event) =>
                    setRevenueSourceFilter(
                      event.target.value as RevenueSourceFilter,
                    )
                  }
                  options={[...REVENUE_SOURCE_FILTER_OPTIONS]}
                  name="analyticsRevenueSource"
                />
              </div>
              <FitText as="p" style={{ fontSize: 28, fontWeight: 800 }}>
                {analytics.revenueLoading
                  ? "--"
                  : formatFullMoney(selectedRevenueValue)}
              </FitText>
              <FitText
                as="p"
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.55,
                }}
              >
                {selectedRevenueDescription}
              </FitText>
            </div>

            <FitSection
              heading="Top Revenue Sources"
              bare
              action={
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  {analytics.revenueWindow.label}
                </FitText>
              }
            >
              <div className="analytics-revenue-chart">
                <div
                  style={{
                    minWidth: 0,
                    height: 250,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    padding: 14,
                  }}
                >
                  <FitText
                    as="p"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: colors.textMuted,
                      marginBottom: 12,
                    }}
                  >
                    {selectedRevenueLabel} trend
                  </FitText>
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={1}
                    minHeight={1}
                    initialDimension={{ width: 680, height: 210 }}
                  >
                    <BarChart data={analytics.revenueSeries}>
                      <CartesianGrid
                        stroke={`${colors.border}88`}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="bucket"
                        stroke={colors.textMuted}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke={colors.textMuted}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: colors.surface,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 12,
                        }}
                      />
                      <Bar
                        dataKey={selectedRevenueSeriesKey}
                        fill={colors.brand}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="analytics-source-list">
                  <FitText
                    as="p"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: colors.textMuted,
                    }}
                  >
                    Revenue mix
                  </FitText>
                  <FitText
                    as="p"
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      lineHeight: 1.6,
                    }}
                  >
                    Ranked across the selected window using all recorded
                    business revenue sources.
                  </FitText>
                  {topRevenueSources.length ? (
                    <div className="analytics-source-card-grid">
                      {topRevenueSources.map((source) => (
                        <div
                          key={source.sourceKey}
                          className="analytics-source-card"
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            backgroundColor: colors.surface,
                            padding: 12,
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <FitText
                            as="p"
                            style={{ fontSize: 13, fontWeight: 700 }}
                          >
                            {source.sourceLabel}
                          </FitText>
                          <FitText
                            as="p"
                            style={{ fontSize: 12, color: colors.textMuted }}
                          >
                            {source.sharePercentage.toFixed(1)}% of revenue
                          </FitText>
                          <FitText
                            as="p"
                            style={{ fontSize: 16, fontWeight: 700 }}
                          >
                            {formatCompactMoney(source.revenue)}
                          </FitText>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: `1px dashed ${colors.border}`,
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <FitText
                        as="p"
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          lineHeight: 1.7,
                        }}
                      >
                        No revenue-source mix is available for the selected
                        window yet.
                      </FitText>
                    </div>
                  )}
                </div>
              </div>
            </FitSection>
          </div>
          </FitSection>
        </div>
        ) : null}

        {shouldShowSection("attendance") ? (
        <div id="analytics-attendance" className="analytics-anchor-section">
          <FitSection
          heading="Attendance"
          bare
          action={
            <div className="analytics-filter-row">
              {ANALYTICS_ATTENDANCE_FILTER_OPTIONS.map((option) => (
                <FitButton
                  key={option.value}
                  variant="chip"
                  active={analytics.attendanceFilter === option.value}
                  label={option.label}
                  onClick={() => analytics.setAttendanceFilter(option.value)}
                />
              ))}
            </div>
          }
        >
          <div className="analytics-attendance-grid">
            <FitChartContainer
              heading="Attendance Trend"
              subtitle={analytics.attendanceFilterLabel}
              sectionClassName="mb-0"
              chartStyle={{ height: 260 }}
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 720, height: 260 }}
            >
              <BarChart data={analytics.attendanceSeries}>
                <CartesianGrid
                  stroke={`${colors.border}88`}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={colors.textMuted}
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                  }}
                />
                <Bar
                  dataKey="checkIns"
                  fill={colors.brand}
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(_data, index) => {
                    const entry = analytics.attendanceSeries[index];
                    if (!entry?.bucketStart || !entry.label) return;
                    analytics.handleSelectAttendancePoint(
                      entry.bucketStart,
                      entry.label,
                    );
                  }}
                />
              </BarChart>
            </FitChartContainer>

            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                backgroundColor: colors.surface,
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <FitText
                  as="p"
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Total Check-ins
                </FitText>
                <FitText
                  as="p"
                  style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}
                >
                  {analytics.attendanceLoading
                    ? "--"
                    : (analytics.attendance?.totalCheckIns ?? 0)}
                </FitText>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div className="analytics-inline-icon-row" style={{ gap: 10 }}>
                  <AlertTriangle size={16} color={colors.warning} />
                  <FitText as="p" style={{ fontSize: 13, fontWeight: 700 }}>
                    Daily Peak Hours
                  </FitText>
                </div>
                <div className="analytics-peak-grid">
                  {(analytics.attendance?.peakHours ?? []).map((peak) => (
                    <button
                      key={peak.hourLabel}
                      type="button"
                      onClick={() => {
                        const fallbackBucket =
                          analytics.attendanceSeries[
                            analytics.attendanceSeries.length - 1
                          ];
                        analytics.handleSelectAttendancePoint(
                          fallbackBucket?.bucketStart ??
                            analytics.attendance?.series[0]?.bucketStart ??
                            new Date().toISOString(),
                          `${peak.hourLabel} peak hour`,
                        );
                      }}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        backgroundColor: colors.surfaceRaised,
                        padding: 10,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <FitText
                        as="p"
                        style={{ fontSize: 12, color: colors.textMuted }}
                      >
                        {peak.hourLabel}
                      </FitText>
                      <FitText
                        as="p"
                        style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}
                      >
                        {peak.checkIns}
                      </FitText>
                    </button>
                  ))}
                </div>
                <FitText
                  as="p"
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    lineHeight: 1.55,
                  }}
                >
                  Click a bar or peak-hour figure to open the detailed
                  attendance breakdown for that time slice.
                </FitText>
              </div>
            </div>
          </div>
          </FitSection>
        </div>
        ) : null}
      </div>

      <FitModal
        isOpen={Boolean(analytics.selectedDrilldown)}
        onClose={analytics.handleCloseDrilldown}
        title={analytics.drilldownTitle}
        subtitle={analytics.drilldownSubtitle}
        maxWidth={960}
      >
        <div className="analytics-modal-grid">
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              backgroundColor: colors.surface,
              padding: 18,
              minHeight: 320,
            }}
          >
            {analytics.drilldownAttendance &&
            analytics.drilldownSeries.length ? (
              <div style={{ height: 320 }}>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={1}
                  minHeight={1}
                  initialDimension={{ width: 560, height: 320 }}
                >
                  <BarChart data={analytics.drilldownSeries}>
                    <CartesianGrid
                      stroke={`${colors.border}88`}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke={colors.textMuted}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                      }}
                    />
                    <Bar
                      dataKey="checkIns"
                      fill={colors.brand}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                style={{
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                }}
              >
                <div style={{ maxWidth: 360 }}>
                  <FitText as="p" style={{ fontSize: 18, fontWeight: 700 }}>
                    {analytics.selectedDrilldown?.label ??
                      "Selected attendance slice"}
                  </FitText>
                  <FitText
                    as="p"
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      lineHeight: 1.7,
                      marginTop: 8,
                    }}
                  >
                    {analytics.drilldownLoading
                      ? "Loading the attendance breakdown..."
                      : "This attendance point is already at the lowest available level for the selected filter."}
                  </FitText>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              backgroundColor: colors.surface,
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                Selected Slice
              </FitText>
              <FitText
                as="p"
                style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}
              >
                {analytics.selectedDrilldown?.label ?? "--"}
              </FitText>
            </div>
            <div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                Check-ins in View
              </FitText>
              <FitText
                as="p"
                style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}
              >
                {analytics.drilldownAttendance?.totalCheckIns ??
                  analytics.attendance?.totalCheckIns ??
                  0}
              </FitText>
            </div>
            <div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                Peak Hour Signals
              </FitText>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {(
                  analytics.drilldownAttendance?.peakHours ??
                  analytics.attendance?.peakHours ??
                  []
                ).map((peak) => (
                  <div
                    key={peak.hourLabel}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: colors.surfaceRaised,
                    }}
                  >
                    <FitText
                      as="p"
                      style={{ fontSize: 12, color: colors.textMuted }}
                    >
                      {peak.hourLabel}
                    </FitText>
                    <FitText
                      as="p"
                      style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}
                    >
                      {peak.checkIns} check-ins
                    </FitText>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FitModal>

      <style>{`
        .analytics-shell {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 28px;
        }

        .analytics-anchor-section {
          scroll-margin-top: 112px;
        }

        .analytics-ai-panel {
          min-width: 0;
        }

        .analytics-ai-command-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          padding-bottom: 14px;
        }

        .analytics-ai-summary-row {
          display: grid;
          grid-template-columns: minmax(220px, 0.4fr) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
          border-radius: 14px;
          padding: 14px;
        }

        .analytics-card-grid {
          display: grid;
          gap: 12px;
        }

        .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .analytics-alert-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .analytics-recommendation-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .analytics-revenue-grid,
        .analytics-attendance-grid,
        .analytics-modal-grid {
          display: grid;
          gap: 12px;
          align-items: start;
        }

        .analytics-revenue-grid,
        .analytics-modal-grid {
          grid-template-columns: minmax(0, 1fr) minmax(300px, 0.72fr);
        }

        .analytics-revenue-grid {
          grid-template-columns: minmax(260px, 0.48fr) minmax(0, 1.52fr);
          align-items: start;
        }

        .analytics-operations-stack {
          display: grid;
          gap: 12px;
        }

        .analytics-revenue-chart {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 0.45fr);
          gap: 12px;
          align-items: start;
        }

        .analytics-source-list {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .analytics-source-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .analytics-source-card {
          min-width: 0;
        }

        .analytics-attendance-grid {
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.75fr);
          align-items: start;
        }

        .analytics-filter-row,
        .analytics-action-buttons,
        .analytics-peak-grid,
        .analytics-inline-icon-row {
          display: flex;
          flex-wrap: wrap;
        }

        .analytics-section-action {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
        }

        .analytics-filter-row,
        .analytics-action-buttons,
        .analytics-peak-grid {
          gap: 8px;
        }

        .analytics-action-buttons {
          align-items: center;
        }

        .analytics-inline-icon-row {
          gap: 12px;
          align-items: center;
        }

        .analytics-peak-grid > button {
          flex: 1 1 120px;
        }

        .analytics-activity-head,
        .analytics-activity-row {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(320px, 1.3fr) minmax(180px, 0.85fr) auto;
          gap: 18px;
          padding: 18px 22px;
        }

        .analytics-activity-row {
          align-items: start;
          background: linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0));
        }

        @media (max-width: 1180px) {
          .analytics-card-grid--three,
          .analytics-alert-grid,
          .analytics-ai-summary-row,
          .analytics-recommendation-grid,
          .analytics-revenue-grid,
          .analytics-attendance-grid,
          .analytics-revenue-chart,
          .analytics-modal-grid {
            grid-template-columns: 1fr;
          }

          .analytics-source-card-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .analytics-ai-command-row {
            align-items: flex-start;
          }

          .analytics-card-grid--three {
            grid-template-columns: 1fr;
          }

          .analytics-activity-head {
            display: none;
          }

          .analytics-activity-row {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .analytics-section-action {
            justify-content: flex-start;
          }
        }
      `}</style>
    </FitSection>
  );
}
