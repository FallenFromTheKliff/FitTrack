import { Injectable } from '@nestjs/common';
import { InsightPeriod, Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsPeriod } from './dto/analytics.dto';

type PaymentRevenueTotalsRow = {
  membership_revenue: Prisma.Decimal | null;
  booking_revenue: Prisma.Decimal | null;
  product_revenue: Prisma.Decimal | null;
  coaching_payments_collected: Prisma.Decimal | null;
};

type CoachingRevenueSummaryRow = {
  coaching_gym_revenue: Prisma.Decimal | null;
  completed_coaching_sessions: bigint | number | null;
};

type AttendanceSummaryRow = {
  total_check_ins: bigint | number | null;
};

type AttendanceTrendRow = {
  bucket_start: Date | string;
  check_ins: bigint | number | null;
};

type MemberMetricsRow = {
  new_members: bigint | number | null;
  active_members: bigint | number | null;
};

type NewMembersSummaryRow = {
  new_members: bigint | number | null;
};

type PaymentRevenueSeriesRow = PaymentRevenueTotalsRow & {
  bucket_start: Date | string;
};

type CoachingRevenueSeriesRow = {
  bucket_start: Date | string;
  coaching_gym_revenue: Prisma.Decimal | null;
};

type AnalyticsSeriesPeriod = AnalyticsPeriod | InsightPeriod;

type CoachEarningsRow = {
  coach_id: string;
  first_name: string | null;
  last_name: string | null;
  total_billed: Prisma.Decimal | null;
  gym_cut: Prisma.Decimal | null;
  coach_payout: Prisma.Decimal | null;
  completed_sessions: bigint | number | null;
};

type AttendancePeakHourRow = {
  hour_of_day: bigint | number | null;
  check_ins: bigint | number | null;
};

type TopMembershipPlanRow = {
  name: string;
  revenue: Prisma.Decimal | null;
  subscriber_count: bigint | number | null;
};

type TopInventoryProductRow = {
  name: string;
  quantity_sold: bigint | number | null;
  revenue: Prisma.Decimal | null;
};

export type AnalyticsOverviewRows = {
  attendance: AttendanceSummaryRow;
  coaching: CoachingRevenueSummaryRow;
  members: NewMembersSummaryRow;
  payments: PaymentRevenueTotalsRow;
};

export type RevenueMetricsRows = {
  coaching: CoachingRevenueSummaryRow;
  coachingSeries: CoachingRevenueSeriesRow[];
  paymentSeries: PaymentRevenueSeriesRow[];
  payments: PaymentRevenueTotalsRow;
};

export type AttendanceMetricsRows = {
  series: AttendanceTrendRow[];
};

export type MemberMetricsRows = MemberMetricsRow;

export type CoachEarningsMetricsRows = {
  coaches: CoachEarningsRow[];
};

export type AttendancePeakHourRows = AttendancePeakHourRow[];

export type TopMembershipPlanRows = TopMembershipPlanRow[];

export type TopInventoryProductRows = TopInventoryProductRow[];

@Injectable()
export class AnalyticsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async getOverviewMetrics(
    start: Date,
    end: Date,
  ): Promise<AnalyticsOverviewRows> {
    const [payments, coaching, attendance, members] = await Promise.all([
      this.getPaymentRevenueTotals(start, end),
      this.getCoachingRevenueSummary(start, end),
      this.getAttendanceSummary(start, end),
      this.getNewMembersSummary(start, end),
    ]);

    return { attendance, coaching, members, payments };
  }

  async getRevenueMetrics(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<RevenueMetricsRows> {
    const [payments, coaching, paymentSeries, coachingSeries] =
      await Promise.all([
        this.getPaymentRevenueTotals(start, end),
        this.getCoachingRevenueSummary(start, end),
        this.getPaymentRevenueSeries(start, end, period),
        this.getCoachingRevenueSeries(start, end, period),
      ]);

    return { coaching, coachingSeries, paymentSeries, payments };
  }

  async getAttendanceMetrics(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<AttendanceMetricsRows> {
    return {
      series: await this.getAttendanceTrend(start, end, period),
    };
  }

  async getMemberMetrics(start: Date, end: Date): Promise<MemberMetricsRows> {
    return this.getMembersSummary(start, end);
  }

  async getCoachEarningsMetrics(
    start: Date,
    end: Date,
  ): Promise<CoachEarningsMetricsRows> {
    return {
      coaches: await this.getCoachEarnings(start, end),
    };
  }

  getAttendancePeakHours(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<AttendancePeakHourRows> {
    return this.queryRaw<AttendancePeakHourRow[]>`
      SELECT
        EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'UTC')::int AS hour_of_day,
        COUNT(*) AS check_ins
      FROM attendance_logs
      WHERE check_in_at BETWEEN ${start} AND ${end}
      GROUP BY 1
      ORDER BY check_ins DESC, hour_of_day ASC
      LIMIT ${limit}
    `;
  }

  getTopMembershipPlans(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<TopMembershipPlanRows> {
    return this.queryRaw<TopMembershipPlanRow[]>`
      SELECT
        membership_plans.name,
        COUNT(DISTINCT subscriptions.id) AS subscriber_count,
        COALESCE(SUM(payments.amount), 0) AS revenue
      FROM payments
      JOIN subscriptions ON subscriptions.id = payments.payable_id
      JOIN membership_plans ON membership_plans.id = subscriptions.plan_id
      WHERE payments.payable_type = 'subscription'
        AND payments.status = 'completed'
        AND payments.created_at BETWEEN ${start} AND ${end}
      GROUP BY membership_plans.id, membership_plans.name
      ORDER BY revenue DESC, subscriber_count DESC, membership_plans.name ASC
      LIMIT ${limit}
    `;
  }

  getTopInventoryProducts(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<TopInventoryProductRows> {
    return this.queryRaw<TopInventoryProductRow[]>`
      SELECT
        retail_products.name,
        COALESCE(SUM(sale_transaction_items.quantity), 0) AS quantity_sold,
        COALESCE(SUM(sale_transaction_items.subtotal), 0) AS revenue
      FROM sale_transactions
      JOIN sale_transaction_items
        ON sale_transaction_items.transaction_id = sale_transactions.id
      JOIN retail_products
        ON retail_products.id = sale_transaction_items.product_id
      WHERE sale_transactions.status = 'completed'
        AND sale_transactions.created_at BETWEEN ${start} AND ${end}
      GROUP BY retail_products.id, retail_products.name
      ORDER BY revenue DESC, quantity_sold DESC, retail_products.name ASC
      LIMIT ${limit}
    `;
  }

  private async getPaymentRevenueTotals(
    start: Date,
    end: Date,
  ): Promise<PaymentRevenueTotalsRow> {
    const rows = await this.queryRaw<PaymentRevenueTotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN payable_type = 'subscription' THEN amount ELSE 0 END), 0) AS membership_revenue,
        COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
        COALESCE(SUM(CASE WHEN payable_type = 'product' THEN amount ELSE 0 END), 0) AS product_revenue,
        COALESCE(SUM(CASE WHEN payable_type = 'coaching' THEN amount ELSE 0 END), 0) AS coaching_payments_collected
      FROM payments
      WHERE status = 'completed'
        AND created_at BETWEEN ${start} AND ${end}
    `;

    return (
      rows[0] ?? {
        membership_revenue: new Prisma.Decimal(0),
        booking_revenue: new Prisma.Decimal(0),
        product_revenue: new Prisma.Decimal(0),
        coaching_payments_collected: new Prisma.Decimal(0),
      }
    );
  }

  private async getCoachingRevenueSummary(
    start: Date,
    end: Date,
  ): Promise<CoachingRevenueSummaryRow> {
    const rows = await this.queryRaw<CoachingRevenueSummaryRow[]>`
      SELECT
        COALESCE(SUM(gym_revenue), 0) AS coaching_gym_revenue,
        COUNT(*) AS completed_coaching_sessions
      FROM coach_appointments
      WHERE status = 'completed'
        AND completed_at BETWEEN ${start} AND ${end}
    `;

    return (
      rows[0] ?? {
        coaching_gym_revenue: new Prisma.Decimal(0),
        completed_coaching_sessions: 0,
      }
    );
  }

  private async getAttendanceSummary(
    start: Date,
    end: Date,
  ): Promise<AttendanceSummaryRow> {
    const rows = await this.queryRaw<AttendanceSummaryRow[]>`
      SELECT COUNT(*) AS total_check_ins
      FROM attendance_logs
      WHERE check_in_at BETWEEN ${start} AND ${end}
    `;

    return rows[0] ?? { total_check_ins: 0 };
  }

  private async getNewMembersSummary(
    start: Date,
    end: Date,
  ): Promise<NewMembersSummaryRow> {
    const rows = await this.queryRaw<NewMembersSummaryRow[]>`
      SELECT COUNT(*) AS new_members
      FROM users
      WHERE role = 'member'
        AND created_at BETWEEN ${start} AND ${end}
    `;

    return rows[0] ?? { new_members: 0 };
  }

  private async getMembersSummary(
    start: Date,
    end: Date,
  ): Promise<MemberMetricsRow> {
    const rows = await this.queryRaw<MemberMetricsRow[]>`
      SELECT
        (
          SELECT COUNT(*)
          FROM users
          WHERE role = 'member'
            AND created_at BETWEEN ${start} AND ${end}
        ) AS new_members,
        (
          SELECT COUNT(DISTINCT subscriptions.user_id)
          FROM subscriptions
          JOIN users ON users.id = subscriptions.user_id
          WHERE users.role = 'member'
            AND subscriptions.starts_at IS NOT NULL
            AND subscriptions.starts_at <= ${end}
            AND COALESCE(subscriptions.expires_at, ${end}) >= ${start}
            AND subscriptions.status IN ('active', 'past_due', 'cancelled', 'expired')
        ) AS active_members
    `;

    return rows[0] ?? { active_members: 0, new_members: 0 };
  }

  private getPaymentRevenueSeries(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<PaymentRevenueSeriesRow[]> {
    switch (this.normalizeSeriesPeriod(period)) {
      case 'daily':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          SELECT
            date_trunc('day', created_at) AS bucket_start,
            COALESCE(SUM(CASE WHEN payable_type = 'subscription' THEN amount ELSE 0 END), 0) AS membership_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'product' THEN amount ELSE 0 END), 0) AS product_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'coaching' THEN amount ELSE 0 END), 0) AS coaching_payments_collected
          FROM payments
          WHERE status = 'completed'
            AND created_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          SELECT
            date_trunc('week', created_at) AS bucket_start,
            COALESCE(SUM(CASE WHEN payable_type = 'subscription' THEN amount ELSE 0 END), 0) AS membership_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'product' THEN amount ELSE 0 END), 0) AS product_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'coaching' THEN amount ELSE 0 END), 0) AS coaching_payments_collected
          FROM payments
          WHERE status = 'completed'
            AND created_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          SELECT
            date_trunc('year', created_at) AS bucket_start,
            COALESCE(SUM(CASE WHEN payable_type = 'subscription' THEN amount ELSE 0 END), 0) AS membership_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'product' THEN amount ELSE 0 END), 0) AS product_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'coaching' THEN amount ELSE 0 END), 0) AS coaching_payments_collected
          FROM payments
          WHERE status = 'completed'
            AND created_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'monthly':
      default:
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          SELECT
            date_trunc('month', created_at) AS bucket_start,
            COALESCE(SUM(CASE WHEN payable_type = 'subscription' THEN amount ELSE 0 END), 0) AS membership_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'product' THEN amount ELSE 0 END), 0) AS product_revenue,
            COALESCE(SUM(CASE WHEN payable_type = 'coaching' THEN amount ELSE 0 END), 0) AS coaching_payments_collected
          FROM payments
          WHERE status = 'completed'
            AND created_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
    }
  }

  private getCoachingRevenueSeries(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<CoachingRevenueSeriesRow[]> {
    switch (this.normalizeSeriesPeriod(period)) {
      case 'daily':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('day', completed_at) AS bucket_start,
            COALESCE(SUM(gym_revenue), 0) AS coaching_gym_revenue
          FROM coach_appointments
          WHERE status = 'completed'
            AND completed_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('week', completed_at) AS bucket_start,
            COALESCE(SUM(gym_revenue), 0) AS coaching_gym_revenue
          FROM coach_appointments
          WHERE status = 'completed'
            AND completed_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('year', completed_at) AS bucket_start,
            COALESCE(SUM(gym_revenue), 0) AS coaching_gym_revenue
          FROM coach_appointments
          WHERE status = 'completed'
            AND completed_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'monthly':
      default:
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('month', completed_at) AS bucket_start,
            COALESCE(SUM(gym_revenue), 0) AS coaching_gym_revenue
          FROM coach_appointments
          WHERE status = 'completed'
            AND completed_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
    }
  }

  private getAttendanceTrend(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<AttendanceTrendRow[]> {
    switch (this.normalizeSeriesPeriod(period)) {
      case 'daily':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('day', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          WHERE check_in_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('week', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          WHERE check_in_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('year', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          WHERE check_in_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'monthly':
      default:
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('month', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          WHERE check_in_at BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
    }
  }

  private getCoachEarnings(
    start: Date,
    end: Date,
  ): Promise<CoachEarningsRow[]> {
    return this.queryRaw<CoachEarningsRow[]>`
      SELECT
        coach_profiles.id AS coach_id,
        user_profiles.first_name,
        user_profiles.last_name,
        COALESCE(SUM(coach_appointments.total_amount), 0) AS total_billed,
        COALESCE(SUM(coach_appointments.gym_revenue), 0) AS gym_cut,
        COALESCE(SUM(coach_appointments.coach_earnings), 0) AS coach_payout,
        COUNT(*) AS completed_sessions
      FROM coach_appointments
      JOIN coach_profiles ON coach_profiles.id = coach_appointments.coach_id
      LEFT JOIN user_profiles ON user_profiles.user_id = coach_profiles.user_id
      WHERE coach_appointments.status = 'completed'
        AND coach_appointments.completed_at BETWEEN ${start} AND ${end}
      GROUP BY coach_profiles.id, user_profiles.first_name, user_profiles.last_name
      ORDER BY gym_cut DESC, total_billed DESC, coach_profiles.id ASC
    `;
  }

  private normalizeSeriesPeriod(
    period: AnalyticsSeriesPeriod,
  ): AnalyticsPeriod {
    return period === InsightPeriod.custom ? 'daily' : period;
  }
}
