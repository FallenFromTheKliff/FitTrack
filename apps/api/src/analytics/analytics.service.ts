import { Injectable } from '@nestjs/common';
import { InsightFocus, InsightPeriod, Prisma } from '@prisma/client';

import {
  type AnalyticsAttendanceSeriesPointDTO,
  AnalyticsAttendanceResponseDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsOverviewResponseDTO,
  type AnalyticsPeriod,
  AnalyticsQueryDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueSeriesPointDTO,
  AnalyticsRevenueTotalsDTO,
} from './dto/analytics.dto';
import {
  type AttendanceMetricsRows,
  AnalyticsRepository,
  type RevenueMetricsRows,
} from './analytics.repository';
import {
  type BuildBusinessInsightGroundingInput,
  type BusinessAnalyticsGroundingPayload,
  type ResolvedBusinessInsightWindow,
} from './analytics.types';

type RevenueSnapshot = {
  booking_revenue: Prisma.Decimal | number | string | null;
  coaching_gym_revenue: Prisma.Decimal | number | string | null;
  coaching_payments_collected: Prisma.Decimal | number | string | null;
  membership_revenue: Prisma.Decimal | number | string | null;
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
      peakHours,
      topPlans,
      topProducts,
    ] = await Promise.all([
      this.repo.getRevenueMetrics(window.start, window.end, window.period),
      this.repo.getAttendanceMetrics(window.start, window.end, window.period),
      this.repo.getMemberMetrics(window.start, window.end),
      this.repo.getCoachEarningsMetrics(window.start, window.end),
      this.repo.getAttendancePeakHours(
        window.start,
        window.end,
        GROUNDING_RANK_LIMIT,
      ),
      this.repo.getTopMembershipPlans(
        window.start,
        window.end,
        GROUNDING_RANK_LIMIT,
      ),
      includeInventory
        ? this.repo.getTopInventoryProducts(
            window.start,
            window.end,
            GROUNDING_RANK_LIMIT,
          )
        : Promise.resolve(null),
    ]);
    const revenueTotals = this.toRevenueTotals({
      booking_revenue: revenue.payments.booking_revenue,
      coaching_payments_collected: revenue.payments.coaching_payments_collected,
      coaching_gym_revenue: revenue.coaching.coaching_gym_revenue,
      membership_revenue: revenue.payments.membership_revenue,
      product_revenue: revenue.payments.product_revenue,
    });
    const attendanceSeries = this.toAttendanceSeries(attendance.series);

    return {
      window: {
        start_date: this.toDateOnlyString(window.start),
        end_date: this.toDateOnlyString(window.end),
        period: window.period,
        focus: window.focus,
      },
      overview: {
        total_revenue: revenueTotals.total_revenue,
        total_check_ins: attendanceSeries.reduce(
          (total, point) => total + point.check_ins,
          0,
        ),
        new_members: this.toCount(membership.new_members),
        completed_coaching_sessions: this.toCount(
          revenue.coaching.completed_coaching_sessions,
        ),
      },
      revenue: {
        totals: revenueTotals,
        series: this.toRevenueSeries(revenue),
      },
      attendance: {
        series: attendanceSeries,
        peak_hours: peakHours.map((row) => ({
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
              top_products: (topProducts ?? []).map((row) => ({
                name: row.name,
                quantity_sold: this.toCount(row.quantity_sold),
                revenue: this.toMoneyNumber(row.revenue).toFixed(2),
              })),
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

    return {
      start: input.start_date
        ? new Date(`${input.start_date}T00:00:00.000Z`)
        : defaultStart,
      end: input.end_date
        ? new Date(`${input.end_date}T23:59:59.999Z`)
        : defaultEnd,
      focus: input.focus ?? DEFAULT_INSIGHT_FOCUS,
      period: input.period ?? DEFAULT_INSIGHT_PERIOD,
    };
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
      booking_revenue: bookingRevenue.toFixed(2),
      product_revenue: productRevenue.toFixed(2),
      coaching_payments_collected: coachingPaymentsCollected.toFixed(2),
      coaching_gym_revenue: coachingGymRevenue.toFixed(2),
      total_revenue: totalRevenue.toFixed(2),
    };
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

  private shouldIncludeInventory(focus: InsightFocus): boolean {
    return focus === InsightFocus.overview || focus === InsightFocus.inventory;
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
