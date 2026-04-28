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
  Wrench
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AnalyticsRecentActivityRecord, IThemeContext } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  ANALYTICS_ATTENDANCE_FILTER_OPTIONS,
  formatCompactMoney,
  formatDateTime,
  formatFullMoney
} from "@/app/(admin)/analytics/helpers";
import { FitButton, FitChartContainer, FitSection, FitSelect, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useAnalyticsDashboard } from "../../hooks/analytics/useAnalyticsDashboard";

type RecentActivityFilter = "all" | "bookings" | "checkins";

const RECENT_ACTIVITY_FILTER_OPTIONS = [
  { label: "All Activities", value: "all" },
  { label: "Check-ins", value: "checkins" },
  { label: "Bookings", value: "bookings" }
] as const;

function formatStatusLabel(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAlertIcon(kind: string) {
  if (kind === "maintenance_due") return Wrench;
  return PackageSearch;
}

function getAlertLaneLabel(kind: string) {
  return kind === "maintenance_due" ? "Equipment warning" : "Inventory warning";
}

function getActivityIcon(kind: string) {
  switch (kind) {
    case "booking":
      return CalendarClock;
    case "coaching":
      return TrendingUp;
    case "sale":
      return BarChart3;
    default:
      return Users;
  }
}

function getActivityAccent(kind: string, colors: IThemeContext["colors"]) {
  switch (kind) {
    case "booking":
      return colors.textSecondary;
    case "coaching":
      return colors.brand;
    case "sale":
      return colors.success;
    default:
      return colors.warning;
  }
}

function formatRelativeTime(value: string) {
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) return "Unknown";

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < -60_000) {
    return formatDateTime(value);
  }

  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60_000));
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `${deltaDays}d ago`;

  return formatDateTime(value);
}

function getRecentActivityAction(activity: AnalyticsRecentActivityRecord) {
  switch (activity.kind) {
    case "attendance":
      return "Checked in";
    case "booking":
      return activity.status === "cancelled" ? "Booking updated" : "Booked venue";
    case "coaching":
      return "Coaching activity";
    case "sale":
      return "Retail sale";
    default:
      return activity.title;
  }
}

export function AnalyticsDashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const analytics = useAnalyticsDashboard();
  const [recentActivityFilter, setRecentActivityFilter] =
    useState<RecentActivityFilter>("all");

  const systemAlerts = analytics.snapshot?.systemAlerts ?? [];
  const recentActivities = useMemo(
    () => analytics.snapshot?.recentActivities ?? [],
    [analytics.snapshot?.recentActivities]
  );
  const filteredRecentActivities = useMemo(() => {
    if (recentActivityFilter === "checkins") {
      return recentActivities.filter((activity) => activity.kind === "attendance");
    }

    if (recentActivityFilter === "bookings") {
      return recentActivities.filter((activity) => activity.kind === "booking");
    }

    return recentActivities;
  }, [recentActivities, recentActivityFilter]);
  const recentActivityLaneLabel = `${filteredRecentActivities.length} activity lane${filteredRecentActivities.length === 1 ? "" : "s"}`;

  const dailyInsightCards = [
    {
      label: "Active Members",
      value: analytics.visibleActiveMemberCount,
      helper: "Accounts with active member access right now.",
      icon: Users
    },
    {
      label: "Sessions Today",
      value: analytics.snapshot?.dailyInsights.sessionsToday ?? 0,
      helper: "Check-ins recorded since midnight.",
      icon: Clock3
    },
    {
      label: "Recent Activities",
      value: analytics.snapshot?.dailyInsights.recentActivities ?? 0,
      helper: "Operational events captured in the last 24 hours.",
      icon: TrendingUp
    }
  ];

  const performanceKpis = [
    {
      icon: BarChart3,
      label: "Total Revenue",
      value: formatCompactMoney(
        analytics.snapshot?.performanceKpis.totalRevenue ?? 0
      )
    },
    {
      icon: CalendarClock,
      label: "Total Venue Bookings",
      value: String(analytics.snapshot?.performanceKpis.totalVenueBookings ?? 0)
    },
    {
      icon: TrendingUp,
      label: "Total Coaching Appointments",
      value: String(
        analytics.snapshot?.performanceKpis.totalCoachingAppointments ?? 0
      )
    },
    {
      icon: Users,
      label: "New Members",
      value: String(analytics.snapshot?.performanceKpis.newMembers ?? 0)
    },
    {
      icon: Clock3,
      label: "Check-ins",
      value: String(analytics.snapshot?.performanceKpis.checkIns ?? 0)
    },
    {
      icon: Sparkles,
      label: "Coaching Sessions",
      value: String(analytics.snapshot?.performanceKpis.coachingSessions ?? 0)
    }
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
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>
            {analytics.message}
          </FitText>
        </div>
      ) : null}

      <div className="analytics-shell" style={{ display: "grid", gap: 18 }}>
        <FitSection
          heading="Generate Insights & Export PDF"
          action={
            analytics.generatedAtLabel ? (
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Updated {analytics.generatedAtLabel}
              </FitText>
            ) : null
          }
        >
          <div className="analytics-priority-grid">
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 24,
                background: `linear-gradient(135deg, ${colors.surfaceRaised}, ${colors.surface})`,
                padding: 24,
                display: "grid",
                gap: 18
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div className="analytics-inline-icon-row">
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      backgroundColor: `${colors.brand}18`,
                      color: colors.brand,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText
                      as="p"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: colors.textMuted,
                        fontWeight: 700
                      }}
                    >
                      Admin Priority
                    </FitText>
                    <FitText as="p" style={{ fontSize: 22, fontWeight: 800 }}>
                      Generate a fresh analytics readout or export the full report.
                    </FitText>
                  </div>
                </div>
                <FitText
                  as="p"
                  style={{
                    fontSize: 14,
                    color: colors.textMuted,
                    lineHeight: 1.75,
                    maxWidth: 640
                  }}
                >
                  Use this top lane for the fastest admin workflow: generate a live AI
                  summary for the current analytics state, or export the full report as
                  a print-ready PDF with AI observations after each major section.
                </FitText>
              </div>

              <div className="analytics-action-buttons">
                <FitButton
                  variant="primary"
                  icon={Sparkles}
                  label={
                    analytics.isGeneratingInsight
                      ? "GENERATING INSIGHT..."
                      : "GENERATE INSIGHTS"
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
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 24,
                background: `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`,
                padding: 24,
                display: "grid",
                gap: 16
              }}
            >
              <div className="analytics-inline-icon-row" style={{ alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: `${colors.brand}15`,
                    color: colors.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <Bot size={18} />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText as="p" style={{ fontSize: 16, fontWeight: 800 }}>
                    Latest AI Insight
                  </FitText>
                  <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                    {analytics.latestInsight
                      ? formatDateTime(analytics.latestInsight.createdAt)
                      : "No generated insight yet"}
                  </FitText>
                  {analytics.latestInsight ? (
                    <FitText as="p" style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5 }}>
                      Generated insight windows can differ from the live tiles below.
                    </FitText>
                  ) : null}
                </div>
              </div>

              <FitText
                as="p"
                style={{
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: colors.textPrimary
                }}
              >
                {analytics.latestInsightLoading
                  ? "Loading the latest business insight..."
                  : analytics.latestInsight?.summary ??
                    "No generated insight yet. Use Generate Insights to create a fresh business readout."}
              </FitText>

              {analytics.latestInsight?.recommendedActions.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {analytics.latestInsight.recommendedActions.slice(0, 3).map((action) => (
                    <div key={action} className="analytics-inline-icon-row" style={{ gap: 10 }}>
                      <ArrowUpRight size={14} color={colors.brand} style={{ marginTop: 2 }} />
                      <FitText
                        as="p"
                        style={{
                          fontSize: 13,
                          color: colors.textMuted,
                          lineHeight: 1.7
                        }}
                      >
                        {action}
                      </FitText>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </FitSection>

        <div className="analytics-operations-stack">
          <FitSection
            heading="System Alerts"
            action={
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                {liveAlertLaneLabel}
              </FitText>
            }
          >
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 22,
                backgroundColor: colors.surface,
                overflow: "hidden"
              }}
            >
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
                        gridTemplateColumns: "64px minmax(0, 1fr) auto",
                        gap: 20,
                        alignItems: "center",
                        padding: "24px 22px",
                        cursor: "pointer",
                        background:
                          index % 2 === 0
                            ? `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`
                            : colors.surface,
                        borderBottom:
                          index < systemAlerts.length - 1
                            ? `1px solid ${colors.border}`
                            : "none"
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: `${colors.warning}18`,
                          color: colors.warning,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: colors.textMuted
                          }}
                        >
                          {getAlertLaneLabel(alert.kind)}
                        </FitText>
                        <FitText as="p" style={{ fontSize: 18, fontWeight: 800 }}>
                          {alert.title}
                        </FitText>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 14,
                            color: colors.textMuted,
                            lineHeight: 1.7
                          }}
                        >
                          {alert.body}
                        </FitText>
                      </div>
                      <div
                        style={{
                          borderRadius: 16,
                          padding: "13px 18px",
                          backgroundColor: `${colors.surfaceRaised}`,
                          border: `1px solid ${colors.border}`,
                          fontSize: 12,
                          fontWeight: 800,
                          color: colors.textPrimary,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {alert.actionLabel}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 24 }}>
                  <FitText as="p" style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.7 }}>
                    No system alerts are active right now.
                  </FitText>
                </div>
              )}
            </div>
          </FitSection>

          <FitSection
            heading="Recent Activity"
            action={
              <div className="analytics-section-action">
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  {recentActivityLaneLabel}
                </FitText>
                <FitSelect
                  compact
                  value={recentActivityFilter}
                  onChange={(event) => setRecentActivityFilter(event.target.value as RecentActivityFilter)}
                  options={[...RECENT_ACTIVITY_FILTER_OPTIONS]}
                />
              </div>
            }
          >
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 22,
                backgroundColor: colors.surface,
                overflow: "hidden"
              }}
            >
              <div
                className="analytics-activity-head"
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised
                }}
              >
                <FitText as="span" style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                  MEMBER
                </FitText>
                <FitText as="span" style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                  ACTION
                </FitText>
                <FitText as="span" style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                  TIME
                </FitText>
                <FitText as="span" style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>
                  STATUS
                </FitText>
              </div>

              {filteredRecentActivities.length ? (
                filteredRecentActivities.map((activity, index) => {
                  const accent = getActivityAccent(activity.kind, colors);
                  const Icon = getActivityIcon(activity.kind);

                  return (
                    <div
                      key={activity.id}
                      className="analytics-activity-row"
                      style={{
                        borderBottom:
                          index < filteredRecentActivities.length - 1
                            ? `1px solid ${colors.border}`
                            : "none"
                      }}
                    >
                      <div className="analytics-inline-icon-row" style={{ gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: `${accent}18`,
                            color: accent,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                          <FitText as="p" style={{ fontSize: 15, fontWeight: 700 }}>
                            {activity.actorName}
                          </FitText>
                          <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                            {activity.entityLabel}
                          </FitText>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                        <FitText as="p" style={{ fontSize: 15, fontWeight: 700 }}>
                          {getRecentActivityAction(activity)}
                        </FitText>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                            lineHeight: 1.6
                          }}
                        >
                          {activity.description}
                        </FitText>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <FitText as="p" style={{ fontSize: 15, fontWeight: 700 }}>
                          {formatRelativeTime(activity.occurredAt)}
                        </FitText>
                        <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                          {formatDateTime(activity.occurredAt)}
                        </FitText>
                      </div>

                      <div
                        style={{
                          justifySelf: "end",
                          borderRadius: 999,
                          padding: "6px 12px",
                          backgroundColor: `${accent}18`,
                          color: accent,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {formatStatusLabel(activity.status)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 24 }}>
                  <FitText as="p" style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.7 }}>
                    No activities match this filter right now.
                  </FitText>
                </div>
              )}
            </div>
          </FitSection>
        </div>

        <FitSection heading="Daily Insights">
          <div className="analytics-card-grid analytics-card-grid--three">
            {dailyInsightCards.map((card) => (
              <div
                key={card.label}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 22,
                  background: `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`,
                  padding: 18,
                  display: "grid",
                  gap: 14
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: `${colors.brand}18`,
                    color: colors.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <card.icon size={18} />
                </div>
                <div>
                  <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                    {card.label}
                  </FitText>
                  <FitText as="p" style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>
                    {analytics.snapshotLoading ? "--" : card.value}
                  </FitText>
                </div>
                <FitText
                  as="p"
                  style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.65 }}
                >
                  {card.helper}
                </FitText>
              </div>
            ))}
          </div>
        </FitSection>

        <FitSection heading="Performance KPIs">
          <div className="analytics-card-grid analytics-card-grid--three">
            {performanceKpis.map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  padding: 18,
                  display: "grid",
                  gap: 10
                }}
              >
                <div className="analytics-inline-icon-row" style={{ gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceRaised,
                      color: colors.brand,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <kpi.icon size={16} />
                  </div>
                  <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                    {kpi.label}
                  </FitText>
                </div>
                <FitText as="p" style={{ fontSize: 26, fontWeight: 800 }}>
                  {analytics.snapshotLoading ? "--" : kpi.value}
                </FitText>
              </div>
            ))}
          </div>
        </FitSection>

        <FitSection heading="Revenue">
          <div className="analytics-revenue-grid">
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${colors.brand}12, ${colors.surface})`,
                padding: 22,
                display: "grid",
                gap: 10
              }}
            >
              <FitText
                as="p"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: colors.textMuted
                }}
              >
                Total Generated Revenue
              </FitText>
              <FitText as="p" style={{ fontSize: 34, fontWeight: 800 }}>
                {analytics.revenueLoading
                  ? "--"
                  : formatFullMoney(analytics.revenue?.totals.totalRevenue ?? 0)}
              </FitText>
              <FitText
                as="p"
                style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.7 }}
              >
                Revenue is aggregated from completed membership, booking, coaching,
                and retail payment activity.
              </FitText>
            </div>

            <FitChartContainer
              heading="Top Revenue Sources"
              subtitle="Last 6 months"
              sectionClassName="mb-0"
              chartStyle={{ height: 280 }}
            >
              <div className="analytics-revenue-chart">
                <div style={{ flex: 1, minWidth: 0, height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueSeries}>
                      <CartesianGrid stroke={`${colors.border}88`} vertical={false} />
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
                          borderRadius: 12
                        }}
                      />
                      <Bar
                        dataKey="totalRevenue"
                        fill={colors.brand}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="analytics-source-list">
                  {(analytics.revenue?.topRevenueSources ?? []).map((source) => (
                    <div
                      key={source.sourceKey}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        backgroundColor: colors.surface,
                        padding: 14,
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <FitText as="p" style={{ fontSize: 13, fontWeight: 700 }}>
                        {source.sourceLabel}
                      </FitText>
                      <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                        {source.sharePercentage.toFixed(1)}% of revenue
                      </FitText>
                      <FitText as="p" style={{ fontSize: 16, fontWeight: 700 }}>
                        {formatCompactMoney(source.revenue)}
                      </FitText>
                    </div>
                  ))}
                </div>
              </div>
            </FitChartContainer>
          </div>
        </FitSection>

        <FitSection
          heading="Attendance"
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
              chartStyle={{ height: 320 }}
            >
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.attendanceSeries}>
                    <CartesianGrid stroke={`${colors.border}88`} vertical={false} />
                    <XAxis
                      dataKey="label"
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
                        borderRadius: 12
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
                          entry.label
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FitChartContainer>

            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 20,
                backgroundColor: colors.surface,
                padding: 18,
                display: "grid",
                gap: 16
              }}
            >
              <div>
                <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                  Total Check-ins
                </FitText>
                <FitText as="p" style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>
                  {analytics.attendanceLoading
                    ? "--"
                    : analytics.attendance?.totalCheckIns ?? 0}
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
                          analytics.attendanceSeries[analytics.attendanceSeries.length - 1];
                        analytics.handleSelectAttendancePoint(
                          fallbackBucket?.bucketStart ??
                            analytics.attendance?.series[0]?.bucketStart ??
                            new Date().toISOString(),
                          `${peak.hourLabel} peak hour`
                        );
                      }}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        backgroundColor: colors.surfaceRaised,
                        padding: 12,
                        textAlign: "left",
                        cursor: "pointer"
                      }}
                    >
                      <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                        {peak.hourLabel}
                      </FitText>
                      <FitText as="p" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                        {peak.checkIns}
                      </FitText>
                    </button>
                  ))}
                </div>
                <FitText
                  as="p"
                  style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.7 }}
                >
                  Click a bar or peak-hour figure to open the detailed attendance
                  breakdown for that time slice.
                </FitText>
              </div>
            </div>
          </div>
        </FitSection>
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
              minHeight: 320
            }}
          >
            {analytics.drilldownAttendance && analytics.drilldownSeries.length ? (
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.drilldownSeries}>
                    <CartesianGrid stroke={`${colors.border}88`} vertical={false} />
                    <XAxis
                      dataKey="label"
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
                        borderRadius: 12
                      }}
                    />
                    <Bar dataKey="checkIns" fill={colors.brand} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                style={{
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center"
                }}
              >
                <div style={{ maxWidth: 360 }}>
                  <FitText as="p" style={{ fontSize: 18, fontWeight: 700 }}>
                    {analytics.selectedDrilldown?.label ?? "Selected attendance slice"}
                  </FitText>
                  <FitText
                    as="p"
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      lineHeight: 1.7,
                      marginTop: 8
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
              gap: 14
            }}
          >
            <div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                Selected Slice
              </FitText>
              <FitText as="p" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                {analytics.selectedDrilldown?.label ?? "--"}
              </FitText>
            </div>
            <div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                Check-ins in View
              </FitText>
              <FitText as="p" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
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
                {(analytics.drilldownAttendance?.peakHours ??
                  analytics.attendance?.peakHours ??
                  []
                ).map((peak) => (
                  <div
                    key={peak.hourLabel}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: colors.surfaceRaised
                    }}
                  >
                    <FitText as="p" style={{ fontSize: 12, color: colors.textMuted }}>
                      {peak.hourLabel}
                    </FitText>
                    <FitText as="p" style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>
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
          padding: 8px 0 28px;
        }

        .analytics-card-grid {
          display: grid;
          gap: 14px;
        }

        .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .analytics-priority-grid,
        .analytics-revenue-grid,
        .analytics-attendance-grid,
        .analytics-modal-grid {
          display: grid;
          gap: 16px;
        }

        .analytics-priority-grid,
        .analytics-revenue-grid,
        .analytics-modal-grid {
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.92fr);
        }

        .analytics-operations-stack {
          display: grid;
          gap: 18px;
        }

        .analytics-revenue-chart {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.8fr);
          gap: 16px;
          align-items: stretch;
        }

        .analytics-source-list {
          display: grid;
          gap: 12px;
        }

        .analytics-attendance-grid {
          grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.85fr);
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
          .analytics-priority-grid,
          .analytics-revenue-grid,
          .analytics-attendance-grid,
          .analytics-revenue-chart,
          .analytics-modal-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
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
