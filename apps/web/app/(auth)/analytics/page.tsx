"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  CalendarClock,
  Clock3,
  ChevronDown,
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
import type { CoachAppointmentScheduleRecord } from "@fittrack/api-client";
import { coachScheduleQueryOptions } from "@fittrack/query";
import type {
  BusinessInsightFocus,
  BusinessInsightPeriod,
  BusinessInsightRunSummaryRecord,
} from "@fittrack/types";
import {
  buildRenderableAssetUrl,
  normalizeAiFormattedInlineText,
} from "@fittrack/utils";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  formatCompactMoney,
  formatDateTime,
  formatFullMoney,
  resolveAnalyticsTimeframe,
  type AnalyticsTimeMode,
} from "@/app/(auth)/analytics/helpers";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSection,
  FitSelect,
  FitText,
} from "@/components/fit";
import { FitModal } from "@/components/modals";
import AiFormattedText from "@/components/ai/AiFormattedText";
import { AnalyticsPresentationGrid } from "@/components/analytics/AnalyticsPresentationGrid";
import AnalyticsPeriodCalendarModal from "@/components/analytics/AnalyticsPeriodCalendarModal";
import {
  ANALYTICS_SECTION_FILTER_OPTIONS,
  useAnalyticsSectionFilter,
} from "@/contexts/AnalyticsSectionFilterContext";
import { useAnalyticsDashboard } from "@/hooks/analytics/useAnalyticsDashboard";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type RevenueSourceFilter =
  | "all"
  | "membership"
  | "bookings"
  | "products"
  | "coaching";

type AnalyticsCalendarTarget = "start" | "end";

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
    label: option.value === "all" ? "All Sections" : option.label,
  }),
);

const COACH_EARNINGS_PAGE_SIZE = 6;
const COACH_EARNINGS_GRID_COLUMNS =
  "minmax(0, 2.35fr) minmax(104px, 0.82fr) minmax(118px, 0.76fr) minmax(112px, 0.78fr) minmax(128px, 0.9fr) minmax(96px, 0.7fr)";

const PDF_EXPORT_SECTION_DESCRIPTIONS: Record<string, string> = {
  activities: "Recent admin activity and operational movement.",
  alerts: "Inventory and equipment alerts that need attention.",
  attendance: "Check-in totals, trends, and peak attendance windows.",
  daily: "Current operating totals and selected-window activity trends.",
  inventory: "Stock, equipment, and fulfillment indicators.",
  kpis: "Performance, attendance, booking, coach, and feedback indicators.",
  recommendations: "AI-recommended actions from a matching saved insight.",
  revenue: "Revenue totals, trend performance, and revenue mix.",
};

function formatAnalyticsInsightDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-PH", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Manila",
        year: "numeric",
      })
    : value;
}

function formatAnalyticsInsightDepth(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBusinessInsightSections(
  insight: BusinessInsightRunSummaryRecord,
  sectionOptions: Array<{ label: string; value: BusinessInsightFocus }>,
) {
  const sections = insight.selectedSections.length
    ? insight.selectedSections
    : [insight.focus];

  return sections
    .map(
      (section) =>
        sectionOptions.find((option) => option.value === section)?.label ??
        formatAnalyticsInsightDepth(section),
    )
    .join(", ");
}

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

function hasPaidCoachEarningsEvidence(
  appointment: CoachAppointmentScheduleRecord,
) {
  return (
    Boolean(appointment.coachPayoutPaidAt) ||
    appointment.activePaymentStatus === "completed"
  );
}

function isPaidCompletedCoachAppointment(
  appointment: CoachAppointmentScheduleRecord,
) {
  return (
    appointment.status === "completed" &&
    hasPaidCoachEarningsEvidence(appointment)
  );
}

function getAppointmentAmount(appointment: CoachAppointmentScheduleRecord) {
  const amount = Number(
    appointment.coachEarnings ??
      appointment.totalAmount ??
      (appointment.coach?.hourlyRate ?? 0) * (appointment.duration || 1),
  );
  return Number.isFinite(amount) ? amount : 0;
}

function getAppointmentGrossAmount(
  appointment: CoachAppointmentScheduleRecord,
) {
  const amount = Number(
    appointment.totalAmount ??
      (appointment.coach?.hourlyRate ?? 0) * (appointment.duration || 1),
  );
  return Number.isFinite(amount) ? amount : 0;
}

function getAppointmentMemberName(appointment: CoachAppointmentScheduleRecord) {
  const firstName = appointment.user?.profile?.firstName?.trim() ?? "";
  const lastName = appointment.user?.profile?.lastName?.trim() ?? "";
  return (
    `${firstName} ${lastName}`.trim() || appointment.user?.email || "Member"
  );
}

function getAppointmentMemberEmail(
  appointment: CoachAppointmentScheduleRecord,
) {
  return appointment.user?.email ?? "No email on file";
}

function getAppointmentMemberInitials(
  appointment: CoachAppointmentScheduleRecord,
) {
  const firstName = appointment.user?.profile?.firstName?.trim() ?? "";
  const lastName = appointment.user?.profile?.lastName?.trim() ?? "";
  const email = appointment.user?.email?.trim() ?? "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();

  if (initials) return initials.toUpperCase();
  return (email.charAt(0) || "M").toUpperCase();
}

function formatAppointmentDate(appointment: CoachAppointmentScheduleRecord) {
  const resolvedAt =
    appointment.completedAt ?? appointment.noShowAt ?? appointment.scheduledAt;

  return new Date(resolvedAt).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAppointmentTime(appointment: CoachAppointmentScheduleRecord) {
  const resolvedAt =
    appointment.completedAt ?? appointment.noShowAt ?? appointment.scheduledAt;

  return new Date(resolvedAt).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAnalyticsDateTrigger(value: string, emptyLabel: string) {
  if (!value) return emptyLabel;

  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAnalyticsPeriodTrigger(
  mode: AnalyticsTimeMode,
  value: string,
  emptyLabel: string,
) {
  if (!value) return emptyLabel;
  if (mode === "custom" || mode === "day") {
    return formatAnalyticsDateTrigger(value, emptyLabel);
  }

  const period = resolveAnalyticsTimeframe(mode, { anchorDate: value });
  if (!period) return emptyLabel;
  if (mode === "week") {
    return `${formatAnalyticsDateTrigger(
      period.startDate,
      emptyLabel,
    )} – ${formatAnalyticsDateTrigger(period.endDate, emptyLabel)}`;
  }
  if (mode === "month") {
    return new Date(`${period.startDate}T00:00:00.000Z`).toLocaleDateString(
      "en-PH",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  }

  return period.startDate.slice(0, 4);
}

function getRecommendedActionConcern(action: string) {
  const normalizedAction = action.toLowerCase();

  if (
    /revenue|payment|membership|sale|booking|coaching|commission|invoice/.test(
      normalizedAction,
    )
  ) {
    return "Revenue";
  }

  if (
    /attendance|check-in|check in|peak|visit|session/.test(normalizedAction)
  ) {
    return "Attendance";
  }

  if (
    /inventory|stock|equipment|maintenance|facility|venue/.test(
      normalizedAction,
    )
  ) {
    return "Operations";
  }

  if (
    /feedback|satisfaction|coach|member|experience|retention/.test(
      normalizedAction,
    )
  ) {
    return "Experience";
  }

  return "General";
}

function CoachEarningsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 180 });
  const themeTransition = useThemeTransition();
  const [earningsPage, setEarningsPage] = useState(1);
  const appointmentsQuery = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(
      webApiClient,
      user?.id,
    ),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const appointments = appointmentsQuery.data ?? [];
  const paidCompletedAppointments = appointments.filter(
    isPaidCompletedCoachAppointment,
  );
  const resolvedAppointments = paidCompletedAppointments;
  const earningsPageCount = Math.max(
    1,
    Math.ceil(resolvedAppointments.length / COACH_EARNINGS_PAGE_SIZE),
  );
  const currentEarningsPage = Math.min(earningsPage, earningsPageCount);
  const earningsPageOffset =
    (currentEarningsPage - 1) * COACH_EARNINGS_PAGE_SIZE;
  const visibleResolvedAppointments = resolvedAppointments.slice(
    earningsPageOffset,
    earningsPageOffset + COACH_EARNINGS_PAGE_SIZE,
  );
  const earningsPageStart =
    resolvedAppointments.length === 0 ? 0 : earningsPageOffset + 1;
  const earningsPageEnd =
    resolvedAppointments.length === 0
      ? 0
      : Math.min(
          resolvedAppointments.length,
          earningsPageOffset + COACH_EARNINGS_PAGE_SIZE,
        );
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const recentMonthsStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  }, []);
  const paidCompletedAppointmentsThisMonth = paidCompletedAppointments.filter(
    (appointment) => new Date(appointment.scheduledAt) >= monthStart,
  );
  const paidCompletedAppointmentsRecentMonths =
    paidCompletedAppointments.filter(
      (appointment) => new Date(appointment.scheduledAt) >= recentMonthsStart,
    );
  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" &&
      appointment.status !== "completed" &&
      appointment.status !== "no_show",
  );
  const earnedTotal = paidCompletedAppointments.reduce(
    (sum, appointment) => sum + getAppointmentAmount(appointment),
    0,
  );
  const earnedThisMonth = paidCompletedAppointmentsThisMonth.reduce(
    (sum, appointment) => sum + getAppointmentAmount(appointment),
    0,
  );
  const earnedRecentMonths = paidCompletedAppointmentsRecentMonths.reduce(
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
  const renderEarningsStatusBox = (
    label: string,
    tone: string,
    fontSize = 9,
  ) => (
    <span
      style={{
        alignItems: "center",
        backgroundColor: `${tone}14`,
        border: `1px solid ${tone}55`,
        borderRadius: 6,
        display: "inline-grid",
        justifyItems: "center",
        minWidth: 64,
        padding: "4px 9px",
        textAlign: "center",
      }}
    >
      <FitText
        as="span"
        excludeGlobalScale
        style={{
          color: tone,
          fontSize,
          fontWeight: 500,
          lineHeight: 1.08,
        }}
      >
        {label}
      </FitText>
    </span>
  );

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
              helper:
                "Coach commission from paid completed sessions this month.",
              isEarnings: true,
            },
            {
              label: "Total Earnings All Time",
              value: formatCompactMoney(earnedTotal),
              helper: "Coach commission from all paid completed sessions.",
              isEarnings: true,
            },
            {
              label: "Paid Sessions This Month",
              value: String(paidCompletedAppointmentsThisMonth.length),
              helper: "Completed sessions with captured payment.",
            },
            {
              label: "Past 3 Months Earnings",
              value: formatCompactMoney(earnedRecentMonths),
              helper: `${paidCompletedAppointmentsRecentMonths.length} paid session${paidCompletedAppointmentsRecentMonths.length === 1 ? "" : "s"} across recent months; ${upcomingAppointments.length} upcoming or open.`,
              isEarnings: true,
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
                  color: item.isEarnings ? colors.brand : colors.textPrimary,
                  fontSize: 28,
                  fontWeight: item.isEarnings ? 850 : 900,
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

        <section
          className="members-directory-panel coach-earnings-table"
          data-members-directory-panel
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            boxShadow: "none",
            display: "grid",
            gap: 0,
            gridTemplateRows: "auto auto auto",
            minHeight: 0,
            overflow: "hidden",
            padding: 0,
            width: "100%",
          }}
        >
          <div
            className="members-directory-panel__top"
            style={{
              alignItems: "center",
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              flexWrap: "wrap",
              padding: 16,
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
                Only paid, completed sessions are shown here.
              </FitText>
            </div>
            <FitButton
              variant="primary"
              label="OPEN SESSIONS"
              onClick={() => router.push("/schedule")}
            />
          </div>
          <div
            className="members-directory-panel__middle"
            style={{
              background: colors.surface,
              border: "none",
              borderRadius: 0,
              display: "grid",
              minHeight: 0,
              padding: 0,
            }}
          >
            <div
              className="members-directory-panel__desktop"
              style={{
                display: "grid",
                gridTemplateRows: "auto auto",
                minHeight: 0,
              }}
            >
              {appointmentsQuery.isLoading ? (
                <div
                  key="loading"
                  className="members-directory-panel__view-enter"
                  style={{
                    backgroundColor: `${colors.surface}e8`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 0,
                    padding: 18,
                  }}
                >
                  <FitText
                    style={{ color: colors.textSecondary, fontSize: 13 }}
                  >
                    Loading coach earnings...
                  </FitText>
                </div>
              ) : resolvedAppointments.length > 0 ? (
                <div
                  key="list"
                  className="members-directory-panel__list members-directory-panel__view-enter"
                  style={{
                    display: "grid",
                    gridTemplateRows: "auto auto",
                    minHeight: 0,
                  }}
                >
                  <div
                    className="members-directory-panel__table-head"
                    style={{
                      backgroundColor: `${colors.surfaceRaised}bd`,
                      borderBottom: `1px solid ${colors.border}`,
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: COACH_EARNINGS_GRID_COLUMNS,
                      padding: "7px 12px 8px",
                    }}
                  >
                    {[
                      "MEMBER",
                      "SESSION",
                      "CLOSED",
                      "TOTAL",
                      "EARNINGS",
                      "STATUS",
                    ].map((heading) => {
                      const isStatusColumn = heading === "STATUS";

                      return (
                        <FitText
                          key={heading}
                          data-status-header={
                            isStatusColumn ? "true" : undefined
                          }
                          style={{
                            color: colors.textMuted,
                            fontSize: 10.5,
                            fontWeight: 700,
                            justifySelf: isStatusColumn ? "center" : undefined,
                            letterSpacing: "0.05em",
                            textAlign: isStatusColumn ? "center" : undefined,
                          }}
                        >
                          {heading}
                        </FitText>
                      );
                    })}
                  </div>
                  <div
                    className="members-directory-panel__rows"
                    style={{
                      alignContent: "start",
                      display: "grid",
                      gap: 0,
                      minHeight: 0,
                    }}
                  >
                    {visibleResolvedAppointments.map((appointment, index) => {
                      const statusLabel = appointment.coachPayoutPaidAt
                        ? "Paid"
                        : "Confirmed";
                      const statusTone = appointment.coachPayoutPaidAt
                        ? colors.success
                        : colors.brand;
                      const commission = formatCompactMoney(
                        getAppointmentAmount(appointment),
                      );
                      const memberAvatarUrl = buildRenderableAssetUrl({
                        apiBaseUrl: WEB_API_BASE_URL,
                        assetUrl: appointment.user?.profile?.avatarUrl ?? null,
                      });

                      return (
                        <div
                          key={appointment.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open session for ${getAppointmentMemberName(appointment)}`}
                          className="members-directory-panel__row"
                          data-row-index={earningsPageOffset + index + 1}
                          onClick={() => router.push("/schedule")}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ")
                              return;
                            event.preventDefault();
                            router.push("/schedule");
                          }}
                          style={{
                            alignItems: "center",
                            backgroundColor: "transparent",
                            border: "none",
                            borderBottom: `1px solid ${colors.border}`,
                            borderRadius: 0,
                            cursor: "pointer",
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: COACH_EARNINGS_GRID_COLUMNS,
                            minHeight: 44,
                            outline: "none",
                            padding: "7px 12px",
                          }}
                        >
                          <div className="members-directory-panel__cell">
                            <div
                              className="members-directory-panel__identity"
                              style={{
                                alignItems: "center",
                                display: "flex",
                                gap: 10,
                                minWidth: 0,
                              }}
                            >
                              <div
                                className="members-directory-panel__identity-avatar"
                                style={{
                                  alignItems: "center",
                                  backgroundColor: colors.surfaceRaised,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: 8,
                                  display: "flex",
                                  flexShrink: 0,
                                  height: 34,
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  position: "relative",
                                  width: 34,
                                }}
                              >
                                <FitText
                                  style={{
                                    color: colors.brand,
                                    fontSize: 10.5,
                                    fontWeight: 850,
                                    letterSpacing: "0.03em",
                                  }}
                                >
                                  {getAppointmentMemberInitials(appointment)}
                                </FitText>
                                {memberAvatarUrl ? (
                                  <img
                                    alt={`${getAppointmentMemberName(appointment)} avatar`}
                                    src={memberAvatarUrl}
                                    onError={(event) => {
                                      event.currentTarget.style.display =
                                        "none";
                                    }}
                                    style={{
                                      height: "100%",
                                      inset: 0,
                                      objectFit: "cover",
                                      position: "absolute",
                                      width: "100%",
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div
                                className="members-directory-panel__identity-copy"
                                style={{ display: "grid", gap: 3, minWidth: 0 }}
                              >
                                <FitText
                                  className="members-directory-panel__primary-text"
                                  style={{
                                    color: colors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: 800,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {getAppointmentMemberName(appointment)}
                                </FitText>
                                <FitText
                                  className="members-directory-panel__secondary-text"
                                  style={{
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {getAppointmentMemberEmail(appointment)}
                                </FitText>
                              </div>
                            </div>
                          </div>
                          <div className="members-directory-panel__cell">
                            <FitText
                              className="members-directory-panel__detail-text"
                              style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                fontWeight: 500,
                                lineHeight: 1.3,
                              }}
                            >
                              {`${appointment.duration} min coaching`}
                            </FitText>
                          </div>
                          <div className="members-directory-panel__cell">
                            <div
                              style={{ display: "grid", gap: 3, minWidth: 0 }}
                            >
                              <FitText
                                className="members-directory-panel__primary-text"
                                style={{
                                  color: colors.textPrimary,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {formatAppointmentDate(appointment)}
                              </FitText>
                              <FitText
                                className="members-directory-panel__secondary-text"
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 11,
                                }}
                              >
                                {formatAppointmentTime(appointment)}
                              </FitText>
                            </div>
                          </div>
                          <div className="members-directory-panel__cell">
                            <FitText
                              className="members-directory-panel__detail-text"
                              style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                fontWeight: 500,
                                lineHeight: 1.3,
                              }}
                            >
                              {formatCompactMoney(
                                getAppointmentGrossAmount(appointment),
                              )}
                            </FitText>
                          </div>
                          <div className="members-directory-panel__cell">
                            <FitText
                              className="members-directory-panel__detail-text"
                              style={{
                                color: colors.brand,
                                fontSize: 12,
                                fontWeight: 650,
                                lineHeight: 1.3,
                              }}
                            >
                              {commission}
                            </FitText>
                          </div>
                          <div
                            className="members-directory-panel__cell"
                            data-member-status-cell="true"
                            style={{
                              justifySelf: "center",
                              textAlign: "center",
                            }}
                          >
                            {renderEarningsStatusBox(
                              statusLabel,
                              statusTone,
                              9,
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  key="empty"
                  className="members-directory-panel__view-enter"
                  style={{
                    backgroundColor: `${colors.surface}d8`,
                    border: `1px dashed ${colors.border}`,
                    borderRadius: 8,
                    padding: 18,
                  }}
                >
                  <FitText
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    Paid completed coaching sessions will appear here after
                    staff confirms payment.
                  </FitText>
                </div>
              )}
            </div>

            <div
              className="members-directory-panel__mobile"
              style={{ display: "none", gap: 12 }}
            >
              {appointmentsQuery.isLoading ? (
                <div
                  style={{
                    backgroundColor: `${colors.surface}e2`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: 18,
                  }}
                >
                  <FitText
                    style={{ color: colors.textSecondary, fontSize: 13 }}
                  >
                    Loading coach earnings...
                  </FitText>
                </div>
              ) : resolvedAppointments.length > 0 ? (
                visibleResolvedAppointments.map((appointment) => {
                  const statusLabel = appointment.coachPayoutPaidAt
                    ? "Paid"
                    : "Confirmed";
                  const statusTone = appointment.coachPayoutPaidAt
                    ? colors.success
                    : colors.brand;
                  const commission = formatCompactMoney(
                    getAppointmentAmount(appointment),
                  );

                  return (
                    <div
                      key={appointment.id}
                      role="button"
                      tabIndex={0}
                      className="members-directory-panel__mobile-card"
                      onClick={() => router.push("/schedule")}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        router.push("/schedule");
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        style={{
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          display: "grid",
                          gap: 12,
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            alignItems: "center",
                            display: "flex",
                            gap: 10,
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                            <FitText
                              style={{
                                color: colors.textPrimary,
                                fontSize: 14,
                                fontWeight: 800,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getAppointmentMemberName(appointment)}
                            </FitText>
                            <FitText
                              style={{
                                color: colors.textSecondary,
                                fontSize: 11.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getAppointmentMemberEmail(appointment)}
                            </FitText>
                          </div>
                          {renderEarningsStatusBox(statusLabel, statusTone, 10)}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          }}
                        >
                          {[
                            ["Closed", formatAppointmentDate(appointment)],
                            ["Session", `${appointment.duration} min coaching`],
                            [
                              "Total",
                              formatCompactMoney(
                                getAppointmentGrossAmount(appointment),
                              ),
                            ],
                            ["Earnings", commission],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{ display: "grid", gap: 3 }}
                            >
                              <FitText
                                style={{
                                  color: colors.textMuted,
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {label}
                              </FitText>
                              <FitText
                                style={{
                                  color:
                                    label === "Earnings"
                                      ? colors.brand
                                      : colors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: 500,
                                }}
                              >
                                {value}
                              </FitText>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    backgroundColor: `${colors.surface}d8`,
                    border: `1px dashed ${colors.border}`,
                    borderRadius: 8,
                    padding: 18,
                  }}
                >
                  <FitText
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    Paid completed coaching sessions will appear here after
                    staff confirms payment.
                  </FitText>
                </div>
              )}
            </div>
          </div>

          {!appointmentsQuery.isLoading ? (
            <div
              className="members-directory-panel__bottom"
              style={{
                backgroundColor: `${colors.surfaceRaised}f5`,
                border: "none",
                borderRadius: 0,
                borderTop: `1px solid ${colors.border}`,
                padding: "10px 12px",
              }}
            >
              <div
                className="members-directory-panel__footer"
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText
                    style={{ color: colors.textSecondary, fontSize: 11.5 }}
                  >
                    Showing {earningsPageStart} - {earningsPageEnd} of{" "}
                    {resolvedAppointments.length}
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    Paid coach sessions and confirmation state
                  </FitText>
                </div>
                <FitPagination
                  currentPage={currentEarningsPage}
                  totalPages={earningsPageCount}
                  onPageChange={setEarningsPage}
                  ariaLabel="Coach earnings pagination"
                  showSinglePage
                />
              </div>
            </div>
          ) : null}

          <style>{`
              @keyframes members-directory-view-enter {
                0% {
                  opacity: 0;
                  transform: translateY(10px);
                }

                100% {
                  opacity: 1;
                  transform: translateY(0);
                }
              }

              .members-directory-panel__view-enter {
                animation: members-directory-view-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
              }

              .members-directory-panel__row {
                transition: background-color 120ms ease, box-shadow 120ms ease;
              }

              .members-directory-panel__row:hover {
                background-color: ${colors.brand}0d !important;
                box-shadow: 3px 0 0 ${colors.brand}66 inset;
              }

              .members-directory-panel__cell,
              .members-directory-panel__identity,
              .members-directory-panel__identity-copy {
                min-width: 0;
              }

              .members-directory-panel__row:focus-visible {
                border-color: ${colors.brand}2f !important;
                outline: 2px solid ${colors.brand}35;
                outline-offset: 2px;
              }

              .members-directory-panel__row-active .members-directory-panel__primary-text {
                font-weight: 800 !important;
              }

              .members-directory-panel__row-active .members-directory-panel__secondary-text {
                color: ${colors.textPrimary} !important;
                opacity: 0.94;
              }

              .members-directory-panel__mobile-card {
                cursor: pointer;
                outline: none;
                transition: filter 140ms ease;
              }

              .members-directory-panel__mobile-card:hover {
                filter: brightness(1.02);
              }

              @media (max-width: 1259px) {
                .coach-earnings-table.members-directory-panel {
                  height: auto !important;
                  min-height: 0 !important;
                }

                .coach-earnings-table .members-directory-panel__desktop {
                  display: none !important;
                }

                .coach-earnings-table .members-directory-panel__middle {
                  padding: 0 !important;
                }

                .coach-earnings-table .members-directory-panel__mobile {
                  display: grid !important;
                }
              }

              @media (prefers-reduced-motion: reduce) {
                .members-directory-panel__view-enter,
                .members-directory-panel__row,
                .members-directory-panel__identity-avatar,
                .members-directory-panel__primary-text,
                .members-directory-panel__secondary-text,
                .members-directory-panel__emphasis-text {
                  transition: none !important;
                }
              }

              @media (max-width: 640px) {
                .members-directory-panel__footer {
                  align-items: flex-start !important;
                }
              }
            `}</style>
        </section>
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
  const { colors } = useTheme();
  const panelRadius = 8;
  const recordRadius = 6;
  const controlRadius = 7;
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const analytics = useAnalyticsDashboard();
  const { sectionFilter, setSectionFilter, shouldShowSection } =
    useAnalyticsSectionFilter();
  const [revenueSourceFilter, setRevenueSourceFilter] =
    useState<RevenueSourceFilter>("all");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isInsightExportModalOpen, setIsInsightExportModalOpen] =
    useState(false);
  const [isInsightHistoryModalOpen, setIsInsightHistoryModalOpen] =
    useState(false);
  const [comparePreviousInsight, setComparePreviousInsight] = useState(true);
  const [selectedPreviousInsightId, setSelectedPreviousInsightId] = useState<
    string | null
  >(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFocusFilter, setHistoryFocusFilter] = useState<
    BusinessInsightFocus | "all"
  >("all");
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<
    BusinessInsightPeriod | "all"
  >("all");
  const [analyticsCalendarTarget, setAnalyticsCalendarTarget] =
    useState<AnalyticsCalendarTarget | null>(null);

  const draftTimeMode = analytics.draftTimeMode;
  const periodLabel =
    draftTimeMode === "custom" || draftTimeMode === "day"
      ? "date"
      : draftTimeMode;
  const calendarMode: Exclude<AnalyticsTimeMode, "custom"> =
    draftTimeMode === "custom" ? "day" : draftTimeMode;
  const calendarAnchorForValue = (value: string) => {
    if (!value || calendarMode === "day") return value || undefined;
    return (
      resolveAnalyticsTimeframe(calendarMode, { anchorDate: value })
        ?.startDate ?? value
    );
  };
  const calendarSelectedValue =
    analyticsCalendarTarget === "start"
      ? calendarAnchorForValue(analytics.draftStartDate)
      : analyticsCalendarTarget === "end"
        ? calendarAnchorForValue(analytics.draftEndDate)
        : undefined;
  const calendarOtherValue =
    analyticsCalendarTarget === "start"
      ? calendarAnchorForValue(analytics.draftEndDate)
      : analyticsCalendarTarget === "end"
        ? calendarAnchorForValue(analytics.draftStartDate)
        : undefined;

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
      ? Number(
          ((coachingCommissionTotal / coachingPaymentsCollected) * 100).toFixed(
            1,
          ),
        )
      : 0;
  const latestRecommendedActions = useMemo(
    () =>
      (analytics.latestInsight?.recommendedActions ?? [])
        .map(normalizeAiFormattedInlineText)
        .filter(Boolean),
    [analytics.latestInsight?.recommendedActions],
  );
  const selectedInsightSectionsLabel = useMemo(
    () =>
      analytics.selectedInsightSections
        .map(
          (section) =>
            analytics.insightSectionOptions.find(
              (option) => option.value === section,
            )?.label ?? section,
        )
        .join(", "),
    [analytics.insightSectionOptions, analytics.selectedInsightSections],
  );
  const selectedInsightSectionsTriggerLabel =
    analytics.selectedInsightSections.length === 0
      ? "Select sections"
      : analytics.selectedInsightSections.length === 1
        ? selectedInsightSectionsLabel
        : `${analytics.selectedInsightSections.length} sections selected`;
  const selectedInsightDepthOption = analytics.analysisDepthOptions.find(
    (option) => option.value === analytics.selectedInsightDepth,
  );
  const latestInsightSectionsLabel = useMemo(() => {
    if (!analytics.latestInsight) return "";

    const sections = analytics.latestInsight.selectedSections.length
      ? analytics.latestInsight.selectedSections
      : [analytics.latestInsight.focus];

    return sections
      .map(
        (section) =>
          analytics.insightSectionOptions.find(
            (option) => option.value === section,
          )?.label ?? section,
      )
      .join(", ");
  }, [analytics.insightSectionOptions, analytics.latestInsight]);
  const latestInsightDepthLabel = analytics.latestInsight
    ? formatAnalyticsInsightDepth(analytics.latestInsight.analysisDepth)
    : "";
  const currentInsightCreatedAt = analytics.latestInsight
    ? Date.parse(analytics.latestInsight.createdAt)
    : Number.NaN;
  const previousInsightOptions = analytics.latestInsight
    ? analytics.insightHistory.filter((insight) => {
        const createdAt = Date.parse(insight.createdAt);
        return (
          insight.id !== analytics.latestInsight!.id &&
          Number.isFinite(createdAt) &&
          createdAt < currentInsightCreatedAt
        );
      })
    : [];
  const automaticPreviousInsight = previousInsightOptions[0] ?? null;
  const selectedPreviousInsight = selectedPreviousInsightId
    ? (previousInsightOptions.find(
        (insight) => insight.id === selectedPreviousInsightId,
      ) ?? null)
    : null;
  const comparisonSourceInsight =
    selectedPreviousInsight ?? automaticPreviousInsight;
  const historyPeriodOptions = [
    ...new Set(previousInsightOptions.map((insight) => insight.period)),
  ];
  const normalizedHistorySearch = historySearch.trim().toLowerCase();
  const filteredPreviousInsights = previousInsightOptions.filter((insight) => {
    const sections = insight.selectedSections.length
      ? insight.selectedSections
      : [insight.focus];
    const matchesFocus =
      historyFocusFilter === "all" ||
      insight.focus === historyFocusFilter ||
      sections.includes(historyFocusFilter);
    const matchesPeriod =
      historyPeriodFilter === "all" || insight.period === historyPeriodFilter;
    const searchableText = [
      insight.summary,
      insight.createdAt,
      formatAnalyticsInsightDate(insight.createdAt),
      insight.period,
      insight.focus,
      ...sections,
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesFocus &&
      matchesPeriod &&
      (!normalizedHistorySearch ||
        searchableText.includes(normalizedHistorySearch))
    );
  });
  const latestHighlights = useMemo(
    () =>
      (analytics.latestInsight?.highlights ?? [])
        .map(normalizeAiFormattedInlineText)
        .filter(Boolean)
        .slice(0, 3),
    [analytics.latestInsight?.highlights],
  );
  const latestPriorityRisks = useMemo(() => {
    const insight = analytics.latestInsight;
    if (!insight) return [];
    return [...new Set([...insight.risks, ...insight.anomalyFlags])]
      .map(normalizeAiFormattedInlineText)
      .filter(Boolean)
      .slice(0, 3);
  }, [analytics.latestInsight]);
  const recommendedActionGroups = useMemo(() => {
    const groupedActions = latestRecommendedActions
      .slice(0, 3)
      .reduce<Record<string, string[]>>((groups, action) => {
        const concern = getRecommendedActionConcern(action);
        groups[concern] = [...(groups[concern] ?? []), action];
        return groups;
      }, {});

    return Object.entries(groupedActions);
  }, [latestRecommendedActions]);
  const analyticsSupportTextColor = colors.textSecondary;
  const fitTrackOrange = colors.brand;
  const analyticsSectionGradient = `radial-gradient(ellipse 46% 42% at 0% 0%, ${colors.brand}12 0%, ${colors.brand}08 38%, transparent 100%), ${colors.surface}`;
  const analyticsRaisedGradient = `radial-gradient(ellipse 46% 42% at 0% 0%, ${colors.brand}12 0%, transparent 100%), ${colors.surfaceRaised}`;
  const analyticsFallbackGradient = `radial-gradient(ellipse 46% 42% at 0% 0%, ${colors.warning}14 0%, transparent 100%), ${colors.surface}`;
  const rangeRevenueTotals =
    analytics.overview?.revenue ?? analytics.revenue?.totals;
  const topRangeRevenueSource = analytics.revenue?.topRevenueSources[0] ?? null;
  const hasLatestInsight = Boolean(analytics.latestInsight);
  const latestAttendancePoint =
    analytics.attendanceSeries[analytics.attendanceSeries.length - 1] ?? null;
  const isAnalyticsModalOpen =
    isPdfModalOpen ||
    isInsightExportModalOpen ||
    isInsightHistoryModalOpen ||
    Boolean(analytics.selectedDrilldown) ||
    analytics.isGeneratingInsight;
  const dateInputStyle: CSSProperties = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: controlRadius,
    color: colors.textPrimary,
    height: 40,
    justifyContent: "space-between",
    minHeight: 40,
    padding: "0 12px",
    textAlign: "left",
    width: "100%",
  };

  const openInsightExportModal = () => {
    setComparePreviousInsight(true);
    setSelectedPreviousInsightId(null);
    setHistorySearch("");
    setHistoryFocusFilter("all");
    setHistoryPeriodFilter("all");
    setIsInsightExportModalOpen(true);
  };

  const openInsightHistoryModal = () => {
    setIsInsightExportModalOpen(false);
    setIsInsightHistoryModalOpen(true);
  };

  const returnToInsightExportModal = () => {
    setIsInsightHistoryModalOpen(false);
    setIsInsightExportModalOpen(true);
  };

  const selectPreviousInsight = (insightId: string) => {
    setSelectedPreviousInsightId(insightId);
    returnToInsightExportModal();
  };

  const exportInsightPdf = () => {
    if (!analytics.latestInsight) return;

    void analytics
      .handleExportInsightPdf(analytics.latestInsight.id, {
        comparePrevious: comparePreviousInsight,
        previousInsightId:
          comparePreviousInsight && selectedPreviousInsightId
            ? selectedPreviousInsightId
            : undefined,
      })
      .then((exported) => {
        if (exported) setIsInsightExportModalOpen(false);
      });
  };

  const dailyInsightCards = [
    {
      label: "Members Added",
      value: analytics.overview?.newMembers ?? 0,
      helper: `New member accounts inside ${analytics.analyticsWindow.label.toLowerCase()}.`,
      icon: Users,
      loading: analytics.overviewLoading,
    },
    {
      label: "Coaching Sessions",
      value: analytics.overview?.completedCoachingSessions ?? 0,
      helper: "Completed coaching sessions inside the selected range.",
      icon: Clock3,
      loading: analytics.overviewLoading,
    },
    {
      label: "Check-ins",
      value: analytics.overview?.totalCheckIns ?? 0,
      helper: "Member check-ins recorded inside the selected range.",
      icon: TrendingUp,
      loading: analytics.overviewLoading,
    },
    {
      label: "Top Revenue Source",
      value: topRangeRevenueSource?.sourceLabel ?? "No revenue yet",
      helper: topRangeRevenueSource
        ? `${formatCompactMoney(topRangeRevenueSource.revenue)} inside the selected range.`
        : "No completed revenue was recorded inside the selected range.",
      icon: BarChart3,
      loading: analytics.revenueLoading,
    },
    {
      label: "Peak Check-in Window",
      value: analytics.attendance?.peakHours[0]?.hourLabel ?? "No peak yet",
      helper: analytics.attendance?.peakHours[0]
        ? `${analytics.attendance.peakHours[0].checkIns} check-ins in the current attendance window.`
        : "No attendance peak has been recorded in the current window.",
      icon: BarChart3,
      loading: analytics.attendanceLoading,
    },
    {
      label: "Range Revenue",
      value: analytics.revenueLoading
        ? "--"
        : formatCompactMoney(selectedRevenueValue),
      helper: `${selectedRevenueLabel} inside the selected range.`,
      icon: BarChart3,
      loading: analytics.revenueLoading,
    },
  ];

  const peakAttendanceWindow = analytics.attendance?.peakHours[0] ?? null;
  const performanceKpis = [
    {
      icon: BarChart3,
      label: "Total Revenue",
      loading: analytics.overviewLoading,
      value: formatCompactMoney(rangeRevenueTotals?.totalRevenue ?? 0),
    },
    {
      icon: BarChart3,
      label: "Membership Revenue",
      loading: analytics.overviewLoading,
      value: formatCompactMoney(rangeRevenueTotals?.membershipRevenue ?? 0),
    },
    {
      icon: CalendarClock,
      label: "Venue Booking Revenue",
      loading: analytics.overviewLoading,
      value: formatCompactMoney(rangeRevenueTotals?.bookingRevenue ?? 0),
    },
    {
      icon: PackageSearch,
      label: "Retail Product Revenue",
      loading: analytics.overviewLoading,
      value: formatCompactMoney(rangeRevenueTotals?.productRevenue ?? 0),
    },
    {
      icon: Users,
      label: "Members Added",
      loading: analytics.overviewLoading,
      value: String(analytics.overview?.newMembers ?? 0),
    },
    {
      icon: Clock3,
      label: "Check-ins",
      loading: analytics.overviewLoading,
      value: String(analytics.overview?.totalCheckIns ?? 0),
    },
    {
      icon: BarChart3,
      label: "Peak Check-in Window",
      loading: analytics.attendanceLoading,
      value: peakAttendanceWindow
        ? `${peakAttendanceWindow.hourLabel} - ${peakAttendanceWindow.checkIns}`
        : "No peak yet",
    },
    {
      icon: Sparkles,
      label: "Completed Coaching Sessions",
      loading: analytics.overviewLoading,
      value: String(analytics.overview?.completedCoachingSessions ?? 0),
    },
    {
      icon: TrendingUp,
      label: "Coaching Gym Share",
      loading: analytics.revenueLoading,
      value: `${formatCompactMoney(coachingCommissionTotal)} / ${coachingCommissionRate}%`,
    },
  ];
  const visiblePerformanceKpis =
    sectionFilter === "all" ? performanceKpis.slice(0, 6) : performanceKpis;
  const headlinePerformanceKpi = visiblePerformanceKpis[0] ?? null;
  const revenuePerformanceKpis = visiblePerformanceKpis.slice(1, 4);
  const operationsPerformanceKpis = visiblePerformanceKpis.slice(4);
  const drilldownPeakHours =
    analytics.drilldownAttendance?.peakHours ??
    analytics.attendance?.peakHours ??
    [];
  const peakCheckInCount = drilldownPeakHours.reduce(
    (highest, peak) => Math.max(highest, peak.checkIns),
    0,
  );
  const tiedPeakHours = drilldownPeakHours.filter(
    (peak) => peak.checkIns === peakCheckInCount,
  );
  const peakHourSummary =
    tiedPeakHours.length > 1
      ? `${tiedPeakHours.length} time windows tied at ${peakCheckInCount} check-ins`
      : tiedPeakHours.length === 1
        ? `${tiedPeakHours[0].hourLabel} leads with ${peakCheckInCount} check-ins`
        : "No peak attendance window yet";

  const liveAlertLabel = `${systemAlerts.length} live alert${systemAlerts.length === 1 ? "" : "s"}`;
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

      <div
        className={`analytics-shell analytics-shell--${sectionFilter}`}
        inert={isAnalyticsModalOpen}
        aria-hidden={isAnalyticsModalOpen || undefined}
      >
        <div
          className="analytics-section-filter"
          role="navigation"
          aria-label="Analytics sections"
          style={{
            alignItems: "center",
            display: "flex",
            gap: 12,
            gridColumn: "1 / -1",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <FitPill
            mode="toggle"
            active={sectionFilter}
            options={ANALYTICS_PAGE_SECTION_OPTIONS}
            onChange={setSectionFilter}
            style={{ flexWrap: "wrap" }}
          />
          <div className="analytics-section-filter-actions">
            <FitButton
              data-ui="analytics-pdf-trigger"
              variant="ghost"
              icon={Download}
              label={
                analytics.isExportingPdf ? "PREPARING PDF..." : "EXPORT PDF"
              }
              onClick={() => setIsPdfModalOpen(true)}
              disabled={analytics.isExportingPdf}
              style={{ minHeight: 36, whiteSpace: "nowrap" }}
              textStyle={{ fontSize: 11.5 }}
            />
          </div>
        </div>

        <div
          className="analytics-date-range-panel"
          style={{
            alignItems: "end",
            background: analyticsSectionGradient,
            border: `1px solid ${colors.border}`,
            borderRadius: panelRadius,
            display: "grid",
            gap: 12,
            gridColumn: "1 / -1",
            gridTemplateColumns:
              "minmax(220px, 1.35fr) repeat(3, minmax(150px, 0.8fr)) auto",
            padding: 12,
          }}
        >
          <div
            className="analytics-timeframe-intro"
            style={{ alignSelf: "center", display: "grid", gap: 4 }}
          >
            <div className="analytics-inline-icon-row" style={{ gap: 8 }}>
              <CalendarClock size={17} color={colors.brand} />
              <FitText
                as="p"
                style={{
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                Analytics timeframe
              </FitText>
            </div>
            <FitText
              as="p"
              style={{
                color: analyticsSupportTextColor,
                fontSize: 11.5,
                lineHeight: 1.45,
              }}
            >
              Applied timeframe: {analytics.analyticsWindow.label}. All charts
              and KPIs use this timeframe.
            </FitText>
          </div>

          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              as="span"
              style={{
                color: analyticsSupportTextColor,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Start {periodLabel}
            </FitText>
            <FitButton
              data-ui="analytics-period-start"
              variant="field"
              fullWidth
              aria-label={`Start ${periodLabel}: ${formatAnalyticsPeriodTrigger(
                draftTimeMode,
                analytics.draftStartDate,
                `Select start ${periodLabel}`,
              )}`}
              aria-haspopup="dialog"
              aria-expanded={analyticsCalendarTarget === "start"}
              style={dateInputStyle}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
              onClick={() =>
                setAnalyticsCalendarTarget((current) =>
                  current === "start" ? null : "start",
                )
              }
            >
              {formatAnalyticsPeriodTrigger(
                draftTimeMode,
                analytics.draftStartDate,
                `Select start ${periodLabel}`,
              )}
            </FitButton>
          </div>

          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              as="span"
              style={{
                color: analyticsSupportTextColor,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              End {periodLabel}
            </FitText>
            <FitButton
              data-ui="analytics-period-end"
              variant="field"
              fullWidth
              aria-label={`End ${periodLabel}: ${formatAnalyticsPeriodTrigger(
                draftTimeMode,
                analytics.draftEndDate,
                `Select end ${periodLabel}`,
              )}`}
              aria-haspopup="dialog"
              aria-expanded={analyticsCalendarTarget === "end"}
              style={dateInputStyle}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
              onClick={() =>
                setAnalyticsCalendarTarget((current) =>
                  current === "end" ? null : "end",
                )
              }
            >
              {formatAnalyticsPeriodTrigger(
                draftTimeMode,
                analytics.draftEndDate,
                `Select end ${periodLabel}`,
              )}
            </FitButton>
          </div>

          <label style={{ display: "grid", gap: 5 }}>
            <FitText
              as="span"
              style={{
                color: analyticsSupportTextColor,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Time view
            </FitText>
            <FitSelect
              aria-label="Time view"
              value={draftTimeMode}
              onChange={(event) =>
                analytics.setDraftTimeMode(
                  event.target.value as AnalyticsTimeMode,
                )
              }
              options={[...analytics.timeModeOptions]}
              name="analyticsTimeMode"
            />
          </label>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <FitButton
              data-ui="analytics-range-reset"
              variant="ghost"
              label="RESET"
              onClick={analytics.handleResetAnalyticsWindow}
              disabled={!analytics.analyticsWindowDirty}
              style={{ minHeight: 40 }}
            />
            <FitButton
              data-ui="analytics-range-apply"
              variant="primary"
              label="APPLY RANGE"
              onClick={analytics.handleApplyAnalyticsWindow}
              disabled={!analytics.analyticsWindowDirty}
              style={{ minHeight: 40, whiteSpace: "nowrap" }}
            />
          </div>
        </div>

        {shouldShowSection("kpis") ? (
          <div id="analytics-kpis" className="analytics-anchor-section">
            <FitSection
              heading="Performance KPIs"
              bare
              action={
                <FitButton
                  data-ui="analytics-drilldown-trigger"
                  variant="ghost"
                  icon={BarChart3}
                  label="EXPLORE ATTENDANCE"
                  disabled={!latestAttendancePoint}
                  onClick={() => {
                    if (!latestAttendancePoint) return;
                    analytics.handleSelectAttendancePoint(
                      latestAttendancePoint.bucketStart,
                      latestAttendancePoint.label,
                    );
                  }}
                  style={{ minHeight: 34 }}
                  textStyle={{ fontSize: 11 }}
                />
              }
            >
              <div className="analytics-kpi-board analytics-card-grid analytics-card-grid--three">
                {headlinePerformanceKpi ? (
                  <div
                    className="analytics-kpi-headline"
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: recordRadius,
                      background: analyticsSectionGradient,
                      padding: 14,
                    }}
                  >
                    <div
                      className="analytics-inline-icon-row"
                      style={{ gap: 10 }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: controlRadius,
                          backgroundColor: `${colors.brand}18`,
                          color: colors.brand,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <headlinePerformanceKpi.icon size={17} />
                      </div>
                      <div style={{ display: "grid", gap: 2 }}>
                        <FitText
                          as="p"
                          style={{
                            fontSize: 13,
                            color: analyticsSupportTextColor,
                            fontWeight: 700,
                          }}
                        >
                          Headline outcome
                        </FitText>
                        <FitText
                          as="p"
                          style={{ fontSize: 14, color: colors.textPrimary }}
                        >
                          {headlinePerformanceKpi.label}
                        </FitText>
                      </div>
                    </div>
                    <FitText
                      as="p"
                      style={{
                        fontSize: 28,
                        fontWeight: 850,
                        marginTop: 12,
                        lineHeight: 1,
                      }}
                    >
                      {headlinePerformanceKpi.loading
                        ? "--"
                        : headlinePerformanceKpi.value}
                    </FitText>
                    <FitText
                      as="p"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 12.5,
                        marginTop: 8,
                      }}
                    >
                      {analytics.analyticsWindow.label}
                    </FitText>
                  </div>
                ) : null}

                <div
                  className="analytics-kpi-group"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: recordRadius,
                    background: colors.surface,
                    padding: 12,
                  }}
                >
                  <div className="analytics-kpi-group-heading">
                    <FitText as="p" style={{ fontSize: 13, fontWeight: 800 }}>
                      Revenue mix
                    </FitText>
                    <FitText
                      as="p"
                      style={{ color: analyticsSupportTextColor, fontSize: 12 }}
                    >
                      Contributors
                    </FitText>
                  </div>
                  <div className="analytics-kpi-record-list">
                    {revenuePerformanceKpis.map((kpi) => (
                      <div className="analytics-kpi-record" key={kpi.label}>
                        <div
                          className="analytics-inline-icon-row"
                          style={{ gap: 8 }}
                        >
                          <kpi.icon size={15} color={colors.brand} />
                          <FitText
                            as="p"
                            style={{
                              color: analyticsSupportTextColor,
                              fontSize: 12.5,
                            }}
                          >
                            {kpi.label.replace(" Revenue", "")}
                          </FitText>
                        </div>
                        <FitText
                          as="p"
                          style={{ fontSize: 14, fontWeight: 750 }}
                        >
                          {kpi.loading ? "--" : kpi.value}
                        </FitText>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="analytics-kpi-group"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: recordRadius,
                    background: colors.surface,
                    padding: 12,
                  }}
                >
                  <div className="analytics-kpi-group-heading">
                    <FitText as="p" style={{ fontSize: 13, fontWeight: 800 }}>
                      Member activity
                    </FitText>
                    <FitText
                      as="p"
                      style={{ color: analyticsSupportTextColor, fontSize: 12 }}
                    >
                      {analytics.analyticsWindow.label}
                    </FitText>
                  </div>
                  <div className="analytics-kpi-record-list">
                    {operationsPerformanceKpis.map((kpi) => (
                      <div className="analytics-kpi-record" key={kpi.label}>
                        <div
                          className="analytics-inline-icon-row"
                          style={{ gap: 8 }}
                        >
                          <kpi.icon size={15} color={colors.brand} />
                          <FitText
                            as="p"
                            style={{
                              color: analyticsSupportTextColor,
                              fontSize: 12.5,
                            }}
                          >
                            {kpi.label}
                          </FitText>
                        </div>
                        <FitText
                          as="p"
                          style={{ fontSize: 14, fontWeight: 750 }}
                        >
                          {kpi.loading ? "--" : kpi.value}
                        </FitText>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <AnalyticsPresentationGrid
                attendanceSeries={analytics.attendanceSeries}
                colors={colors}
                periodLabel={analytics.analyticsWindow.label}
                revenueSeries={analytics.revenueSeries}
              />
            </FitSection>
          </div>
        ) : null}

        {shouldShowSection("insights") ? (
          <div id="analytics-insights" className="analytics-anchor-section">
            <FitSection heading="AI Insights" bare>
              <div
                className="analytics-ai-panel"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: panelRadius,
                  background: analyticsRaisedGradient,
                  padding: 12,
                  display: "grid",
                  gap: 12,
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
                      <FitText
                        as="p"
                        style={{
                          fontSize: 11.5,
                          color: analyticsSupportTextColor,
                        }}
                      >
                        Generate a focused readout, then export the selected
                        report sections.
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
                      disabled={
                        analytics.isGeneratingInsight ||
                        analytics.selectedInsightSections.length === 0
                      }
                      style={{
                        minHeight: 34,
                        borderRadius: 8,
                        paddingInline: 12,
                      }}
                      textStyle={{ fontSize: 11.5 }}
                    />
                  </div>
                </div>

                <div className="analytics-insight-control-grid">
                  <fieldset className="analytics-insight-control-fieldset">
                    <legend>Insight sections</legend>
                    <FitText
                      as="p"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 11.5,
                        lineHeight: 1.4,
                      }}
                    >
                      Select one or more sections for this saved readout.{" "}
                      Selected: {selectedInsightSectionsLabel || "none"}.
                    </FitText>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          aria-label="Select insight sections"
                          className="analytics-insight-section-trigger"
                          style={{
                            background: colors.surfaceRaised,
                            border: `1px solid ${colors.border}`,
                            borderRadius: controlRadius,
                            color: colors.textPrimary,
                          }}
                        >
                          <span className="analytics-insight-section-trigger-value">
                            <FitText
                              as="span"
                              excludeGlobalScale
                              style={{
                                color: "inherit",
                                fontSize: 12.5,
                                fontWeight: 750,
                              }}
                            >
                              {selectedInsightSectionsTriggerLabel}
                            </FitText>
                          </span>
                          <ChevronDown size={15} aria-hidden="true" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          align="start"
                          className="analytics-insight-section-menu"
                          sideOffset={8}
                          style={{
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                            borderRadius: controlRadius,
                            minWidth:
                              "var(--radix-dropdown-menu-trigger-width)",
                          }}
                        >
                          {analytics.insightSectionOptions.map((option) => {
                            const isSelected =
                              analytics.selectedInsightSections.includes(
                                option.value,
                              );

                            return (
                              <DropdownMenu.CheckboxItem
                                key={option.value}
                                aria-label={`Include ${option.label} insight section`}
                                checked={isSelected}
                                className="analytics-insight-section-item"
                                onCheckedChange={(checked) => {
                                  if (checked !== isSelected) {
                                    analytics.handleToggleInsightSection(
                                      option.value,
                                    );
                                  }
                                }}
                                onSelect={(event) => event.preventDefault()}
                                style={{
                                  borderRadius: Math.max(6, controlRadius - 2),
                                  color: colors.textPrimary,
                                }}
                              >
                                <FitText
                                  as="span"
                                  excludeGlobalScale
                                  style={{
                                    color: "inherit",
                                    fontSize: 12,
                                    fontWeight: isSelected ? 800 : 650,
                                  }}
                                >
                                  {option.label}
                                </FitText>
                                <span
                                  className="analytics-insight-section-check"
                                  aria-hidden="true"
                                >
                                  {isSelected ? (
                                    <Check size={14} color={fitTrackOrange} />
                                  ) : null}
                                </span>
                              </DropdownMenu.CheckboxItem>
                            );
                          })}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </fieldset>

                  <fieldset className="analytics-insight-control-fieldset">
                    <legend>Analysis depth</legend>
                    <FitText
                      as="p"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 11.5,
                        lineHeight: 1.4,
                      }}
                    >
                      Choose how much context the model should write.
                    </FitText>
                    <FitSelect
                      aria-label="Analysis depth"
                      compact
                      fullWidth
                      options={analytics.analysisDepthOptions.map(
                        ({ label, value }) => ({ label, value }),
                      )}
                      onChange={(event) => {
                        const nextOption = analytics.analysisDepthOptions.find(
                          (option) => option.value === event.target.value,
                        );
                        if (nextOption) {
                          analytics.handleSetInsightDepth(nextOption.value);
                        }
                      }}
                      style={{ width: "100%" }}
                      value={analytics.selectedInsightDepth}
                    />
                    <FitText
                      as="p"
                      className="analytics-insight-depth-description"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 10.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedInsightDepthOption?.description}
                    </FitText>
                  </fieldset>
                </div>

                <div
                  className="analytics-ai-generated-card"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: controlRadius,
                    background: analytics.latestInsightIsFallback
                      ? analyticsFallbackGradient
                      : analyticsSectionGradient,
                    display: "grid",
                    gap: 8,
                    minHeight: 0,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      alignItems: "flex-start",
                      display: "flex",
                      gap: 10,
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "grid", gap: 3 }}>
                      <FitText
                        as="p"
                        style={{
                          color: colors.textPrimary,
                          fontSize: 12,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        {hasLatestInsight
                          ? analytics.latestInsightIsFallback
                            ? "Dashboard Insight: " + latestInsightSectionsLabel
                            : "Saved AI Insight: " + latestInsightSectionsLabel
                          : "No AI insight generated"}
                      </FitText>
                      <FitText
                        as="p"
                        style={{
                          color: analyticsSupportTextColor,
                          fontSize: 11.5,
                          lineHeight: 1.4,
                        }}
                      >
                        {hasLatestInsight
                          ? "Generated " +
                            formatDateTime(analytics.latestInsight!.createdAt)
                          : "Generate a focused readout when a decision needs deeper context."}
                      </FitText>
                      {hasLatestInsight ? (
                        <>
                          <div className="analytics-insight-meta">
                            <span>
                              Window ·{" "}
                              {formatAnalyticsInsightDate(
                                analytics.latestInsight!.startDate,
                              )}{" "}
                              –{" "}
                              {formatAnalyticsInsightDate(
                                analytics.latestInsight!.endDate,
                              )}
                            </span>
                            <span>
                              Filter · {analytics.latestInsight!.period}
                            </span>
                            <span>Depth · {latestInsightDepthLabel}</span>
                            <span>Sections · {latestInsightSectionsLabel}</span>
                          </div>
                          <div className="analytics-insight-status-row">
                            <span
                              className={
                                analytics.latestInsightIsStale
                                  ? "analytics-insight-status analytics-insight-status--stale"
                                  : "analytics-insight-status"
                              }
                              role="status"
                            >
                              {analytics.latestInsightIsStale
                                ? "STALE · FILTER MISMATCH"
                                : "MATCHES CURRENT FILTERS"}
                            </span>
                            {analytics.latestInsightIsStale ? (
                              <FitText
                                as="span"
                                style={{
                                  color: colors.warning,
                                  fontSize: 10.5,
                                }}
                              >
                                Saved insight uses a different dashboard date or
                                time filter.
                              </FitText>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="analytics-insight-card-actions">
                      {analytics.latestInsightIsFallback ? (
                        <div
                          className="analytics-inline-icon-row"
                          style={{
                            gap: 7,
                            justifyContent: "flex-end",
                            color: analyticsSupportTextColor,
                          }}
                        >
                          <BarChart3
                            size={13}
                            color={analyticsSupportTextColor}
                          />
                          <FitText
                            as="p"
                            style={{
                              fontSize: 12,
                              color: analyticsSupportTextColor,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Dashboard data
                          </FitText>
                        </div>
                      ) : null}
                      {hasLatestInsight ? (
                        <FitButton
                          variant="ghost"
                          icon={Download}
                          label={
                            analytics.isExportingInsightPdf
                              ? "PREPARING PDF..."
                              : "EXPORT PDF"
                          }
                          onClick={() => {
                            openInsightExportModal();
                          }}
                          disabled={analytics.isExportingInsightPdf}
                          style={{ minHeight: 32, whiteSpace: "nowrap" }}
                          textStyle={{ fontSize: 11 }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div
                    className="analytics-ai-generated-body"
                    style={{
                      display: "block",
                      minHeight: 0,
                      overflow: "auto",
                    }}
                  >
                    {analytics.latestInsightLoading ? (
                      <FitText
                        as="p"
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: colors.textPrimary,
                        }}
                      >
                        Loading the latest business insight...
                      </FitText>
                    ) : (
                      <AiFormattedText
                        compact
                        text={
                          analytics.latestInsight?.summary ??
                          "No generated insight yet. Use Generate AI Insights to create a fresh business readout."
                        }
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: colors.textPrimary,
                        }}
                      />
                    )}
                  </div>

                  <div className="analytics-ai-evidence-grid">
                    <div className="analytics-ai-evidence-section">
                      <FitText as="p" className="analytics-ai-evidence-heading">
                        Top highlights
                      </FitText>
                      {latestHighlights.length ? (
                        <ul className="analytics-ai-evidence-list">
                          {latestHighlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      ) : (
                        <FitText as="p" className="analytics-ai-evidence-empty">
                          No evidence-backed highlights are attached yet.
                        </FitText>
                      )}
                    </div>
                    <div className="analytics-ai-evidence-section">
                      <FitText as="p" className="analytics-ai-evidence-heading">
                        Priority risks & anomalies
                      </FitText>
                      {latestPriorityRisks.length ? (
                        <ul className="analytics-ai-evidence-list analytics-ai-evidence-list--risk">
                          {latestPriorityRisks.map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      ) : (
                        <FitText as="p" className="analytics-ai-evidence-empty">
                          No priority risk is attached to this insight.
                        </FitText>
                      )}
                    </div>
                  </div>

                  <div className="analytics-ai-recommendations">
                    <FitText
                      as="p"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 10.5,
                        fontWeight: 850,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      Recommended Actions
                    </FitText>
                    {recommendedActionGroups.length ? (
                      <div className="analytics-ai-recommendation-groups">
                        {recommendedActionGroups.map(([concern, actions]) => (
                          <div
                            key={concern}
                            className="analytics-ai-recommendation-group"
                          >
                            <FitText
                              as="p"
                              style={{
                                color: fitTrackOrange,
                                fontSize: 11.5,
                                fontWeight: 500,
                              }}
                            >
                              {concern}
                            </FitText>
                            <ul
                              className="analytics-ai-action-list"
                              style={{ color: analyticsSupportTextColor }}
                            >
                              {actions.map((action) => (
                                <li key={`${concern}-${action}`}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <FitText
                        as="p"
                        style={{
                          color: analyticsSupportTextColor,
                          fontSize: 11.5,
                          lineHeight: 1.35,
                        }}
                      >
                        No recommended actions are attached to this insight yet.
                      </FitText>
                    )}
                  </div>
                </div>
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
                <FitText
                  style={{ fontSize: 12, color: analyticsSupportTextColor }}
                >
                  {liveAlertLabel}
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
                          padding: "9px 10px",
                          cursor: "pointer",
                          background:
                            index % 2 === 0
                              ? analyticsRaisedGradient
                              : analyticsSectionGradient,
                          border: `1px solid ${colors.border}`,
                          borderRadius: recordRadius,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: controlRadius,
                            backgroundColor: `${fitTrackOrange}18`,
                            color: fitTrackOrange,
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
                            style={{ fontSize: 13.5, fontWeight: 850 }}
                          >
                            {alert.title}
                          </FitText>
                          <FitText
                            as="p"
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: analyticsSupportTextColor,
                            }}
                          >
                            {getAlertLaneLabel(alert.kind)}
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
                          className="analytics-alert-action"
                          style={{
                            alignItems: "center",
                            color: fitTrackOrange,
                            display: "inline-flex",
                            fontSize: 11,
                            fontWeight: 800,
                            gap: 5,
                            gridColumn: "3",
                            justifySelf: "end",
                            letterSpacing: "0.08em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span>{alert.actionLabel}</span>
                          <ArrowRight size={13} />
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
            <FitSection heading="Range Insights" bare>
              <div className="analytics-card-grid analytics-card-grid--three">
                {dailyInsightCards.map((card) => (
                  <div
                    key={card.label}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: recordRadius,
                      background: analyticsRaisedGradient,
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
                        style={{
                          fontSize: 12,
                          color: analyticsSupportTextColor,
                        }}
                      >
                        {card.label}
                      </FitText>
                      <FitText
                        as="p"
                        style={{ fontSize: 23, fontWeight: 800, marginTop: 3 }}
                      >
                        {card.loading ? "--" : card.value}
                      </FitText>
                    </div>
                    <FitText
                      as="p"
                      style={{
                        fontSize: 12,
                        color: analyticsSupportTextColor,
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

        {shouldShowSection("revenue") ? (
          <div id="analytics-revenue" className="analytics-anchor-section">
            <FitSection heading="Revenue" bare>
              <div
                className="analytics-revenue-board"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: panelRadius,
                  background: analyticsSectionGradient,
                  padding: 12,
                }}
              >
                <div className="analytics-revenue-summary">
                  <div className="analytics-revenue-filter-row">
                    <div style={{ display: "grid", gap: 3, minWidth: 180 }}>
                      <FitText
                        as="p"
                        style={{
                          fontSize: 12,
                          color: analyticsSupportTextColor,
                        }}
                      >
                        {analytics.revenueWindow.label}
                      </FitText>
                      <FitText
                        as="p"
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: analyticsSupportTextColor,
                        }}
                      >
                        {selectedRevenueLabel}
                      </FitText>
                    </div>
                    <div className="analytics-revenue-filter-controls">
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
                      color: analyticsSupportTextColor,
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
                      height: 340,
                    }}
                  >
                    <FitText
                      as="p"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: analyticsSupportTextColor,
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
                      initialDimension={{ width: 680, height: 300 }}
                    >
                      <BarChart data={analytics.revenueSeries}>
                        <CartesianGrid
                          stroke={`${colors.border}88`}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="bucket"
                          stroke={analyticsSupportTextColor}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          stroke={analyticsSupportTextColor}
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
                        color: analyticsSupportTextColor,
                      }}
                    >
                      Revenue mix
                    </FitText>
                    {topRevenueSources.length ? (
                      <div className="analytics-source-card-grid">
                        {topRevenueSources.map((source) => (
                          <div
                            key={source.sourceKey}
                            className="analytics-source-row"
                            style={{
                              display: "grid",
                              gap: 8,
                              gridTemplateColumns: "minmax(0, 1fr) auto",
                              padding: "8px 0",
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            <div style={{ display: "grid", gap: 2 }}>
                              <FitText
                                as="p"
                                style={{ fontSize: 13, fontWeight: 750 }}
                              >
                                {source.sourceLabel}
                              </FitText>
                              <FitText
                                as="p"
                                style={{
                                  fontSize: 12,
                                  color: analyticsSupportTextColor,
                                }}
                              >
                                {source.sharePercentage.toFixed(1)}% of revenue
                              </FitText>
                            </div>
                            <FitText
                              as="p"
                              style={{
                                alignSelf: "center",
                                fontSize: 14,
                                fontWeight: 800,
                              }}
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
                          background: analyticsSectionGradient,
                        }}
                      >
                        <FitText
                          as="p"
                          style={{
                            fontSize: 13,
                            color: analyticsSupportTextColor,
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
      </div>

      <FitModal
        isOpen={analytics.isGeneratingInsight}
        onClose={() => undefined}
        title="Generating AI insights"
        subtitle="Analyzing your selected dashboard data. This may take a moment."
        icon={Sparkles}
        maxWidth={440}
        closeDisabled
        noScroll
        contentStyle={{
          display: "grid",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Generating AI insights"
          style={{
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          <div
            className="analytics-generation-spinner-row"
            style={{ color: colors.textPrimary }}
          >
            <span
              className="analytics-generation-spinner"
              aria-hidden="true"
              style={{ color: fitTrackOrange }}
            >
              <Sparkles size={18} />
            </span>
            <FitText
              as="p"
              style={{
                color: "inherit",
                fontSize: 14,
                fontWeight: 800,
                minWidth: 0,
              }}
            >
              Preparing your selected readout
            </FitText>
          </div>
          <FitText
            as="p"
            style={{
              color: analyticsSupportTextColor,
              fontSize: 12,
              lineHeight: 1.5,
              minWidth: 0,
            }}
          >
            Sections: {selectedInsightSectionsLabel || "none"}. Depth:{" "}
            {selectedInsightDepthOption?.label ?? "Brief"}.
          </FitText>
        </div>
      </FitModal>

      <AnalyticsPeriodCalendarModal
        mode={calendarMode}
        isOpen={analyticsCalendarTarget !== null}
        selectedValue={calendarSelectedValue}
        minValue={
          analyticsCalendarTarget === "end"
            ? (calendarOtherValue ?? null)
            : null
        }
        maxValue={
          analyticsCalendarTarget === "start"
            ? (calendarOtherValue ?? null)
            : null
        }
        onSelect={(dateYmd) => {
          if (analyticsCalendarTarget === "start") {
            analytics.setDraftStartDate(dateYmd);
          } else if (analyticsCalendarTarget === "end") {
            analytics.setDraftEndDate(dateYmd);
          }
        }}
        onClose={() => setAnalyticsCalendarTarget(null)}
      />

      <FitModal
        isOpen={isInsightExportModalOpen}
        onClose={() => setIsInsightExportModalOpen(false)}
        title="Export AI Insight PDF"
        subtitle="Choose whether to include a previous-insight comparison."
        icon={Download}
        maxWidth={640}
        closeDisabled={analytics.isExportingInsightPdf}
        footer={
          <div className="analytics-insight-export-footer">
            <FitButton
              variant="ghost"
              label="CANCEL"
              onClick={() => setIsInsightExportModalOpen(false)}
              disabled={analytics.isExportingInsightPdf}
            />
            <FitButton
              variant="primary"
              icon={Download}
              label={
                analytics.isExportingInsightPdf
                  ? "PREPARING PDF..."
                  : "EXPORT PDF"
              }
              onClick={exportInsightPdf}
              disabled={analytics.isExportingInsightPdf}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <FitText
            as="p"
            style={{
              color: analyticsSupportTextColor,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            Optionally compare this insight with a previous generated AI
            insight. If no previous insight is manually selected, the latest
            previous insight will be used automatically. The comparison runs one
            additional AI analysis and its verdict will appear in the exported
            PDF.
          </FitText>

          <label
            style={{
              alignItems: "center",
              cursor: analytics.isExportingInsightPdf ? "default" : "pointer",
              display: "flex",
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              checked={comparePreviousInsight}
              onChange={(event) =>
                setComparePreviousInsight(event.target.checked)
              }
              disabled={analytics.isExportingInsightPdf}
              style={{
                accentColor: fitTrackOrange,
                height: 18,
                width: 18,
              }}
            />
            <FitText
              as="span"
              style={{
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Compare with previous AI insight
            </FitText>
          </label>

          {comparePreviousInsight ? (
            <div
              style={{
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                borderRadius: controlRadius,
                display: "grid",
                gap: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText
                  as="p"
                  style={{
                    color: analyticsSupportTextColor,
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Comparison source
                </FitText>
                {comparisonSourceInsight ? (
                  <>
                    <FitText
                      as="p"
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {selectedPreviousInsight
                        ? "Selected previous insight"
                        : "Latest previous insight (automatic)"}
                    </FitText>
                    <FitText
                      as="p"
                      style={{
                        color: analyticsSupportTextColor,
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {formatAnalyticsInsightDate(
                        comparisonSourceInsight.createdAt,
                      )}
                      {" · "}
                      {formatBusinessInsightSections(
                        comparisonSourceInsight,
                        analytics.insightSectionOptions,
                      )}
                    </FitText>
                  </>
                ) : (
                  <FitText
                    as="p"
                    style={{
                      color: analyticsSupportTextColor,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    No previous AI insight is available. The PDF will show N/A -
                    Insufficient Data.
                  </FitText>
                )}
              </div>
              <div>
                <FitButton
                  variant="ghost"
                  label="CHOOSE PREVIOUS INSIGHT"
                  onClick={openInsightHistoryModal}
                  disabled={analytics.isExportingInsightPdf}
                  style={{ minHeight: 34 }}
                  textStyle={{ fontSize: 11 }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </FitModal>

      <FitModal
        isOpen={isInsightHistoryModalOpen}
        onClose={returnToInsightExportModal}
        title="Select Previous AI Insight"
        subtitle="Choose one saved insight generated before the current insight."
        icon={Sparkles}
        maxWidth={780}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <FitButton
              variant="ghost"
              label="BACK"
              onClick={returnToInsightExportModal}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div className="analytics-insight-history-filters">
            <input
              aria-label="Search previous AI insights"
              type="search"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Search saved insights..."
              style={{
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                borderRadius: controlRadius,
                color: colors.textPrimary,
                minHeight: 40,
                minWidth: 0,
                padding: "0 12px",
                width: "100%",
              }}
            />
            <FitSelect
              aria-label="Filter previous insights by focus"
              compact
              fullWidth
              options={[
                { label: "All sections", value: "all" },
                ...analytics.insightSectionOptions,
              ]}
              value={historyFocusFilter}
              onChange={(event) =>
                setHistoryFocusFilter(
                  event.target.value as BusinessInsightFocus | "all",
                )
              }
            />
            <FitSelect
              aria-label="Filter previous insights by period"
              compact
              fullWidth
              options={[
                { label: "All periods", value: "all" },
                ...historyPeriodOptions.map((period) => ({
                  label: formatAnalyticsInsightDepth(period),
                  value: period,
                })),
              ]}
              value={historyPeriodFilter}
              onChange={(event) =>
                setHistoryPeriodFilter(
                  event.target.value as BusinessInsightPeriod | "all",
                )
              }
            />
          </div>

          {analytics.insightHistoryLoading ? (
            <FitText
              as="p"
              style={{ color: analyticsSupportTextColor, fontSize: 12.5 }}
            >
              Loading previous AI insights...
            </FitText>
          ) : filteredPreviousInsights.length ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: "min(52vh, 520px)",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {filteredPreviousInsights.map((insight) => {
                const isSelected = insight.id === selectedPreviousInsightId;
                return (
                  <div
                    key={insight.id}
                    className="analytics-insight-history-row"
                    style={{
                      alignItems: "center",
                      backgroundColor: isSelected
                        ? `${fitTrackOrange}0c`
                        : colors.surfaceRaised,
                      border: `1px solid ${
                        isSelected ? `${fitTrackOrange}88` : colors.border
                      }`,
                      borderRadius: controlRadius,
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                      <FitText
                        as="p"
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {formatAnalyticsInsightDate(insight.createdAt)}
                      </FitText>
                      <FitText
                        as="p"
                        style={{
                          color: analyticsSupportTextColor,
                          fontSize: 11.5,
                        }}
                      >
                        {formatBusinessInsightSections(
                          insight,
                          analytics.insightSectionOptions,
                        )}
                        {" · "}
                        {formatAnalyticsInsightDepth(insight.period)}
                      </FitText>
                      <FitText
                        as="p"
                        style={{
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          color: analyticsSupportTextColor,
                          display: "-webkit-box",
                          fontSize: 12,
                          lineHeight: 1.45,
                          overflow: "hidden",
                        }}
                      >
                        {insight.summary}
                      </FitText>
                    </div>
                    <FitButton
                      variant={isSelected ? "primary" : "ghost"}
                      label="SELECT"
                      onClick={() => selectPreviousInsight(insight.id)}
                      style={{ minHeight: 34 }}
                      textStyle={{ fontSize: 11 }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <FitText
              as="p"
              style={{
                color: analyticsSupportTextColor,
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              {previousInsightOptions.length === 0
                ? "No previous AI insights are available."
                : "No previous insights match the current filters."}
            </FitText>
          )}
        </div>
      </FitModal>

      <FitModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title="Export Analytics PDF"
        subtitle="Choose the current dashboard sections to download."
        icon={Download}
        maxWidth={780}
        footer={
          <div className="analytics-pdf-modal-footer">
            <FitText
              as="p"
              style={{ color: analyticsSupportTextColor, fontSize: 12.5 }}
            >
              {analytics.selectedPdfSections.length} of{" "}
              {analytics.pdfExportSectionOptions.length} sections selected
            </FitText>
            <FitButton
              variant="primary"
              icon={Download}
              label={
                analytics.isExportingPdf ? "PREPARING PDF..." : "EXPORT PDF"
              }
              onClick={() => {
                void analytics.handleExportPdf().then((exported) => {
                  if (exported) setIsPdfModalOpen(false);
                });
              }}
              disabled={
                analytics.isExportingPdf ||
                analytics.selectedPdfSections.length === 0
              }
            />
          </div>
        }
      >
        <div className="analytics-pdf-modal-grid">
          {analytics.pdfExportSectionOptions.map((option) => {
            const isSelected = analytics.selectedPdfSections.includes(
              option.value,
            );

            return (
              <label
                key={option.value}
                className="analytics-pdf-option-card"
                style={{
                  border: `1px solid ${
                    isSelected ? `${fitTrackOrange}88` : colors.border
                  }`,
                  borderRadius: controlRadius,
                  background: isSelected
                    ? `radial-gradient(ellipse 52% 48% at 0% 0%, ${fitTrackOrange}0c 0%, transparent 100%), ${colors.surfaceRaised}`
                    : colors.surface,
                  cursor: "pointer",
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  minHeight: 112,
                  padding: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() =>
                    analytics.handleTogglePdfSection(option.value)
                  }
                  style={{
                    accentColor: fitTrackOrange,
                    height: 17,
                    marginTop: 2,
                    width: 17,
                  }}
                />
                <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
                  <FitText
                    as="p"
                    style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {option.label}
                  </FitText>
                  <FitText
                    as="p"
                    style={{
                      color: analyticsSupportTextColor,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {PDF_EXPORT_SECTION_DESCRIPTIONS[option.value] ??
                      "Include this analytics section in the PDF export."}
                  </FitText>
                </div>
              </label>
            );
          })}
        </div>
      </FitModal>
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
              <div
                style={{
                  height: 320,
                  display: "grid",
                  gridTemplateRows: "auto minmax(0, 1fr)",
                  gap: 8,
                }}
              >
                <FitText
                  as="p"
                  style={{
                    color: analyticsSupportTextColor,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Daily check-ins
                </FitText>
                <div style={{ minHeight: 0 }}>
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={1}
                    minHeight={1}
                    initialDimension={{ width: 560, height: 286 }}
                  >
                    <BarChart data={analytics.drilldownSeries}>
                      <CartesianGrid
                        stroke={`${colors.border}88`}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke={analyticsSupportTextColor}
                        interval="preserveStartEnd"
                        minTickGap={24}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke={analyticsSupportTextColor}
                        tick={{ fontSize: 12 }}
                      />
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
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                      color: analyticsSupportTextColor,
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
              gap: 12,
            }}
          >
            <div className="analytics-drilldown-summary">
              <div>
                <FitText
                  as="p"
                  style={{ fontSize: 13, color: analyticsSupportTextColor }}
                >
                  Selected Slice
                </FitText>
                <FitText
                  as="p"
                  style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
                >
                  {analytics.selectedDrilldown?.label ?? "--"}
                </FitText>
              </div>
              <div>
                <FitText
                  as="p"
                  style={{ fontSize: 13, color: analyticsSupportTextColor }}
                >
                  Check-ins in View
                </FitText>
                <FitText
                  as="p"
                  style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
                >
                  {analytics.drilldownAttendance?.totalCheckIns ??
                    analytics.attendance?.totalCheckIns ??
                    0}
                </FitText>
              </div>
            </div>
            <div>
              <FitText
                as="p"
                style={{
                  fontSize: 13,
                  color: analyticsSupportTextColor,
                  fontWeight: 700,
                }}
              >
                Peak attendance
              </FitText>
              <FitText
                as="p"
                style={{
                  color: analyticsSupportTextColor,
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  marginTop: 3,
                }}
              >
                {peakHourSummary}
              </FitText>
              <div
                className="analytics-peak-signal-grid"
                style={{ marginTop: 8 }}
              >
                {drilldownPeakHours.map((peak) => (
                  <div
                    key={peak.hourLabel}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: controlRadius,
                      padding: "9px 10px",
                      backgroundColor: colors.surfaceRaised,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <FitText
                      as="p"
                      style={{
                        fontSize: 13,
                        color: analyticsSupportTextColor,
                      }}
                    >
                      {peak.hourLabel}
                    </FitText>
                    <FitText as="p" style={{ fontSize: 15, fontWeight: 700 }}>
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

        .analytics-anchor-section,
        .analytics-operations-stack {
          min-width: 0;
        }

        .analytics-anchor-section {
          scroll-margin-top: 112px;
        }

        .analytics-shell--all #analytics-insights {
          grid-column: 1 / -1;
          grid-row: 4;
        }

        .analytics-shell--all .analytics-date-range-panel {
          grid-row: 2;
        }

        .analytics-shell--all #analytics-alerts {
          grid-column: 1 / -1;
          grid-row: 5;
          align-self: start;
        }

        .analytics-shell--all #analytics-daily {
          grid-column: 1 / -1;
          grid-row: 6;
        }

        .analytics-shell--all #analytics-kpis {
          grid-column: 1 / -1;
          grid-row: 3;
        }

        .analytics-shell--all #analytics-revenue {
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
          grid-template-rows: auto minmax(0, 1fr);
          min-width: 0;
        }

        .analytics-shell--insights .analytics-ai-panel {
          height: 568px;
        }

        .analytics-shell--all .analytics-ai-panel {
          height: auto;
        }

        .analytics-ai-command-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          padding-bottom: 6px;
        }

        .analytics-section-filter-actions {
          flex: 0 0 auto;
          margin-left: auto;
        }

        .analytics-insight-control-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.9fr);
          gap: 10px;
        }

        .analytics-insight-control-fieldset {
          min-width: 0;
          margin: 0;
          padding: 9px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          display: grid;
          gap: 7px;
        }

        .analytics-insight-control-fieldset legend {
          padding: 0 5px;
          color: inherit;
          font-size: 10.5px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .analytics-insight-section-trigger {
          align-items: center;
          cursor: pointer;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          min-height: 38px;
          min-width: 0;
          padding: 0 11px;
          text-align: left;
          width: 100%;
        }

        .analytics-insight-section-trigger:focus-visible {
          outline: 2px solid var(--fit-brand);
          outline-offset: 2px;
        }

        .analytics-insight-section-trigger-value {
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .analytics-insight-section-menu {
          max-height: min(340px, var(--radix-dropdown-menu-content-available-height));
          overflow-y: auto;
          padding: 6px;
          z-index: 1600;
        }

        .analytics-insight-section-item {
          align-items: center;
          border: 1px solid transparent;
          cursor: pointer;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-height: 34px;
          outline: none;
          padding: 0 9px;
        }

        .analytics-insight-section-item[data-highlighted],
        .analytics-insight-section-item[data-state="checked"] {
          background: ${fitTrackOrange}14;
          border-color: ${fitTrackOrange}55;
        }

        .analytics-insight-section-item:focus-visible {
          outline: 2px solid var(--fit-brand);
          outline-offset: -2px;
        }

        .analytics-insight-section-check {
          align-items: center;
          display: inline-flex;
          flex: 0 0 16px;
          justify-content: center;
        }

        .analytics-insight-depth-description {
          min-height: 27px;
        }

        .analytics-insight-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 9px;
          margin-top: 2px;
          color: inherit;
          font-size: 10.5px;
          line-height: 1.35;
        }

        .analytics-insight-meta span {
          overflow-wrap: anywhere;
        }

        .analytics-insight-status-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 2px;
        }

        .analytics-insight-status {
          border: 1px solid rgba(74, 222, 128, 0.45);
          border-radius: 999px;
          color: #86efac;
          font-size: 9.5px;
          font-weight: 850;
          letter-spacing: 0.08em;
          padding: 3px 7px;
          text-transform: uppercase;
        }

        .analytics-insight-status--stale {
          border-color: rgba(251, 191, 36, 0.7);
          color: #fbbf24;
        }

        .analytics-insight-card-actions {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: flex-start;
        }

        .analytics-generation-spinner-row {
          align-items: center;
          display: flex;
          gap: 9px;
          min-width: 0;
        }

        .analytics-generation-spinner {
          animation: analytics-generation-spin 1.15s linear infinite;
          display: inline-flex;
          flex: 0 0 auto;
        }

        @keyframes analytics-generation-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .analytics-generation-spinner {
            animation: none;
          }
        }

        .analytics-ai-generated-card {
          grid-template-rows: auto auto minmax(0, 1fr) 144px;
        }

        .analytics-shell--all .analytics-ai-generated-card {
          grid-template-rows: auto auto auto auto;
        }

        .analytics-shell--all .analytics-ai-generated-body {
          max-height: 132px;
        }

        .analytics-shell--all .analytics-ai-recommendations {
          max-height: 144px;
        }

        .analytics-ai-recommendations {
          border-top: 1px solid ${colors.border};
          display: grid;
          gap: 7px;
          min-height: 0;
          overflow: auto;
          padding-top: 9px;
        }

        .analytics-ai-recommendation-groups {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-auto-flow: row;
          grid-auto-rows: auto;
          align-content: start;
          align-items: start;
          justify-content: start;
          gap: 8px 14px;
          min-height: 0;
        }

        .analytics-ai-recommendation-group {
          min-width: 0;
        }

        .analytics-ai-action-list {
          display: grid;
          gap: 4px;
          font-size: 11.5px;
          line-height: 1.35;
          list-style-position: outside;
          list-style-type: disc;
          margin: 3px 0 0;
          padding-left: 17px;
        }

        .analytics-ai-action-list li {
          padding-left: 1px;
        }

        .analytics-ai-action-list li::marker {
          color: ${analyticsSupportTextColor};
        }

        .analytics-card-grid {
          display: grid;
          gap: 10px;
        }

        .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .analytics-ai-evidence-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          min-height: 0;
        }

        .analytics-ai-evidence-section {
          background: ${colors.surfaceRaised};
          border: 1px solid ${colors.border};
          border-radius: ${controlRadius}px;
          display: grid;
          align-content: start;
          gap: 6px;
          min-width: 0;
          padding: 9px 10px;
        }

        .analytics-ai-evidence-heading {
          color: ${analyticsSupportTextColor};
          font-size: 10.5px;
          font-weight: 850;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .analytics-ai-evidence-list {
          color: ${colors.textPrimary};
          display: grid;
          gap: 5px;
          font-size: 11.5px;
          line-height: 1.4;
          list-style-position: outside;
          margin: 0;
          padding-left: 17px;
        }

        .analytics-ai-evidence-list li::marker {
          color: ${fitTrackOrange};
        }

        .analytics-ai-evidence-list--risk li::marker {
          color: ${colors.warning};
        }

        .analytics-ai-evidence-empty {
          color: ${analyticsSupportTextColor};
          font-size: 11.5px;
          line-height: 1.4;
        }

        .analytics-kpi-board {
          display: grid;
          grid-template-columns: minmax(230px, 0.8fr) minmax(270px, 1fr) minmax(270px, 1fr);
          gap: 10px;
          align-items: stretch;
        }

        .analytics-presentation-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
          gap: 10px;
          margin-top: 10px;
        }

        .analytics-presentation-wide {
          grid-column: 1 / -1;
        }

        .analytics-composition-layout {
          align-items: center;
          display: grid;
          grid-template-columns: minmax(170px, 1fr) minmax(150px, 0.75fr);
          gap: 6px;
          padding: 8px;
        }

        .analytics-composition-legend {
          display: grid;
          gap: 10px;
          padding-right: 10px;
        }

        .analytics-composition-row {
          align-items: center;
          display: flex;
          gap: 7px;
          min-width: 0;
        }

        .analytics-chart-empty {
          align-items: center;
          color: ${analyticsSupportTextColor};
          display: flex;
          font-size: 13px;
          height: 100%;
          justify-content: center;
          line-height: 1.5;
          min-height: 180px;
          padding: 20px;
          text-align: center;
        }

        .analytics-kpi-headline {
          min-height: 0;
        }

        .analytics-kpi-group,
        .analytics-kpi-headline {
          min-width: 0;
        }

        .analytics-kpi-group-heading,
        .analytics-kpi-record {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .analytics-kpi-group-heading {
          border-bottom: 1px solid ${colors.border};
          padding-bottom: 8px;
        }

        .analytics-kpi-record-list {
          display: grid;
        }

        .analytics-kpi-record {
          min-height: 35px;
          padding: 7px 0;
        }

        .analytics-kpi-record + .analytics-kpi-record {
          border-top: 1px solid ${colors.border};
        }

        .analytics-alert-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        #analytics-alerts .analytics-alert-grid {
          grid-template-columns: 1fr;
          max-height: 450px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        #analytics-alerts .analytics-alert-grid::-webkit-scrollbar {
          display: none;
        }


        #analytics-daily .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        #analytics-kpis .analytics-card-grid--three {
          grid-template-columns: repeat(3, minmax(220px, 1fr));
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
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: start;
        }

        .analytics-operations-stack {
          display: grid;
          gap: 10px;
        }

        .analytics-revenue-chart {
          display: grid;
          grid-template-columns: 1fr;
          gap: 26px;
          align-items: start;
        }

        .analytics-revenue-summary {
          display: grid;
          gap: 10px;
          min-width: 0;
          align-content: start;
        }

        .analytics-revenue-filter-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .analytics-revenue-filter-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .analytics-revenue-filter-controls select {
          min-width: 152px;
        }

        .analytics-source-list {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .analytics-source-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }

        .analytics-source-row {
          min-width: 0;
        }

        .analytics-source-row:last-child {
          border-bottom: none !important;
        }

        .analytics-attendance-grid {
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.75fr);
          align-items: start;
        }

        .analytics-attendance-chart-card,
        .analytics-attendance-summary-card {
          height: 380px;
        }

        .analytics-attendance-chart-card > div {
          height: 100%;
          box-sizing: border-box;
          background: ${analyticsSectionGradient} !important;
        }

        .analytics-attendance-chart-card > div > div {
          height: 100%;
          box-sizing: border-box;
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
          grid-template-columns: 28px minmax(0, 1fr) auto !important;
          min-height: 78px;
          padding: 9px 10px !important;
        }

        .analytics-alert-grid [role="button"] > div:first-child {
          width: 28px !important;
          height: 28px !important;
        }

        .analytics-alert-grid [role="button"] > div:last-child {
          grid-column: 3 !important;
          grid-row: 1 / span 3 !important;
          align-self: center;
          justify-self: end !important;
          padding: 0 !important;
        }

        .analytics-alert-action {
          min-width: 132px;
          justify-content: flex-end;
        }

        .analytics-pdf-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .analytics-pdf-option-card,
        .analytics-pdf-option-card p {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .analytics-pdf-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          flex-wrap: wrap;
        }

        .analytics-insight-export-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          width: 100%;
        }

        .analytics-insight-history-filters {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(150px, 0.46fr) minmax(140px, 0.42fr);
          gap: 8px;
          align-items: center;
        }

        #analytics-daily .analytics-card-grid--three > div > p:last-child {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        #analytics-daily .analytics-card-grid--three > div {
          min-height: 110px;
          align-content: start;
        }

        .analytics-inline-icon-row {
          gap: 12px;
          align-items: center;
        }

        .analytics-drilldown-summary,
        .analytics-peak-signal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
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

        .analytics-date-range-panel > * {
          min-width: 0;
        }

        @media (max-width: 1500px) and (min-width: 1181px) {
          .analytics-date-range-panel {
            align-items: stretch !important;
            grid-template-columns: repeat(3, minmax(160px, 1fr)) auto !important;
          }

          .analytics-date-range-panel > div:first-child {
            grid-column: 1 / -1;
          }

          .analytics-date-range-panel > div:last-child {
            align-self: end;
            grid-column: 4;
          }
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

          .analytics-date-range-panel {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .analytics-date-range-panel > div:first-child {
            grid-column: 1 / -1;
          }

          #analytics-insights,
          #analytics-alerts,
          #analytics-daily,
          #analytics-kpis,
          #analytics-revenue {
            grid-column: 1 / -1;
          }

          .analytics-card-grid--three,
          .analytics-kpi-board,
          .analytics-presentation-grid,
          .analytics-alert-grid,
          .analytics-revenue-board,
          .analytics-attendance-grid,
          .analytics-revenue-chart,
          .analytics-modal-grid {
            grid-template-columns: 1fr;
          }

          .analytics-presentation-wide {
            grid-column: auto;
          }

          .analytics-drilldown-summary,
          .analytics-peak-signal-grid {
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
          .analytics-date-range-panel {
            grid-template-columns: 1fr !important;
          }

          .analytics-date-range-panel > div:first-child {
            grid-column: auto;
          }

          .analytics-ai-command-row {
            align-items: flex-start;
          }

          .analytics-section-filter-actions {
            margin-left: 0;
          }

          .analytics-insight-control-grid {
            grid-template-columns: 1fr;
          }

          .analytics-card-grid--three {
            grid-template-columns: 1fr;
          }

          .analytics-kpi-board {
            grid-template-columns: 1fr;
          }

          .analytics-composition-layout {
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

          .analytics-ai-recommendation-groups {
            grid-template-columns: 1fr;
          }

          .analytics-ai-evidence-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .analytics-pdf-modal-grid,
          .analytics-insight-history-filters,
          .analytics-revenue-filter-controls {
            grid-template-columns: 1fr;
            width: 100%;
          }

          .analytics-insight-history-row {
            align-items: stretch !important;
            grid-template-columns: 1fr !important;
          }

          .analytics-insight-history-row > button {
            justify-self: start;
          }

          .analytics-revenue-filter-controls {
            justify-content: flex-start;
          }

          .analytics-revenue-filter-controls select {
            min-width: 0;
            width: 100%;
          }
        }
      `}</style>
    </FitSection>
  );
}
