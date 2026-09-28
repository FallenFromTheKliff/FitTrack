import { Injectable } from '@nestjs/common';
import { InsightFocus, InsightPeriod, Prisma } from '@prisma/client';

import {
  type AnalyticsAttendanceSeriesPointDTO,
  AnalyticsAttendanceResponseDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsDailyInsightSeriesPointDTO,
  AnalyticsDailyInsightsTrendResponseDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsOverviewResponseDTO,
  type AnalyticsPeriod,
  AnalyticsQueryDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueSeriesPointDTO,
  AnalyticsRevenueTotalsDTO,
  AnalyticsRecentActivityDTO,
  AnalyticsSnapshotResponseDTO,
  AnalyticsSystemAlertDTO,
  AnalyticsTopRevenueSourceDTO,
} from './dto/analytics.dto';
import {
  type AnalyticsRecentActivityRow,
  type AnalyticsSystemAlertRow,
  type AttendanceMetricsRows,
  type InventorySummaryRows,
  AnalyticsRepository,
  type RevenueMetricsRows,
} from './analytics.repository';
import {
  type BuildBusinessInsightGroundingInput,
  type BusinessAnalyticsGroundingPayload,
  type BusinessInsightComparison,
  type ResolvedBusinessInsightWindow,
} from './analytics.types';

type RevenueSnapshot = {
  booking_revenue: Prisma.Decimal | number | string | null;
  cash_membership_revenue?: Prisma.Decimal | number | string | null;
  coaching_gym_revenue: Prisma.Decimal | number | string | null;
  coaching_payments_collected: Prisma.Decimal | number | string | null;
  gym_membership_revenue?: Prisma.Decimal | number | string | null;
  membership_card_revenue?: Prisma.Decimal | number | string | null;
  membership_revenue: Prisma.Decimal | number | string | null;
  paymongo_membership_revenue?: Prisma.Decimal | number | string | null;
  product_revenue: Prisma.Decimal | number | string | null;
};

const DEFAULT_INSIGHT_FOCUS = InsightFocus.overview;
const DEFAULT_INSIGHT_PERIOD = InsightPeriod.monthly;
const GROUNDING_RANK_LIMIT = 5;

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getOverview(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsOverviewResponseDTO> {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getOverviewMetrics(window.start, window.end);

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      total_check_ins: this.toCount(result.attendance.total_check_ins),
      new_members: this.toCount(result.members.new_members),
      completed_coaching_sessions: this.toCount(
        result.coaching.completed_coaching_sessions,
      ),
      revenue: this.toRevenueTotals({
        booking_revenue: result.payments.booking_revenue,
        coaching_payments_collected:
          result.payments.coaching_payments_collected,
        coaching_gym_revenue: result.coaching.coaching_gym_revenue,
        membership_revenue: result.payments.membership_revenue,
        membership_card_revenue: result.payments.membership_card_revenue,
        gym_membership_revenue: result.payments.gym_membership_revenue,
        cash_membership_revenue: result.payments.cash_membership_revenue,
        paymongo_membership_revenue:
          result.payments.paymongo_membership_revenue,
        product_revenue: result.payments.product_revenue,
      }),
    };
  }

  async getRevenue(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsRevenueResponseDTO> {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getRevenueMetrics(
      window.start,
      window.end,
      window.period,
    );

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      period: window.period,
      totals: this.toRevenueTotals({
        booking_revenue: result.payments.booking_revenue,
        coaching_payments_collected:
          result.payments.coaching_payments_collected,
        coaching_gym_revenue: result.coaching.coaching_gym_revenue,
        membership_revenue: result.payments.membership_revenue,
        membership_card_revenue: result.payments.membership_card_revenue,
        gym_membership_revenue: result.payments.gym_membership_revenue,
        cash_membership_revenue: result.payments.cash_membership_revenue,
        paymongo_membership_revenue:
          result.payments.paymongo_membership_revenue,
        product_revenue: result.payments.product_revenue,
      }),
      top_revenue_sources: this.toTopRevenueSources({
        booking_revenue: result.payments.booking_revenue,
        coaching_payments_collected:
          result.payments.coaching_payments_collected,
        coaching_gym_revenue: result.coaching.coaching_gym_revenue,
        membership_revenue: result.payments.membership_revenue,
        product_revenue: result.payments.product_revenue,
      }),
      series: this.toRevenueSeries(result),
    };
  }

  async getAttendance(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsAttendanceResponseDTO> {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getAttendanceMetrics(
      window.start,
      window.end,
      window.period,
    );

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      period: window.period,
      total_check_ins: this.toCount(result.summary.total_check_ins),
      peak_hours: result.peakHours.map((row) => ({
        hour_label: this.toHourLabel(row.hour_of_day),
        check_ins: this.toCount(row.check_ins),
      })),
      series: this.toAttendanceSeries(result.series),
    };
  }

  async getMembers(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsMembersResponseDTO> {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getMemberMetrics(window.start, window.end);

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      new_members: this.toCount(result.new_members),
      active_members: this.toCount(result.active_members),
    };
  }

  async getDailyInsightsTrend(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsDailyInsightsTrendResponseDTO> {
    const window = this.resolveWindow(dto);
    const [attendance, activeMemberTrend] = await Promise.all([
      this.repo.getAttendanceMetrics(window.start, window.end, window.period),
      this.repo.getActiveMemberTrend(window.start, window.end, window.period),
    ]);

    const attendanceByBucket = new Map(
      this.toAttendanceSeries(attendance.series).map((point) => [
        point.bucket_start,
        point.check_ins,
      ]),
    );

    const series: AnalyticsDailyInsightSeriesPointDTO[] = activeMemberTrend.map(
      (point) => {
        const bucketStart = this.toIsoString(point.bucket_start);

        return {
          bucket_start: bucketStart,
          active_members: this.toCount(point.active_members),
          sessions: attendanceByBucket.get(bucketStart) ?? 0,
        };
      },
    );

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      period: window.period,
      series,
    };
  }

  async getCoaches(
    dto: AnalyticsQueryDTO,
  ): Promise<AnalyticsCoachesResponseDTO> {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getCoachEarningsMetrics(
      window.start,
      window.end,
    );

    return {
      start_date: window.start.toISOString(),
      end_date: window.end.toISOString(),
      coaches: result.coaches.map((coach) => this.toCoachBreakdown(coach)),
    };
  }

  async getSnapshot(): Promise<AnalyticsSnapshotResponseDTO> {
    const now = new Date();
    const allTimeStart = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
    const todayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const recentSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [
      overview,
      activeMembers,
      sessionsToday,
      venueBookings,
      coachingAppointments,
      feedbackMetrics,
      recentActivityCount,
      systemAlerts,
      recentActivities,
    ] = await Promise.all([
      this.repo.getOverviewMetrics(allTimeStart, now),
      this.repo.getCurrentActiveMembers(now),
      this.repo.getCheckInCount(todayStart, now),
      this.repo.getVenueBookingCount(allTimeStart, now),
      this.repo.getCoachingAppointmentCount(allTimeStart, now),
      this.repo.getFeedbackMetrics(),
      this.repo.getRecentActivityCountSince(recentSince),
      this.repo.listSystemAlerts(),
      this.repo.listRecentActivities(8),
    ]);
    const revenueTotals = this.toRevenueTotals({
      booking_revenue: overview.payments.booking_revenue,
      coaching_payments_collected:
        overview.payments.coaching_payments_collected,
      coaching_gym_revenue: overview.coaching.coaching_gym_revenue,
      membership_card_revenue: overview.payments.membership_card_revenue,
      gym_membership_revenue: overview.payments.gym_membership_revenue,
      cash_membership_revenue: overview.payments.cash_membership_revenue,
      membership_revenue: overview.payments.membership_revenue,
      paymongo_membership_revenue:
        overview.payments.paymongo_membership_revenue,
      product_revenue: overview.payments.product_revenue,
    });

    return {
      generated_at: now.toISOString(),
      daily_insights: {
        active_members: activeMembers,
        sessions_today: sessionsToday,
        recent_activities: recentActivityCount,
      },
      performance_kpis: {
        total_revenue: revenueTotals.total_revenue,
        total_venue_bookings: venueBookings,
        total_coaching_appointments: coachingAppointments,
        new_members: this.toCount(overview.members.new_members),
        check_ins: this.toCount(overview.attendance.total_check_ins),
        coaching_sessions: this.toCount(
          overview.coaching.completed_coaching_sessions,
        ),
        active_members: activeMembers,
        session_completion_rate:
          coachingAppointments > 0
            ? Number(
                (
                  (this.toCount(overview.coaching.completed_coaching_sessions) /
                    coachingAppointments) *
                  100
                ).toFixed(1),
              )
            : 0,
        coach_satisfaction_rating: Number(
          this.toMoneyNumber(feedbackMetrics.coach_satisfaction_rating).toFixed(
            1,
          ),
        ),
        venue_feedback_rating: Number(
          this.toMoneyNumber(feedbackMetrics.venue_feedback_rating).toFixed(1),
        ),
        app_feedback_submissions: this.toCount(
          feedbackMetrics.app_feedback_submissions,
        ),
      },
      system_alerts: systemAlerts.map((alert) => this.toSystemAlert(alert)),
      recent_activities: recentActivities.map((activity) =>
        this.toRecentActivity(activity),
      ),
    };
  }

  async getInventorySummary(dto: AnalyticsQueryDTO) {
    const window = this.resolveWindow(dto);
    const result = await this.repo.getInventorySummary(
      window.start,
      window.end,
      GROUNDING_RANK_LIMIT,
    );

    return this.toInventorySummary(result);
  }

  async buildBusinessInsightGroundingPayload(
    input: BuildBusinessInsightGroundingInput,
  ): Promise<BusinessAnalyticsGroundingPayload> {
    const window = this.resolveBusinessInsightWindow(input);
    const includeInventory = this.shouldIncludeInventory(window.focus);
    const [
      revenue,
      attendance,
      membership,
      coaching,
      topPlans,
      inventorySummary,
      previousRevenue,
      previousAttendance,
      previousMembership,
    ] = await Promise.all([
      this.repo.getRevenueMetrics(window.start, window.end, window.period),
      this.repo.getAttendanceMetrics(window.start, window.end, window.period),
      this.repo.getMemberMetrics(window.start, window.end),
      this.repo.getCoachEarningsMetrics(window.start, window.end),
      this.repo.getTopMembershipPlans(
        window.start,
        window.end,
        GROUNDING_RANK_LIMIT,
      ),
      includeInventory
        ? this.repo.getInventorySummary(
            window.start,
            window.end,
            GROUNDING_RANK_LIMIT,
          )
        : Promise.resolve(null),
      this.repo.getRevenueMetrics(
        window.previousStart,
        window.previousEnd,
        window.period,
      ),
      this.repo.getAttendanceMetrics(
        window.previousStart,
        window.previousEnd,
        window.period,
      ),
      this.repo.getMemberMetrics(window.previousStart, window.previousEnd),
    ]);
    const revenueTotals = this.toRevenueTotals({
      booking_revenue: revenue.payments.booking_revenue,
      coaching_payments_collected: revenue.payments.coaching_payments_collected,
      coaching_gym_revenue: revenue.coaching.coaching_gym_revenue,
      membership_card_revenue: revenue.payments.membership_card_revenue,
      gym_membership_revenue: revenue.payments.gym_membership_revenue,
      cash_membership_revenue: revenue.payments.cash_membership_revenue,
      membership_revenue: revenue.payments.membership_revenue,
      paymongo_membership_revenue:
        revenue.payments.paymongo_membership_revenue,
      product_revenue: revenue.payments.product_revenue,
    });
    const attendanceSeries = this.toAttendanceSeries(attendance.series);
    const previousRevenueTotals = this.toRevenueTotals({
      booking_revenue: previousRevenue.payments.booking_revenue,
      coaching_payments_collected:
        previousRevenue.payments.coaching_payments_collected,
      coaching_gym_revenue: previousRevenue.coaching.coaching_gym_revenue,
      membership_card_revenue:
        previousRevenue.payments.membership_card_revenue,
      gym_membership_revenue:
        previousRevenue.payments.gym_membership_revenue,
      cash_membership_revenue:
        previousRevenue.payments.cash_membership_revenue,
      membership_revenue: previousRevenue.payments.membership_revenue,
      paymongo_membership_revenue:
        previousRevenue.payments.paymongo_membership_revenue,
      product_revenue: previousRevenue.payments.product_revenue,
    });
    const totalCheckIns = this.toCount(attendance.summary.total_check_ins);
    const previousCheckIns = this.toCount(
      previousAttendance.summary.total_check_ins,
    );
    const newMembers = this.toCount(membership.new_members);
    const previousNewMembers = this.toCount(previousMembership.new_members);
    const completedCoachingSessions = this.toCount(
      revenue.coaching.completed_coaching_sessions,
    );
    const previousCompletedCoachingSessions = this.toCount(
      previousRevenue.coaching.completed_coaching_sessions,
    );
    const inventory = inventorySummary
      ? this.toInventorySummary(inventorySummary)
      : null;
    const derivedSignals = this.toBusinessInsightDerivedSignals({
      attendance,
      inventory,
      revenueTotals,
    });

    return {
      window: {
        start_date: this.toDateOnlyString(window.start),
        end_date: this.toDateOnlyString(window.end),
        previous_start_date: this.toDateOnlyString(window.previousStart),
        previous_end_date: this.toDateOnlyString(window.previousEnd),
        period: window.period,
        focus: window.focus,
      },
      comparisons: {
        total_revenue: this.toMoneyComparison(
          revenueTotals.total_revenue,
          previousRevenueTotals.total_revenue,
        ),
        check_ins: this.toCountComparison(totalCheckIns, previousCheckIns),
        new_members: this.toCountComparison(newMembers, previousNewMembers),
        completed_coaching_sessions: this.toCountComparison(
          completedCoachingSessions,
          previousCompletedCoachingSessions,
        ),
      },
      derived_signals: derivedSignals,
      overview: {
        total_revenue: revenueTotals.total_revenue,
        total_check_ins: totalCheckIns,
        new_members: newMembers,
        completed_coaching_sessions: completedCoachingSessions,
      },
      revenue: {
        totals: revenueTotals,
        series: this.toRevenueSeries(revenue),
      },
      attendance: {
        series: attendanceSeries,
        peak_hours: attendance.peakHours
          .slice(0, GROUNDING_RANK_LIMIT)
          .map((row) => ({
            hour_label: this.toHourLabel(row.hour_of_day),
            check_ins: this.toCount(row.check_ins),
          })),
      },
      membership: {
        new_members: this.toCount(membership.new_members),
        active_members: this.toCount(membership.active_members),
        top_plans: topPlans.map((row) => ({
          name: row.name,
          subscriber_count: this.toCount(row.subscriber_count),
          revenue: this.toMoneyNumber(row.revenue).toFixed(2),
        })),
      },
      coaching: {
        coaches: coaching.coaches.map((coach) => this.toCoachBreakdown(coach)),
      },
      ...(includeInventory
        ? {
            inventory: {
              ...(inventory ??
                this.toInventorySummary({
                  equipment: {
                    equipment_types: 0,
                    equipment_under_maintenance: 0,
                    equipment_units_available: 0,
                    equipment_units_total: 0,
                  },
                  retail: {
                    low_stock_items: 0,
                    out_of_stock_items: 0,
                    retail_inventory_value: new Prisma.Decimal(0),
                    retail_items: 0,
                  },
                  topProducts: [],
                })),
              retail_sales_revenue: revenueTotals.product_revenue,
            },
          }
        : {}),
    };
  }

  private resolveWindow(dto: AnalyticsQueryDTO): {
    end: Date;
    period: AnalyticsPeriod;
    start: Date;
  } {
    const now = new Date();
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const defaultEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    return {
      start: dto.start_date
        ? new Date(`${dto.start_date}T00:00:00.000Z`)
        : defaultStart,
      end: dto.end_date
        ? new Date(`${dto.end_date}T23:59:59.999Z`)
        : defaultEnd,
      period: dto.period ?? 'monthly',
    };
  }

  private resolveBusinessInsightWindow(
    input: BuildBusinessInsightGroundingInput,
  ): ResolvedBusinessInsightWindow {
    const now = new Date();
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const defaultEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    const start = input.start_date
      ? new Date(`${input.start_date}T00:00:00.000Z`)
      : defaultStart;
    const end = input.end_date
      ? new Date(`${input.end_date}T23:59:59.999Z`)
      : defaultEnd;
    const inclusiveDurationMs = end.getTime() - start.getTime() + 1;
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(
      previousEnd.getTime() - inclusiveDurationMs + 1,
    );

    return {
      start,
      end,
      previousStart,
      previousEnd,
      focus: input.focus ?? DEFAULT_INSIGHT_FOCUS,
      period: input.period ?? DEFAULT_INSIGHT_PERIOD,
    };
  }

  private toBusinessInsightDerivedSignals(input: {
    attendance: AttendanceMetricsRows;
    inventory: ReturnType<AnalyticsService['toInventorySummary']> | null;
    revenueTotals: AnalyticsRevenueTotalsDTO;
  }): BusinessAnalyticsGroundingPayload['derived_signals'] {
    const revenueSources = [
      {
        key: 'memberships' as const,
        label: 'Memberships',
        value: this.toMoneyNumber(input.revenueTotals.membership_revenue),
      },
      {
        key: 'bookings' as const,
        label: 'Venue bookings',
        value: this.toMoneyNumber(input.revenueTotals.booking_revenue),
      },
      {
        key: 'products' as const,
        label: 'Retail products',
        value: this.toMoneyNumber(input.revenueTotals.product_revenue),
      },
      {
        key: 'coaching' as const,
        label: 'Coaching gym share',
        value: this.toMoneyNumber(input.revenueTotals.coaching_gym_revenue),
      },
    ];
    const totalRevenue = revenueSources.reduce(
      (sum, source) => sum + source.value,
      0,
    );
    const topRevenueSource = [...revenueSources].sort(
      (left, right) => right.value - left.value,
    )[0];
    const totalCheckIns = this.toCount(
      input.attendance.summary.total_check_ins,
    );
    const peakHour = input.attendance.peakHours[0];

    return {
      revenue_mix_percentages: {
        memberships:
          this.toPercentage(revenueSources[0].value, totalRevenue) ?? 0,
        bookings: this.toPercentage(revenueSources[1].value, totalRevenue) ?? 0,
        products: this.toPercentage(revenueSources[2].value, totalRevenue) ?? 0,
        coaching: this.toPercentage(revenueSources[3].value, totalRevenue) ?? 0,
      },
      top_revenue_source_concentration:
        topRevenueSource && totalRevenue > 0
          ? {
              source_key: topRevenueSource.key,
              source_label: topRevenueSource.label,
              percentage:
                this.toPercentage(topRevenueSource.value, totalRevenue) ?? 0,
            }
          : null,
      peak_hour_attendance_concentration:
        peakHour && totalCheckIns > 0
          ? {
              hour_label: this.toHourLabel(peakHour.hour_of_day),
              check_ins: this.toCount(peakHour.check_ins),
              percentage:
                this.toPercentage(
                  this.toCount(peakHour.check_ins),
                  totalCheckIns,
                ) ?? 0,
            }
          : null,
      equipment_availability_percentage: input.inventory
        ? this.toPercentage(
            input.inventory.equipment_units_available,
            input.inventory.equipment_units_total,
          )
        : null,
      low_stock_exposure_percentage: input.inventory
        ? this.toPercentage(
            input.inventory.low_stock_items,
            input.inventory.retail_items,
          )
        : null,
      out_of_stock_exposure_percentage: input.inventory
        ? this.toPercentage(
            input.inventory.out_of_stock_items,
            input.inventory.retail_items,
          )
        : null,
    };
  }

  private toCountComparison(
    current: number,
    previous: number,
  ): BusinessInsightComparison<number> {
    const absoluteChange = current - previous;
    return {
      current,
      previous,
      absolute_change: absoluteChange,
      percentage_change: this.toPercentage(absoluteChange, previous),
      direction: this.toComparisonDirection(current, previous),
    };
  }

  private toMoneyComparison(
    currentValue: string,
    previousValue: string,
  ): BusinessInsightComparison<string> {
    const current = this.toMoneyNumber(currentValue);
    const previous = this.toMoneyNumber(previousValue);
    return {
      current: current.toFixed(2),
      previous: previous.toFixed(2),
      absolute_change: (current - previous).toFixed(2),
      percentage_change: this.toPercentage(current - previous, previous),
      direction: this.toComparisonDirection(current, previous),
    };
  }

  private toComparisonDirection(
    current: number,
    previous: number,
  ): BusinessInsightComparison<number>['direction'] {
    if (current === previous) return 'flat';
    if (previous === 0 && current > 0) return 'new_from_zero';
    return current > previous ? 'increase' : 'decrease';
  }

  private toPercentage(numerator: number, denominator: number): number | null {
    if (denominator === 0) return null;
    return Number(((numerator / denominator) * 100).toFixed(1));
  }

  private toRevenueSeries(
    result: RevenueMetricsRows,
  ): AnalyticsRevenueSeriesPointDTO[] {
    const seriesMap = new Map<string, AnalyticsRevenueSeriesPointDTO>();

    for (const row of result.paymentSeries) {
      const bucketStart = this.toIsoString(row.bucket_start);
      seriesMap.set(bucketStart, {
        bucket_start: bucketStart,
        ...this.toRevenueTotals({
          membership_revenue: row.membership_revenue,
          membership_card_revenue: row.membership_card_revenue,
          gym_membership_revenue: row.gym_membership_revenue,
          cash_membership_revenue: row.cash_membership_revenue,
          paymongo_membership_revenue: row.paymongo_membership_revenue,
          booking_revenue: row.booking_revenue,
          product_revenue: row.product_revenue,
          coaching_payments_collected: row.coaching_payments_collected,
          coaching_gym_revenue: new Prisma.Decimal(0),
        }),
      });
    }

    for (const row of result.coachingSeries) {
      const bucketStart = this.toIsoString(row.bucket_start);
      const existing = seriesMap.get(bucketStart);

      if (!existing) {
        seriesMap.set(bucketStart, {
          bucket_start: bucketStart,
          ...this.toRevenueTotals({
            membership_revenue: new Prisma.Decimal(0),
            membership_card_revenue: new Prisma.Decimal(0),
            gym_membership_revenue: new Prisma.Decimal(0),
            cash_membership_revenue: new Prisma.Decimal(0),
            paymongo_membership_revenue: new Prisma.Decimal(0),
            booking_revenue: new Prisma.Decimal(0),
            product_revenue: new Prisma.Decimal(0),
            coaching_payments_collected: new Prisma.Decimal(0),
            coaching_gym_revenue: row.coaching_gym_revenue,
          }),
        });
        continue;
      }

      const updated = this.toRevenueTotals({
        membership_revenue: existing.membership_revenue,
        membership_card_revenue: existing.membership_card_revenue,
        gym_membership_revenue: existing.gym_membership_revenue,
        cash_membership_revenue: existing.cash_membership_revenue,
        paymongo_membership_revenue: existing.paymongo_membership_revenue,
        booking_revenue: existing.booking_revenue,
        product_revenue: existing.product_revenue,
        coaching_payments_collected: existing.coaching_payments_collected,
        coaching_gym_revenue: row.coaching_gym_revenue,
      });

      seriesMap.set(bucketStart, {
        bucket_start: bucketStart,
        ...updated,
      });
    }

    return [...seriesMap.values()].sort((left, right) =>
      left.bucket_start.localeCompare(right.bucket_start),
    );
  }

  private toAttendanceSeries(
    series: AttendanceMetricsRows['series'],
  ): AnalyticsAttendanceSeriesPointDTO[] {
    return series.map((row) => ({
      bucket_start: this.toIsoString(row.bucket_start),
      check_ins: this.toCount(row.check_ins),
    }));
  }

  private toRevenueTotals(
    snapshot: RevenueSnapshot,
  ): AnalyticsRevenueTotalsDTO {
    const membershipRevenue = this.toMoneyNumber(snapshot.membership_revenue);
    const membershipCardRevenue = this.toMoneyNumber(
      snapshot.membership_card_revenue ?? 0,
    );
    const gymMembershipRevenue = this.toMoneyNumber(
      snapshot.gym_membership_revenue ?? 0,
    );
    const cashMembershipRevenue = this.toMoneyNumber(
      snapshot.cash_membership_revenue ?? 0,
    );
    const paymongoMembershipRevenue = this.toMoneyNumber(
      snapshot.paymongo_membership_revenue ?? 0,
    );
    const bookingRevenue = this.toMoneyNumber(snapshot.booking_revenue);
    const productRevenue = this.toMoneyNumber(snapshot.product_revenue);
    const coachingPaymentsCollected = this.toMoneyNumber(
      snapshot.coaching_payments_collected,
    );
    const coachingGymRevenue = this.toMoneyNumber(
      snapshot.coaching_gym_revenue,
    );
    const totalRevenue =
      membershipRevenue + bookingRevenue + productRevenue + coachingGymRevenue;

    return {
      membership_revenue: membershipRevenue.toFixed(2),
      membership_card_revenue: membershipCardRevenue.toFixed(2),
      gym_membership_revenue: gymMembershipRevenue.toFixed(2),
      cash_membership_revenue: cashMembershipRevenue.toFixed(2),
      paymongo_membership_revenue: paymongoMembershipRevenue.toFixed(2),
      booking_revenue: bookingRevenue.toFixed(2),
      product_revenue: productRevenue.toFixed(2),
      coaching_payments_collected: coachingPaymentsCollected.toFixed(2),
      coaching_gym_revenue: coachingGymRevenue.toFixed(2),
      total_revenue: totalRevenue.toFixed(2),
    };
  }

  private toTopRevenueSources(
    snapshot: RevenueSnapshot,
  ): AnalyticsTopRevenueSourceDTO[] {
    const totals = [
      {
        source_key: 'membership',
        source_label: 'Memberships',
        revenue: this.toMoneyNumber(snapshot.membership_revenue),
      },
      {
        source_key: 'bookings',
        source_label: 'Venue bookings',
        revenue: this.toMoneyNumber(snapshot.booking_revenue),
      },
      {
        source_key: 'products',
        source_label: 'Retail products',
        revenue: this.toMoneyNumber(snapshot.product_revenue),
      },
      {
        source_key: 'coaching',
        source_label: 'Coaching gym share',
        revenue: this.toMoneyNumber(snapshot.coaching_gym_revenue),
      },
    ].filter((entry) => entry.revenue > 0);
    const totalRevenue = totals.reduce((sum, entry) => sum + entry.revenue, 0);

    return totals
      .sort((left, right) => right.revenue - left.revenue)
      .map((entry) => ({
        source_key: entry.source_key,
        source_label: entry.source_label,
        revenue: entry.revenue.toFixed(2),
        share_percentage:
          totalRevenue > 0
            ? Number(((entry.revenue / totalRevenue) * 100).toFixed(1))
            : 0,
      }));
  }

  private toMoneyNumber(
    value: Prisma.Decimal | number | string | null,
  ): number {
    return value === null ? 0 : Number(value);
  }

  private toCount(value: bigint | number | null): number {
    return value === null ? 0 : Number(value);
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private toDateOnlyString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toHourLabel(value: bigint | number | null): string {
    return `${this.toCount(value).toString().padStart(2, '0')}:00`;
  }

  private toSystemAlert(
    alert: AnalyticsSystemAlertRow,
  ): AnalyticsSystemAlertDTO {
    return {
      action_label: alert.action_label,
      body: alert.body,
      href: alert.href,
      id: alert.id,
      kind: alert.kind,
      severity: alert.severity,
      title: alert.title,
    };
  }

  private toInventorySummary(result: InventorySummaryRows) {
    return {
      retail_items: this.toCount(result.retail.retail_items),
      low_stock_items: this.toCount(result.retail.low_stock_items),
      out_of_stock_items: this.toCount(result.retail.out_of_stock_items),
      retail_inventory_value: this.toMoneyNumber(
        result.retail.retail_inventory_value,
      ).toFixed(2),
      equipment_types: this.toCount(result.equipment.equipment_types),
      equipment_units_available: this.toCount(
        result.equipment.equipment_units_available,
      ),
      equipment_units_total: this.toCount(
        result.equipment.equipment_units_total,
      ),
      equipment_under_maintenance: this.toCount(
        result.equipment.equipment_under_maintenance,
      ),
      top_products: result.topProducts.map((row) => ({
        name: row.name,
        quantity_sold: this.toCount(row.quantity_sold),
        revenue: this.toMoneyNumber(row.revenue).toFixed(2),
      })),
    };
  }

  private shouldIncludeInventory(focus: InsightFocus): boolean {
    return focus === InsightFocus.overview || focus === InsightFocus.inventory;
  }

  private toRecentActivity(
    activity: AnalyticsRecentActivityRow,
  ): AnalyticsRecentActivityDTO {
    return {
      actor_name: activity.actor_name,
      description: activity.description,
      entity_id: activity.entity_id,
      entity_label: activity.entity_label,
      id: activity.id,
      kind: activity.kind,
      occurred_at: activity.occurred_at.toISOString(),
      status: activity.status,
      title: activity.title,
    };
  }

  private toCoachBreakdown(coach: {
    coach_id: string;
    first_name: string | null;
    last_name: string | null;
    total_billed: Prisma.Decimal | number | string | null;
    gym_cut: Prisma.Decimal | number | string | null;
    coach_payout: Prisma.Decimal | number | string | null;
    completed_sessions: bigint | number | null;
  }): AnalyticsCoachBreakdownDTO {
    return {
      coach_id: coach.coach_id,
      first_name: coach.first_name,
      last_name: coach.last_name,
      total_billed: this.toMoneyNumber(coach.total_billed).toFixed(2),
      gym_cut: this.toMoneyNumber(coach.gym_cut).toFixed(2),
      coach_payout: this.toMoneyNumber(coach.coach_payout).toFixed(2),
      completed_sessions: this.toCount(coach.completed_sessions),
    };
  }
}
