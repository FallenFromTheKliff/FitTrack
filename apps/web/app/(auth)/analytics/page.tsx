"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
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
import type { StaffAppointmentRecord } from "@fittrack/api-client";
import { coachScheduleQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  ANALYTICS_ATTENDANCE_FILTER_OPTIONS,
  formatCompactMoney,
  formatDateTime,
  formatFullMoney,
} from "@/app/(auth)/analytics/helpers";
import {
  FitButton,
  FitChartContainer,
  FitPill,
  FitSection,
  FitSelect,
  FitText,
} from "@/components/fit";
import { FitModal } from "@/components/modals";
import {
  ANALYTICS_SECTION_FILTER_OPTIONS,
  useAnalyticsSectionFilter,
} from "@/contexts/AnalyticsSectionFilterContext";
import { useAnalyticsDashboard } from "@/hooks/analytics/useAnalyticsDashboard";
import { webApiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

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

const ANALYTICS_PAGE_SECTION_OPTIONS = ANALYTICS_SECTION_FILTER_OPTIONS.map(
  (option) => ({
    key: option.value,
    label: option.value === "all" ? "All" : option.label,
  }),
);

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

function getAppointmentAmount(appointment: StaffAppointmentRecord) {
  const amount = Number(
    appointment.coachEarnings ??
      appointment.totalAmount ??
      (appointment.coach?.hourlyRate ?? 0) * (appointment.duration || 1),
  );
  return Number.isFinite(amount) ? amount : 0;
}

function getAppointmentGrossAmount(appointment: StaffAppointmentRecord) {
  const amount = Number(
    appointment.totalAmount ??
      (appointment.coach?.hourlyRate ?? 0) * (appointment.duration || 1),
  );
  return Number.isFinite(amount) ? amount : 0;
}

function getAppointmentMemberName(appointment: StaffAppointmentRecord) {
  const firstName = appointment.user?.profile?.firstName?.trim() ?? "";
  const lastName = appointment.user?.profile?.lastName?.trim() ?? "";
  return `${firstName} ${lastName}`.trim() || appointment.user?.email || "Member";
}

function CoachEarningsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 180 });
  const themeTransition = useThemeTransition();
  const appointmentsQuery = useQuery({
    ...coachScheduleQueryOptions<StaffAppointmentRecord>(webApiClient, user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const appointments = appointmentsQuery.data ?? [];
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === "completed",
  );
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const completedAppointmentsThisMonth = completedAppointments.filter(
    (appointment) => new Date(appointment.scheduledAt) >= monthStart,
  );
  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" &&
      appointment.status !== "completed",
  );
  const earnedTotal = completedAppointments.reduce(
    (sum, appointment) => sum + getAppointmentAmount(appointment),
    0,
  );
  const earnedThisMonth = completedAppointmentsThisMonth.reduce(
    (sum, appointment) => sum + getAppointmentAmount(appointment),
    0,
  );

  const cardStyle: CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: "grid",
    gap: 8,
    minHeight: 112,
    padding: 16,
  };

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
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {[
            {
              label: "Total Earnings This Month",
              value: formatCompactMoney(earnedThisMonth),
              helper: "Coach commission from completed sessions this month.",
            },
            {
              label: "Total Earnings All Time",
              value: formatCompactMoney(earnedTotal),
              helper: "Coach commission from all completed sessions.",
            },
            {
              label: "Completed Sessions This Month",
              value: String(completedAppointmentsThisMonth.length),
              helper: `${upcomingAppointments.length} upcoming or pending session${upcomingAppointments.length === 1 ? "" : "s"}.`,
            },
          ].map((item) => (
            <div key={item.label} style={cardStyle}>
              <FitText
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {item.label}
              </FitText>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 28,
                  fontWeight: 900,
                }}
              >
                {appointmentsQuery.isLoading ? "--" : item.value}
              </FitText>
              <FitText
                as="p"
                style={{
                  color: colors.textSecondary,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {item.helper}
              </FitText>
            </div>
          ))}
        </div>

        <div
          style={{
            ...cardStyle,
            minHeight: 0,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div>
              <FitText style={{ fontSize: 18, fontWeight: 850 }}>
                Coaching earnings
              </FitText>
              <FitText
                as="p"
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                This coach view stays scoped to your own session records.
              </FitText>
            </div>
            <FitButton
              variant="primary"
              label="OPEN SESSIONS"
              onClick={() => router.push("/schedule")}
            />
          </div>
          <div style={{ display: "grid", gap: 0, overflowX: "auto" }}>
            {completedAppointments.length > 0 ? (
              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  display: "grid",
                  gap: 0,
                  minWidth: 720,
                }}
              >
                <div
                  style={{
                    color: colors.textMuted,
                    display: "grid",
                    fontSize: 11,
                    fontWeight: 850,
                    gap: 10,
                    gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr 0.9fr 0.8fr",
                    letterSpacing: "0.06em",
                    padding: "10px 0",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Date</span>
                  <span>Member Name</span>
                  <span>Session Type</span>
                  <span>Rate</span>
                  <span>Commission</span>
                  <span>Status</span>
                </div>
                {completedAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    style={{
                      alignItems: "center",
                      borderTop: `1px solid ${colors.border}`,
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr 0.9fr 0.8fr",
                      minHeight: 48,
                      padding: "10px 0",
                    }}
                  >
                    <FitText style={{ fontSize: 12.5, fontWeight: 750 }}>
                      {new Date(appointment.scheduledAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </FitText>
                    <FitText style={{ fontSize: 12.5, fontWeight: 750 }}>
                      {getAppointmentMemberName(appointment)}
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12.5 }}>
                      {`${appointment.duration} min coaching`}
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12.5 }}>
                      {formatCompactMoney(getAppointmentGrossAmount(appointment))}
                    </FitText>
                    <FitText style={{ color: colors.brand, fontSize: 12.5, fontWeight: 900 }}>
                      {formatCompactMoney(getAppointmentAmount(appointment))}
                    </FitText>
                    <FitText
                      style={{
                        color: appointment.coachPayoutPaidAt ? colors.success : colors.warning,
                        fontSize: 12,
                        fontWeight: 850,
                      }}
                    >
                      {appointment.coachPayoutPaidAt ? "Paid" : "Pending"}
                    </FitText>
                  </div>
                ))}
              </div>
            ) : null}
            {!appointmentsQuery.isLoading && completedAppointments.length === 0 ? (
              <FitText
                as="p"
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  color: colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                  paddingTop: 14,
                }}
              >
                Completed coaching sessions will appear here after they are closed.
              </FitText>
            ) : null}
          </div>
        </div>
      </div>
    </FitSection>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();

  if (user?.role === "COACH") {
    return <CoachEarningsPage />;
  }

  return <AdminAnalyticsPage />;
}

function AdminAnalyticsPage() {
  const router = useRouter();
  const { colors, activeThemeKey } = useTheme();
  const panelRadius = 8;
  const controlRadius = 7;
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const analytics = useAnalyticsDashboard();
  const { sectionFilter, setSectionFilter, shouldShowSection } =
    useAnalyticsSectionFilter();
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
  const coachingCommissionTotal =
    analytics.revenue?.totals.coachingGymRevenue ?? 0;
  const coachingPaymentsCollected =
    analytics.revenue?.totals.coachingPaymentsCollected ?? 0;
  const coachingCommissionRate =
    coachingPaymentsCollected > 0
      ? Number(((coachingCommissionTotal / coachingPaymentsCollected) * 100).toFixed(1))
      : 0;
  const latestRecommendedActions =
    analytics.latestInsight?.recommendedActions ?? [];
  const analyticsSupportTextColor =
    activeThemeKey === "night" ? colors.textMuted : colors.textSecondary;

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
      label: "Total Active Members",
      value: String(analytics.snapshot?.performanceKpis.activeMembers ?? 0),
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
    {
      icon: TrendingUp,
      label: "Coach Commission",
      value: `${formatCompactMoney(coachingCommissionTotal)} / ${coachingCommissionRate}%`,
    },
    {
      icon: TrendingUp,
      label: "Session Completion Rate",
      value: `${analytics.snapshot?.performanceKpis.sessionCompletionRate ?? 0}%`,
    },
    {
      icon: Sparkles,
      label: "Coach Satisfaction Rating",
      value: `${analytics.snapshot?.performanceKpis.coachSatisfactionRating ?? 0}/5`,
    },
    {
      icon: BarChart3,
      label: "Venue Feedback Rating",
      value: `${analytics.snapshot?.performanceKpis.venueFeedbackRating ?? 0}/5`,
    },
    {
      icon: PackageSearch,
      label: "App Feedback Submissions",
      value: String(
        analytics.snapshot?.performanceKpis.appFeedbackSubmissions ?? 0,
      ),
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

      <div className={`analytics-shell analytics-shell--${sectionFilter}`}>
        <div
          className="analytics-section-filter"
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "flex",
            gap: 12,
            gridColumn: "1 / -1",
            justifyContent: "space-between",
            padding: "10px 12px",
          }}
        >
          <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 850 }}>
            Section
          </FitText>
          <FitPill
            mode="toggle"
            active={sectionFilter}
            options={ANALYTICS_PAGE_SECTION_OPTIONS}
            onChange={setSectionFilter}
            style={{ flexWrap: "wrap" }}
          />
        </div>

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
                borderRadius: panelRadius,
                background: `linear-gradient(135deg, ${colors.surfaceRaised}, ${colors.surface})`,
                padding: 8,
                display: "grid",
                gap: 8,
              }}
            >
              <div
                className="analytics-ai-command-row"
                style={{ borderBottom: `1px solid ${colors.border}` }}
              >
                <div className="analytics-inline-icon-row" style={{ gap: 8 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: controlRadius,
                      backgroundColor: `${colors.brand}18`,
                      color: colors.brand,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={15} />
                  </div>
                  <div style={{ display: "grid", gap: 2 }}>
                    <FitText
                      as="p"
                      style={{
                        fontSize: 13,
                        color: colors.textPrimary,
                        fontWeight: 800,
                      }}
                    >
                      Latest AI Insight
                    </FitText>
                    <FitText as="p" style={{ fontSize: 11.5, color: colors.textMuted }}>
                      {analytics.latestInsight
                        ? formatDateTime(analytics.latestInsight.createdAt)
                        : "No generated insight yet"}
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
                    style={{ minHeight: 34, borderRadius: 8, paddingInline: 12 }}
                    textStyle={{ fontSize: 11.5 }}
                  />
                  <FitButton
                    variant="primary"
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
                    style={{ minHeight: 34, borderRadius: 8, paddingInline: 12 }}
                    textStyle={{ fontSize: 11.5 }}
                  />
                </div>
              </div>

              <div
                className="analytics-export-section-picker"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: controlRadius,
                  display: "grid",
                  gap: 8,
                  padding: 10,
                }}
              >
                <FitText
                  as="p"
                  style={{
                    color: colors.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  PDF Sections
                </FitText>
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  }}
                >
                  {analytics.pdfExportSectionOptions.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        alignItems: "center",
                        color: colors.textSecondary,
                        display: "flex",
                        fontSize: 12,
                        fontWeight: 650,
                        gap: 8,
                        minHeight: 26,
                      }}
                    >
                      <input
                        checked={analytics.selectedPdfSections.includes(
                          option.value,
                        )}
                        onChange={() => {
                          analytics.handleTogglePdfSection(option.value);
                        }}
                        style={{ accentColor: colors.brand }}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div
                className="analytics-ai-summary-row"
                style={{
                  border: `1px solid ${
                    analytics.latestInsightIsFallback
                      ? colors.warning
                      : colors.border
                  }`,
                  backgroundColor: analytics.latestInsightIsFallback
                    ? `${colors.warning}14`
                    : colors.surface,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  {analytics.latestInsightIsFallback ? (
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        gap: 7,
                      }}
                    >
                      <AlertTriangle size={13} color={colors.warning} />
                      <FitText
                        as="p"
                        style={{
                          fontSize: 11,
                          color: colors.warning,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Grounded fallback mode
                      </FitText>
                    </div>
                  ) : null}
                  {analytics.latestInsightIsFallback ? (
                    <FitText
                      as="p"
                      style={{
                        fontSize: 12,
                        color: colors.warning,
                        lineHeight: 1.45,
                      }}
                    >
                      The external AI provider was unavailable, so this panel is
                      using deterministic analytics data instead.
                    </FitText>
                  ) : null}
                  {analytics.latestInsight ? (
                    <FitText
                      as="p"
                      style={{
                        fontSize: 11,
                        color: analyticsSupportTextColor,
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
                      fontSize: 12.5,
                      lineHeight: 1.45,
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
                        borderRadius: controlRadius,
                        backgroundColor: colors.surface,
                        padding: 9,
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
                          color: analyticsSupportTextColor,
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
                        gridTemplateColumns: "28px minmax(0, 1fr)",
                        gap: 8,
                        alignItems: "start",
                        padding: 10,
                        cursor: "pointer",
                        background:
                          index % 2 === 0
                            ? `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`
                            : colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: panelRadius,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: controlRadius,
                          backgroundColor: `${colors.warning}18`,
                          color: colors.warning,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
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
                          style={{ fontSize: 13, fontWeight: 800 }}
                        >
                          {alert.title}
                        </FitText>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 12,
                            color: analyticsSupportTextColor,
                            lineHeight: 1.35,
                          }}
                        >
                          {alert.body}
                        </FitText>
                      </div>
                      <div
                        style={{
                          borderRadius: controlRadius,
                          padding: "6px 10px",
                          backgroundColor: `${colors.surfaceRaised}`,
                          border: `1px solid ${colors.border}`,
                          fontSize: 11,
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
                      color: analyticsSupportTextColor,
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
                  borderRadius: panelRadius,
                  background: `linear-gradient(180deg, ${colors.surfaceRaised}, ${colors.surface})`,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: controlRadius,
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
                    style={{ fontSize: 23, fontWeight: 800, marginTop: 3 }}
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
            <div style={{ marginBottom: 6 }}>
              <FitText
                as="p"
                style={{
                  fontSize: 10.5,
                  color: colors.textMuted,
                  lineHeight: 1.35,
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
                    borderRadius: panelRadius,
                    backgroundColor: colors.surface,
                    padding: 12,
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
                        borderRadius: controlRadius,
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
          <div
            className="analytics-revenue-board"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: panelRadius,
              background: `linear-gradient(135deg, ${colors.brand}10, ${colors.surface})`,
              padding: 12,
            }}
          >
            <div className="analytics-revenue-summary">
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

            <div className="analytics-revenue-chart">
              <div
                className="analytics-revenue-trend"
                style={{
                  minWidth: 0,
                  height: 266,
                  borderLeft: `1px solid ${colors.border}`,
                  paddingLeft: 14,
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
                  initialDimension={{ width: 680, height: 226 }}
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
                        borderRadius: controlRadius,
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
                {topRevenueSources.length ? (
                  <div className="analytics-source-card-grid">
                    {topRevenueSources.map((source) => (
                      <div
                        key={source.sourceKey}
                        className="analytics-source-card"
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: controlRadius,
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
                      borderRadius: panelRadius,
                      padding: 14,
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
                    borderRadius: controlRadius,
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
                borderRadius: panelRadius,
                backgroundColor: colors.surface,
                padding: 14,
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
                        borderRadius: controlRadius,
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
              borderRadius: panelRadius,
              backgroundColor: colors.surface,
              padding: 14,
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
                        borderRadius: controlRadius,
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
              borderRadius: panelRadius,
              backgroundColor: colors.surface,
              padding: 14,
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
                      borderRadius: controlRadius,
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
          padding: 0 0 24px;
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }

        .analytics-shell p {
          margin: 0;
        }

        .analytics-shell > .analytics-anchor-section > div,
        .analytics-shell > .analytics-operations-stack > div {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background-color: ${colors.surfaceRaised};
          box-sizing: border-box;
          margin-bottom: 0 !important;
          padding: 10px !important;
        }

        .analytics-shell > .analytics-anchor-section > div > div:first-child,
        .analytics-shell > .analytics-operations-stack > div > div:first-child {
          margin-bottom: 10px !important;
        }

        .analytics-anchor-section,
        .analytics-operations-stack {
          min-width: 0;
        }

        .analytics-anchor-section {
          scroll-margin-top: 112px;
        }

        .analytics-shell--all #analytics-insights {
          grid-column: 1 / -1;
          grid-row: 2;
        }

        .analytics-shell--all #analytics-alerts {
          grid-column: 1 / -1;
          grid-row: 3;
          align-self: start;
        }

        .analytics-shell--all #analytics-daily {
          grid-column: 1 / -1;
          grid-row: 4;
        }

        .analytics-shell--all #analytics-kpis {
          grid-column: 1 / -1;
          grid-row: 5;
        }

        .analytics-shell--all #analytics-revenue {
          grid-column: 1 / -1;
          grid-row: 6;
        }

        .analytics-shell--all #analytics-attendance {
          grid-column: 1 / -1;
          grid-row: 7;
        }

        .analytics-shell:not(.analytics-shell--all) {
          grid-template-columns: 1fr;
        }

        .analytics-shell:not(.analytics-shell--all) > * {
          grid-column: 1 / -1 !important;
          grid-row: auto !important;
        }

        .analytics-ai-panel {
          min-width: 0;
        }

        .analytics-ai-command-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          padding-bottom: 6px;
        }

        .analytics-ai-summary-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: start;
          border-radius: 8px;
          padding: 10px;
        }

        .analytics-card-grid {
          display: grid;
          gap: 10px;
        }

        .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .analytics-alert-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        #analytics-alerts .analytics-alert-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        #analytics-daily .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #analytics-kpis .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(220px, 1fr));
        }

        .analytics-recommendation-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .analytics-revenue-board,
        .analytics-attendance-grid,
        .analytics-modal-grid {
          display: grid;
          gap: 10px;
          align-items: start;
        }

        .analytics-modal-grid {
          grid-template-columns: minmax(0, 1fr) minmax(300px, 0.72fr);
        }

        .analytics-revenue-board {
          grid-template-columns: minmax(280px, 0.34fr) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }

        .analytics-operations-stack {
          display: grid;
          gap: 10px;
        }

        .analytics-revenue-chart {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(240px, 0.34fr);
          gap: 14px;
          align-items: start;
        }

        .analytics-revenue-summary {
          display: grid;
          gap: 10px;
          min-width: 0;
          align-content: start;
        }

        .analytics-source-list {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .analytics-source-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
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
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
        }

        .analytics-filter-row,
        .analytics-action-buttons,
        .analytics-peak-grid {
          gap: 10px;
        }

        .analytics-action-buttons {
          align-items: center;
        }

        .analytics-alert-grid [role="button"] {
          grid-template-columns: 24px minmax(0, 1fr) auto !important;
          min-height: 96px;
          padding: 10px !important;
        }

        .analytics-alert-grid [role="button"] > div:first-child {
          width: 24px !important;
          height: 24px !important;
        }

        .analytics-alert-grid [role="button"] > div:last-child {
          grid-column: 3 !important;
          grid-row: 1 / span 2 !important;
          align-self: center;
          justify-self: end !important;
          padding: 6px 8px !important;
          font-size: 10px !important;
        }

        .analytics-alert-grid [role="button"] p:last-child,
        #analytics-daily .analytics-card-grid--three > div > p:last-child {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        #analytics-kpis .analytics-card-grid--three > div {
          min-height: 112px;
          align-content: space-between;
        }

        #analytics-daily .analytics-card-grid--three > div {
          min-height: 110px;
          align-content: start;
        }

        #analytics-kpis .analytics-card-grid--three > div p:first-of-type {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        #analytics-kpis .analytics-card-grid--three > div > p:last-child {
          font-size: 19px !important;
          line-height: 1.1 !important;
          overflow-wrap: anywhere;
          word-break: normal;
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
          padding: 14px 16px;
        }

        .analytics-activity-row {
          align-items: start;
          background: linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0));
        }

        @media (max-width: 1180px) {
          .analytics-shell {
            grid-template-columns: 1fr;
          }

          .analytics-section-filter {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .analytics-section-filter > div {
            width: 100%;
          }

          #analytics-insights,
          #analytics-alerts,
          #analytics-daily,
          #analytics-kpis,
          #analytics-revenue,
          #analytics-attendance {
            grid-column: 1 / -1;
          }

          .analytics-card-grid--three,
          .analytics-alert-grid,
          .analytics-ai-summary-row,
          .analytics-recommendation-grid,
          .analytics-revenue-board,
          .analytics-attendance-grid,
          .analytics-revenue-chart,
          .analytics-modal-grid {
            grid-template-columns: 1fr;
          }

          .analytics-revenue-trend {
            border-left: none !important;
            padding-left: 0 !important;
            padding-top: 12px;
            border-top: 1px solid ${colors.border};
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
