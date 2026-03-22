"use client";
import { useState } from "react";
import { DollarSign, Users, Activity, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { dashboardStyles } from "@/styles/pageStyles";
import {
  ANALYTICS_KPIS,
  ANALYTICS_PEAK_DATA,
  ANALYTICS_PERIOD_OPTIONS,
  ANALYTICS_PIE_DATA,
  ANALYTICS_REVENUE_DATA,
  ANALYTICS_WEEK_DATA
} from "@/data/charts/analytics";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";

export default function AnalyticsPage() {
  const { colors } = useTheme();
  const s = dashboardStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const [period, setPeriod] = useState("6m");

  const pieColors = [colors.brand, colors.textSecondary, colors.success];

  return (
      <section className={themeTransition} style={fadeIn}>
        <FitSection
            heading="Performance KPIs"
            bare
            action={(
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FitSelect
                      compact
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      options={ANALYTICS_PERIOD_OPTIONS}
                  />
                  <FitButton variant="ghost" label="EXPORT" />
                </div>
            )}
        >
          <div style={s.kpiGrid}>
            {ANALYTICS_KPIS.map((k) => (
                <div key={k.label} style={s.kpiCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={s.kpiIconWrap}><k.icon size={18} color={colors[k.colorKey]} /></div>
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
                <DollarSign size={14} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Revenue vs Expenses</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>Last 6 months</FitText>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={ANALYTICS_REVENUE_DATA}>
                  <XAxis dataKey="m" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  <Bar dataKey="expense" fill={colors.textSecondary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill={colors.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={s.chartCard}>
            <div style={s.chartHeader}>
              <div style={s.chartTitleRow}>
                <Users size={14} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Membership Distribution</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>By membership type</FitText>
            </div>
            <div style={{ height: 220, display: "flex", alignItems: "center", gap: 16 }}>
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={ANALYTICS_PIE_DATA} dataKey="value" innerRadius={45} outerRadius={80}>
                    {ANALYTICS_PIE_DATA.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ANALYTICS_PIE_DATA.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: pieColors[i] }} />
                      <FitText style={{ fontSize: 12, color: colors.textMuted }}>{d.name}</FitText>
                      <FitText style={{ fontSize: 12, fontWeight: 600 }}>{d.value}</FitText>
                    </div>
                ))}
              </div>
            </div>
          </div>
          <div style={s.chartCard}>
            <div style={s.chartHeader}>
              <div style={s.chartTitleRow}>
                <Activity size={14} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Weekly Attendance</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>Morning / Afternoon / Evening</FitText>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={ANALYTICS_WEEK_DATA}>
                  <XAxis dataKey="d" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  <Bar dataKey="morning" stackId="a" fill={colors.brand} />
                  <Bar dataKey="afternoon" stackId="a" fill={colors.textSecondary} />
                  <Bar dataKey="evening" stackId="a" fill={colors.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={s.chartCard}>
            <div style={s.chartHeader}>
              <div style={s.chartTitleRow}>
                <TrendingUp size={14} color={colors.brand} />
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>Peak Hours Analysis</FitText>
              </div>
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>Average daily traffic</FitText>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={ANALYTICS_PEAK_DATA}>
                  <XAxis dataKey="h" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="v" stroke={colors.brand} strokeWidth={2} dot={{ r: 3, fill: colors.brand }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
  );
}