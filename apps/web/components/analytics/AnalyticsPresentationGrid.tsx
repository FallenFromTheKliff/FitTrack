"use client";

import { Activity, CircleDollarSign, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IThemeContext } from "@fittrack/types";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import {
  formatCompactMoney,
  getAnalyticsRevenueColors,
  type AnalyticsAttendanceChartPoint,
  type AnalyticsRevenueChartPoint,
} from "@/app/(auth)/analytics/helpers";

type AnalyticsPresentationGridProps = {
  attendanceSeries: AnalyticsAttendanceChartPoint[];
  colors: IThemeContext["colors"];
  periodLabel: string;
  revenueSeries: AnalyticsRevenueChartPoint[];
};

export function AnalyticsPresentationGrid({
  attendanceSeries,
  colors,
  periodLabel,
  revenueSeries,
}: AnalyticsPresentationGridProps) {
  const revenueColors = getAnalyticsRevenueColors(colors);
  const totals = revenueSeries.reduce(
    (sum, point) => ({
      bookings: sum.bookings + point.bookingRevenue,
      coaching: sum.coaching + point.coachingGymRevenue,
      membership: sum.membership + point.membershipRevenue,
      products: sum.products + point.productRevenue,
    }),
    { bookings: 0, coaching: 0, membership: 0, products: 0 },
  );
  const revenueMix = [
    { name: "Membership", value: totals.membership, color: revenueColors.membershipRevenue },
    { name: "Bookings", value: totals.bookings, color: revenueColors.bookingRevenue },
    { name: "Coaching", value: totals.coaching, color: revenueColors.coachingGymRevenue },
    { name: "Products", value: totals.products, color: revenueColors.productRevenue },
  ].filter((entry) => entry.value > 0);
  const totalRevenue = revenueMix.reduce((sum, entry) => sum + entry.value, 0);
  const tooltipStyle = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.textPrimary,
    fontSize: 12,
  };

  return (
    <div className="analytics-presentation-grid">
      <FitSection
        bare
        heading="Revenue momentum"
        action={<TrendingUp size={15} color={colors.brand} />}
        style={{ minWidth: 0 }}
      >
        <div style={{ height: 300, minWidth: 0, padding: "8px 8px 0" }}>
          {revenueSeries.length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 720, height: 300 }}
            >
              <ComposedChart data={revenueSeries}>
                <CartesianGrid stroke={`${colors.border}88`} vertical={false} />
                <XAxis
                  dataKey="bucket"
                  stroke={colors.textMuted}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={colors.textMuted}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => formatCompactMoney(Number(value))}
                  width={66}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatCompactMoney(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="membershipRevenue" name="Membership" stackId="revenue" fill={revenueColors.membershipRevenue} />
                <Bar dataKey="bookingRevenue" name="Bookings" stackId="revenue" fill={revenueColors.bookingRevenue} />
                <Bar dataKey="coachingGymRevenue" name="Coaching" stackId="revenue" fill={revenueColors.coachingGymRevenue} />
                <Bar
                  dataKey="productRevenue"
                  name="Products"
                  stackId="revenue"
                  fill={revenueColors.productRevenue}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  dataKey="totalRevenue"
                  name="Total"
                  type="monotone"
                  stroke={revenueColors.totalRevenue}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics-chart-empty">
              No completed revenue exists inside {periodLabel.toLowerCase()}.
            </div>
          )}
        </div>
      </FitSection>

      <FitSection
        bare
        heading="Revenue composition"
        action={<CircleDollarSign size={15} color={colors.brand} />}
        style={{ minWidth: 0 }}
      >
        {revenueMix.length ? (
          <div className="analytics-composition-layout">
            <div style={{ height: 230, minWidth: 0 }}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
                initialDimension={{ width: 360, height: 230 }}
              >
                <PieChart>
                  <Pie
                    data={revenueMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {revenueMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatCompactMoney(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-composition-legend">
              <div>
                <FitText as="p" style={{ color: colors.textMuted, fontSize: 11.5 }}>
                  Selected range
                </FitText>
                <FitText as="p" style={{ fontSize: 22, fontWeight: 850 }}>
                  {formatCompactMoney(totalRevenue)}
                </FitText>
              </div>
              {revenueMix.map((entry) => (
                <div key={entry.name} className="analytics-composition-row">
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor: entry.color,
                      borderRadius: 2,
                      height: 9,
                      width: 9,
                    }}
                  />
                  <FitText as="span" style={{ fontSize: 12 }}>{entry.name}</FitText>
                  <FitText
                    as="span"
                    style={{ color: colors.textMuted, fontSize: 12, marginLeft: "auto" }}
                  >
                    {((entry.value / totalRevenue) * 100).toFixed(1)}%
                  </FitText>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="analytics-chart-empty">
            Revenue composition appears after the first completed payment in the selected range.
          </div>
        )}
      </FitSection>

      <FitSection
        bare
        heading="Attendance rhythm"
        action={<Activity size={15} color={colors.brand} />}
        className="analytics-presentation-wide"
        style={{ minWidth: 0 }}
      >
        <div style={{ height: 250, minWidth: 0, padding: "8px 8px 0" }}>
          {attendanceSeries.length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 960, height: 250 }}
            >
              <AreaChart data={attendanceSeries}>
                <defs>
                  <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.brand} stopOpacity={0.42} />
                    <stop offset="95%" stopColor={colors.brand} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={`${colors.border}88`} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={colors.textMuted}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis allowDecimals={false} stroke={colors.textMuted} tick={{ fontSize: 10 }} width={38} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  dataKey="checkIns"
                  name="Check-ins"
                  type="monotone"
                  stroke={colors.brand}
                  strokeWidth={2}
                  fill="url(#attendanceFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics-chart-empty">
              No check-ins were recorded inside {periodLabel.toLowerCase()}.
            </div>
          )}
        </div>
      </FitSection>
    </div>
  );
}
