"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CalendarClock, CircleOff, DollarSign } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

import { useTheme } from "@/contexts/ThemeContext";
import { dashboardStyles } from "@/styles/pageStyles";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { useDashboardStats } from "@/hooks/dashboard/useDashboardStats";
import {
  DASHBOARD_ACTIVITY,
  type DashboardActivityItem,
  DASHBOARD_ACTIVITY_FILTER_OPTIONS,
  DASHBOARD_GROWTH,
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_REVENUE
} from "@/data/charts/dashboard";

import { FitButton, FitChartContainer, FitPill, FitSection, FitSelect, FitTable, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { downloadExcelCompatibleReport } from "@/utils/reporting";
import {
  DASHBOARD_REPORT_EXPORT_ID,
  DASHBOARD_DEFAULT_ACTIVITY_FILTER,
  DASHBOARD_DEFAULT_PERIOD,
  filterDashboardActivityRows,
  filterDashboardSeries,
  getDashboardPeriodSubtitle,
  getDashboardActivityStatusColor
} from "./helpers";

export default function DashboardPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = dashboardStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { dashboardAlerts, isStaff, kpis, staffStats } = useDashboardStats();
  const [period, setPeriod] = useState(DASHBOARD_DEFAULT_PERIOD);
  const [activityFilter, setActivityFilter] = useState(DASHBOARD_DEFAULT_ACTIVITY_FILTER);
  const growthData = filterDashboardSeries(DASHBOARD_GROWTH, period);
  const revenueData = filterDashboardSeries(DASHBOARD_REVENUE, period);
  const activityRows = filterDashboardActivityRows(DASHBOARD_ACTIVITY, activityFilter);
  const chartSubtitle = getDashboardPeriodSubtitle(period);

  const handleExportDashboard = () => {
    downloadExcelCompatibleReport({
      fileName: `fittrack-dashboard-${period}.csv`,
      title: `FitTrack Dashboard Report - ${period}`,
      sections: [
        {
          title: "Key Metrics",
          columns: ["Metric", "Value", "Delta"],
          rows: kpis.map((kpi) => [kpi.label, kpi.value, kpi.delta])
        },
        {
          title: "System Alerts",
          columns: ["Alert", "Summary", "Action"],
          rows: dashboardAlerts.map((alert) => [alert.title, alert.body, alert.action])
        },
        {
          title: "Recent Activity",
          columns: ["Member", "Action", "Time", "Status"],
          rows: activityRows.map((row) => [row.member, row.action, row.time, row.status])
        }
      ]
    });
  };

  const activityColumns: FitTableColumn<DashboardActivityItem>[] = [
    {
      key: "member",
      heading: "MEMBER",
      render: (row: DashboardActivityItem) => <FitText style={{ fontSize: 14, fontWeight: 600 }}>{row.member}</FitText>
    },
    {
      key: "action",
      heading: "ACTION",
      render: (row, c) => <FitText style={{ fontSize: 14, color: c.textMuted }}>{row.action}</FitText>
    },
    {
      key: "time",
      heading: "TIME",
      render: (row, c) => <FitText style={{ fontSize: 14, color: c.textMuted }}>{row.time}</FitText>
    },
    {
      key: "status",
      heading: "STATUS",
      render: (row, c) => {
        const statusColor = getDashboardActivityStatusColor(row.status, c);
        return <FitPill mode="status" label={row.status} color={statusColor} fontSize={12} />;
      }
    }
  ];

  if (isStaff) {
    const staffCards = [
      {
        icon: CalendarClock,
        label: "Upcoming Confirmed Bookings",
        value: String(staffStats?.upcomingBookings ?? 0),
        helper: "Confirmed reservations still ahead"
      },
      {
        icon: CircleOff,
        label: "Cancelled Bookings",
        value: String(staffStats?.byStatus.cancelled ?? 0),
        helper: "Rejected or cancelled booking requests"
      }
    ];

    return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        <FitSection heading="Booking Operations" bare>
          <div style={s.kpiGrid}>
            {kpis.map((k) => (
              <div key={k.label} style={s.kpiCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={s.kpiIconWrap}>
                    <k.icon size={18} color={colors.brand} />
                  </div>
                  <FitText style={{ fontSize: 12, fontWeight: 600, color: colors.success }}>{k.delta}</FitText>
                </div>
                <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 12 }}>{k.label}</FitText>
                <FitText as="p" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{k.value}</FitText>
              </div>
            ))}
          </div>
        </FitSection>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          {staffCards.map((card) => (
            <div key={card.label} style={s.kpiCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={s.kpiIconWrap}>
                  <card.icon size={18} color={colors.brand} />
                </div>
                <FitText style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</FitText>
              </div>
              <FitText as="p" style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>{card.label}</FitText>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{card.helper}</FitText>
            </div>
          ))}
        </div>
        <FitSection heading="Status Breakdown" className="mb-0">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, padding: "0 16px 16px" }}>
            <div style={s.kpiCard}>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>Pending</FitText>
              <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{staffStats?.byStatus.pending ?? 0}</FitText>
            </div>
            <div style={s.kpiCard}>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>Confirmed</FitText>
              <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{staffStats?.byStatus.confirmed ?? 0}</FitText>
            </div>
            <div style={s.kpiCard}>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>Completed</FitText>
              <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{staffStats?.byStatus.completed ?? 0}</FitText>
            </div>
            <div style={s.kpiCard}>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>Cancelled</FitText>
              <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{staffStats?.byStatus.cancelled ?? 0}</FitText>
            </div>
          </div>
        </FitSection>
      </FitSection>
    );
  }

  return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        <div id={DASHBOARD_REPORT_EXPORT_ID}>
          <FitSection
              heading="System Alerts"
              action={<FitText style={{ fontSize: 12, color: colors.textMuted }}>{dashboardAlerts.length} live alert lanes</FitText>}
          >
            <div style={{ padding: "0 16px" }}>
              {dashboardAlerts.map((a, i) => (
                  <div
                      key={i}
                      style={{ ...s.alertItem, borderBottom: i < dashboardAlerts.length - 1 ? `1px solid ${colors.border}` : "none" }}
                  >
                    <div style={s.alertIconWrap(colors[a.colorKey])}>
                      <a.icon size={15} color={colors[a.colorKey]} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FitText style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</FitText>
                      <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 1.5 }}>{a.body}</FitText>
                    </div>
                    <FitButton
                      variant="ghost"
                      label={a.action}
                      onClick={() => router.push("/inventory")}
                      style={{ whiteSpace: "nowrap" }}
                    />
                  </div>
              ))}
            </div>
          </FitSection>
        <FitSection
            heading="Key Metrics"
            bare
            action={(
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FitSelect
                      compact
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      options={DASHBOARD_PERIOD_OPTIONS}
                  />
                  <FitButton variant="ghost" label="EXPORT EXCEL" onClick={handleExportDashboard} />
                </div>
            )}
        >
          <div style={s.kpiGrid}>
            {kpis.map((k) => (
                <div key={k.label} style={s.kpiCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={s.kpiIconWrap}>
                      <k.icon size={18} color={colors.brand} />
                    </div>
                    <FitText style={{ fontSize: 12, fontWeight: 600, color: colors.success }}>{k.delta}</FitText>
                  </div>
                  <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 12 }}>{k.label}</FitText>
                  <FitText as="p" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{k.value}</FitText>
                </div>
            ))}
          </div>
        </FitSection>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <FitChartContainer
            heading="Membership Growth"
            subtitle={chartSubtitle}
            action={<Activity size={15} color={colors.brand} />}
            sectionClassName="mb-0"
            chartStyle={{ height: 200 }}
            contentPadding="0"
          >
            <BarChart data={growthData}>
              <XAxis dataKey="m" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
              <Bar dataKey="v" fill={colors.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </FitChartContainer>
          <FitChartContainer
            heading="Revenue Trend"
            subtitle={chartSubtitle}
            action={<DollarSign size={15} color={colors.brand} />}
            sectionClassName="mb-0"
            chartStyle={{ height: 200 }}
            contentPadding="0"
          >
            <LineChart data={revenueData}>
              <XAxis dataKey="m" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
              <Line type="monotone" dataKey="v" stroke={colors.brand} strokeWidth={2} dot={{ r: 3, fill: colors.brand }} />
            </LineChart>
          </FitChartContainer>
        </div>
        <div style={s.tableCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={s.chartTitleRow}>
              <Activity size={15} color={colors.brand} />
              <FitText style={{ fontSize: 13, fontWeight: 600 }}>Recent Activity</FitText>
            </div>
            <FitSelect
                compact
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                options={DASHBOARD_ACTIVITY_FILTER_OPTIONS}
            />
          </div>
          <FitTable
              columns={activityColumns}
              rows={activityRows}
              getRowKey={(row) => `${row.member}-${row.time}`}
          />
        </div>
        </div>
      </FitSection>
  );
}
