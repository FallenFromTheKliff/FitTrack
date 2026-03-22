"use client";
import { useState } from "react";
import { Activity, DollarSign } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

import { useTheme } from "@/contexts/ThemeContext";
import { dashboardStyles } from "@/styles/pageStyles";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { useDashboardStats } from "@/hooks/dashboard/useDashboardStats";
import {
  DASHBOARD_ACTIVITY,
  DASHBOARD_ACTIVITY_FILTER_OPTIONS,
  DASHBOARD_ALERTS,
  DASHBOARD_GROWTH,
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_REVENUE
} from "@/data/charts/dashboard";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import FitTable from "@/components/fit/FitTable";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { FitSelect } from "@/components/fit/FitCard";

type ActivityRow = typeof DASHBOARD_ACTIVITY[number];

export default function DashboardPage() {
  const { colors } = useTheme();
  const s = dashboardStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { kpis } = useDashboardStats();
  const [period, setPeriod] = useState("this-month");
  const [activityFilter, setActivityFilter] = useState("all");

  const activityColumns: FitTableColumn<ActivityRow>[] = [
    {
      key: "member",
      heading: "MEMBER",
      render: (row) => <FitText style={{ fontSize: 14, fontWeight: 600 }}>{row.member}</FitText>
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
        const statusColor =
            row.status === "active" ? c.brand
                : row.status === "success" ? c.success
                    : c.textMuted;
        return <FitPill mode="status" label={row.status} color={statusColor} fontSize={12} />;
      }
    }
  ];

  return (
      <section className={themeTransition} style={fadeIn}>
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
                  <FitButton variant="ghost" label="EXPORT" />
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
          <div style={s.chartCard}>
            <div style={s.chartHeader}>
              <div style={s.chartTitleRow}>
                <Activity size={15} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Membership Growth</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>Last 6 months</FitText>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={DASHBOARD_GROWTH}>
                  <XAxis dataKey="m" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  <Bar dataKey="v" fill={colors.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={s.chartCard}>
            <div style={s.chartHeader}>
              <div style={s.chartTitleRow}>
                <DollarSign size={15} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Revenue Trend</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>Last 6 months</FitText>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={DASHBOARD_REVENUE}>
                  <XAxis dataKey="m" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="v" stroke={colors.brand} strokeWidth={2} dot={{ r: 3, fill: colors.brand }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
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
              rows={DASHBOARD_ACTIVITY}
              getRowKey={(row) => `${row.member}-${row.time}`}
          />
        </div>
        <FitSection
            heading="System Alerts"
            action={<FitText style={{ fontSize: 12, color: colors.brand, cursor: "pointer" }}>View all</FitText>}
        >
          <div style={{ padding: "0 16px" }}>
            {DASHBOARD_ALERTS.map((a, i) => (
                <div
                    key={i}
                    style={{ ...s.alertItem, borderBottom: i < DASHBOARD_ALERTS.length - 1 ? `1px solid ${colors.border}` : "none" }}
                >
                  <div style={s.alertIconWrap(colors[a.colorKey])}>
                    <a.icon size={15} color={colors[a.colorKey]} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FitText style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</FitText>
                    <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 1.5 }}>{a.body}</FitText>
                  </div>
                  <FitButton variant="ghost" label={a.action} style={{ fontSize: 12, padding: "6px 12px" }} />
                </div>
            ))}
          </div>
        </FitSection>
      </section>
  );
}