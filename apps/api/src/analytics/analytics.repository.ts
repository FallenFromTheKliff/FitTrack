import { Injectable } from '@nestjs/common';
import { InsightPeriod, Prisma, SaleStatus } from '@prisma/client';

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

type ActiveMembersCountRow = {
  active_members: bigint | number | null;
};

type ActiveMemberTrendRow = {
  bucket_start: Date | string;
  active_members: bigint | number | null;
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

type RetailInventorySummaryRow = {
  low_stock_items: bigint | number | null;
  out_of_stock_items: bigint | number | null;
  retail_inventory_value: Prisma.Decimal | null;
  retail_items: bigint | number | null;
};

type EquipmentInventorySummaryRow = {
  equipment_types: bigint | number | null;
  equipment_under_maintenance: bigint | number | null;
  equipment_units_available: bigint | number | null;
  equipment_units_total: bigint | number | null;
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
  peakHours: AttendancePeakHourRow[];
  series: AttendanceTrendRow[];
  summary: AttendanceSummaryRow;
};

export type MemberMetricsRows = MemberMetricsRow;

export type CoachEarningsMetricsRows = {
  coaches: CoachEarningsRow[];
};

export type AttendancePeakHourRows = AttendancePeakHourRow[];

export type TopMembershipPlanRows = TopMembershipPlanRow[];

export type TopInventoryProductRows = TopInventoryProductRow[];

export type InventorySummaryRows = {
  equipment: EquipmentInventorySummaryRow;
  retail: RetailInventorySummaryRow;
  topProducts: TopInventoryProductRows;
};

export type ActiveMemberTrendRows = ActiveMemberTrendRow[];

export type AnalyticsSystemAlertRow = {
  action_label: string;
  body: string;
  href: string;
  id: string;
  kind: 'low_stock' | 'maintenance_due';
  severity: 'warning';
  title: string;
};

export type AnalyticsFeedbackMetricsRow = {
  app_feedback_submissions: number;
  coach_satisfaction_rating: Prisma.Decimal | number | null;
  venue_feedback_rating: Prisma.Decimal | number | null;
};

export type AnalyticsRecentActivityRow = {
  actor_name: string;
  description: string;
  entity_id: string;
  entity_label: string;
  id: string;
  kind: 'attendance' | 'booking' | 'coaching' | 'sale';
  occurred_at: Date;
  status: string;
  title: string;
};

function toDisplayName(
  profile?: {
    first_name: string | null;
    last_name: string | null;
  } | null,
) {
  if (!profile) return 'FitTrack member';
  return (
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() ||
    'FitTrack member'
  );
}

const VISIBLE_MEMBER_USER_WHERE = {
  deletedAt: null,
  deletion_requests: {
    none: {
      status: 'pending',
    },
  },
  role: 'member',
} satisfies Prisma.UserWhereInput;

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
    const [summary, peakHours, series] = await Promise.all([
      this.getAttendanceSummary(start, end),
      this.getAttendancePeakHours(start, end, 5),
      this.getAttendanceTrend(start, end, period),
    ]);

    return {
      peakHours,
      series,
      summary,
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

  async getCurrentActiveMembers(referenceDate: Date): Promise<number> {
    const rows = await this.queryRaw<ActiveMembersCountRow[]>`
      SELECT COUNT(DISTINCT users.id) AS active_members
      FROM users
      LEFT JOIN membership_cards
        ON membership_cards.user_id = users.id
       AND membership_cards.status = 'active'
       AND COALESCE(
         membership_cards.activated_at,
         membership_cards.verified_at,
         membership_cards.purchased_at
       ) <= ${referenceDate}
       AND (
         membership_cards.revoked_at IS NULL
         OR membership_cards.revoked_at > ${referenceDate}
       )
      LEFT JOIN subscriptions
        ON subscriptions.user_id = users.id
       AND (
         subscriptions.status IN ('active', 'past_due')
         OR (
           subscriptions.status = 'cancelled'
           AND subscriptions.expires_at > ${referenceDate}
         )
       )
       AND COALESCE(
         subscriptions.starts_at,
         subscriptions.created_at
       ) <= ${referenceDate}
      LEFT JOIN account_deletion_requests pending_requests
        ON pending_requests.user_id = users.id
       AND pending_requests.status = 'pending'
      WHERE users.role = 'member'
        AND users."deletedAt" IS NULL
        AND pending_requests.id IS NULL
        AND (
          membership_cards.id IS NOT NULL
          OR subscriptions.id IS NOT NULL
        )
    `;

    return Number(rows[0]?.active_members ?? 0);
  }

  async getActiveMemberTrend(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<ActiveMemberTrendRows> {
    switch (this.normalizeSeriesPeriod(period)) {
      case 'hourly':
        return this.queryRaw<ActiveMemberTrendRows>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('hour', ${start}::timestamptz),
              date_trunc('hour', ${end}::timestamptz),
              interval '1 hour'
            ) AS bucket_start
          )
          SELECT
            buckets.bucket_start,
            COUNT(DISTINCT CASE
              WHEN pending_requests.id IS NULL
               AND (
                 membership_cards.id IS NOT NULL
                 OR subscriptions.id IS NOT NULL
               )
              THEN users.id
            END) AS active_members
          FROM buckets
          LEFT JOIN users
            ON users.role = 'member'
           AND users."deletedAt" IS NULL
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          LEFT JOIN membership_cards
            ON membership_cards.user_id = users.id
           AND membership_cards.status = 'active'
           AND COALESCE(
             membership_cards.activated_at,
             membership_cards.verified_at,
             membership_cards.purchased_at
           ) <= buckets.bucket_start
           AND (
             membership_cards.revoked_at IS NULL
             OR membership_cards.revoked_at > buckets.bucket_start
           )
          LEFT JOIN subscriptions
            ON subscriptions.user_id = users.id
           AND (
             subscriptions.status IN ('active', 'past_due')
             OR (
               subscriptions.status = 'cancelled'
               AND subscriptions.expires_at > buckets.bucket_start
             )
           )
           AND COALESCE(
             subscriptions.starts_at,
             subscriptions.created_at
           ) <= buckets.bucket_start
          GROUP BY buckets.bucket_start
          ORDER BY buckets.bucket_start
        `;
      case 'daily':
        return this.queryRaw<ActiveMemberTrendRows>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('day', ${start}::timestamptz),
              date_trunc('day', ${end}::timestamptz),
              interval '1 day'
            ) AS bucket_start
          )
          SELECT
            buckets.bucket_start,
            COUNT(DISTINCT CASE
              WHEN pending_requests.id IS NULL
               AND (
                 membership_cards.id IS NOT NULL
                 OR subscriptions.id IS NOT NULL
               )
              THEN users.id
            END) AS active_members
          FROM buckets
          LEFT JOIN users
            ON users.role = 'member'
           AND users."deletedAt" IS NULL
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          LEFT JOIN membership_cards
            ON membership_cards.user_id = users.id
           AND membership_cards.status = 'active'
           AND COALESCE(
             membership_cards.activated_at,
             membership_cards.verified_at,
             membership_cards.purchased_at
           ) <= buckets.bucket_start
           AND (
             membership_cards.revoked_at IS NULL
             OR membership_cards.revoked_at > buckets.bucket_start
           )
          LEFT JOIN subscriptions
            ON subscriptions.user_id = users.id
           AND (
             subscriptions.status IN ('active', 'past_due')
             OR (
               subscriptions.status = 'cancelled'
               AND subscriptions.expires_at > buckets.bucket_start
             )
           )
           AND COALESCE(
             subscriptions.starts_at,
             subscriptions.created_at
           ) <= buckets.bucket_start
          GROUP BY buckets.bucket_start
          ORDER BY buckets.bucket_start
        `;
      case 'weekly':
        return this.queryRaw<ActiveMemberTrendRows>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('week', ${start}::timestamptz),
              date_trunc('week', ${end}::timestamptz),
              interval '1 week'
            ) AS bucket_start
          )
          SELECT
            buckets.bucket_start,
            COUNT(DISTINCT CASE
              WHEN pending_requests.id IS NULL
               AND (
                 membership_cards.id IS NOT NULL
                 OR subscriptions.id IS NOT NULL
               )
              THEN users.id
            END) AS active_members
          FROM buckets
          LEFT JOIN users
            ON users.role = 'member'
           AND users."deletedAt" IS NULL
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          LEFT JOIN membership_cards
            ON membership_cards.user_id = users.id
           AND membership_cards.status = 'active'
           AND COALESCE(
             membership_cards.activated_at,
             membership_cards.verified_at,
             membership_cards.purchased_at
           ) <= buckets.bucket_start
           AND (
             membership_cards.revoked_at IS NULL
             OR membership_cards.revoked_at > buckets.bucket_start
           )
          LEFT JOIN subscriptions
            ON subscriptions.user_id = users.id
           AND (
             subscriptions.status IN ('active', 'past_due')
             OR (
               subscriptions.status = 'cancelled'
               AND subscriptions.expires_at > buckets.bucket_start
             )
           )
           AND COALESCE(
             subscriptions.starts_at,
             subscriptions.created_at
           ) <= buckets.bucket_start
          GROUP BY buckets.bucket_start
          ORDER BY buckets.bucket_start
        `;
      case 'yearly':
        return this.queryRaw<ActiveMemberTrendRows>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('year', ${start}::timestamptz),
              date_trunc('year', ${end}::timestamptz),
              interval '1 year'
            ) AS bucket_start
          )
          SELECT
            buckets.bucket_start,
            COUNT(DISTINCT CASE
              WHEN pending_requests.id IS NULL
               AND (
                 membership_cards.id IS NOT NULL
                 OR subscriptions.id IS NOT NULL
               )
              THEN users.id
            END) AS active_members
          FROM buckets
          LEFT JOIN users
            ON users.role = 'member'
           AND users."deletedAt" IS NULL
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          LEFT JOIN membership_cards
            ON membership_cards.user_id = users.id
           AND membership_cards.status = 'active'
           AND COALESCE(
             membership_cards.activated_at,
             membership_cards.verified_at,
             membership_cards.purchased_at
           ) <= buckets.bucket_start
           AND (
             membership_cards.revoked_at IS NULL
             OR membership_cards.revoked_at > buckets.bucket_start
           )
          LEFT JOIN subscriptions
            ON subscriptions.user_id = users.id
           AND (
             subscriptions.status IN ('active', 'past_due')
             OR (
               subscriptions.status = 'cancelled'
               AND subscriptions.expires_at > buckets.bucket_start
             )
           )
           AND COALESCE(
             subscriptions.starts_at,
             subscriptions.created_at
           ) <= buckets.bucket_start
          GROUP BY buckets.bucket_start
          ORDER BY buckets.bucket_start
        `;
      case 'monthly':
      default:
        return this.queryRaw<ActiveMemberTrendRows>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc('month', ${start}::timestamptz),
              date_trunc('month', ${end}::timestamptz),
              interval '1 month'
            ) AS bucket_start
          )
          SELECT
            buckets.bucket_start,
            COUNT(DISTINCT CASE
              WHEN pending_requests.id IS NULL
               AND (
                 membership_cards.id IS NOT NULL
                 OR subscriptions.id IS NOT NULL
               )
              THEN users.id
            END) AS active_members
          FROM buckets
          LEFT JOIN users
            ON users.role = 'member'
           AND users."deletedAt" IS NULL
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          LEFT JOIN membership_cards
            ON membership_cards.user_id = users.id
           AND membership_cards.status = 'active'
           AND COALESCE(
             membership_cards.activated_at,
             membership_cards.verified_at,
             membership_cards.purchased_at
           ) <= buckets.bucket_start
           AND (
             membership_cards.revoked_at IS NULL
             OR membership_cards.revoked_at > buckets.bucket_start
           )
          LEFT JOIN subscriptions
            ON subscriptions.user_id = users.id
           AND (
             subscriptions.status IN ('active', 'past_due')
             OR (
               subscriptions.status = 'cancelled'
               AND subscriptions.expires_at > buckets.bucket_start
             )
           )
           AND COALESCE(
             subscriptions.starts_at,
             subscriptions.created_at
           ) <= buckets.bucket_start
          GROUP BY buckets.bucket_start
          ORDER BY buckets.bucket_start
        `;
    }
  }

  getCheckInCount(start: Date, end: Date): Promise<number> {
    return this.count(this.prisma.attendanceLog, {
      check_in_at: {
        gte: start,
        lte: end,
      },
      user: VISIBLE_MEMBER_USER_WHERE,
    });
  }

  getVenueBookingCount(start: Date, end: Date): Promise<number> {
    return this.count(this.prisma.amenityBooking, {
      created_at: {
        gte: start,
        lte: end,
      },
    });
  }

  getCoachingAppointmentCount(start: Date, end: Date): Promise<number> {
    return this.count(this.prisma.coachAppointment, {
      created_at: {
        gte: start,
        lte: end,
      },
    });
  }

  async getFeedbackMetrics(): Promise<AnalyticsFeedbackMetricsRow> {
    const [appFeedbackSubmissions, coachReviews, amenityFeedback] =
      await Promise.all([
        this.count(this.prisma.appFeedback, {}),
        this.prisma.coachReview.aggregate({
          _avg: {
            rating: true,
          },
        }),
        this.prisma.amenityFeedback.aggregate({
          _avg: {
            rating: true,
          },
        }),
      ]);

    return {
      app_feedback_submissions: appFeedbackSubmissions,
      coach_satisfaction_rating: coachReviews._avg.rating ?? 0,
      venue_feedback_rating: amenityFeedback._avg.rating ?? 0,
    };
  }

  async getRecentActivityCountSince(since: Date): Promise<number> {
    const [attendanceCount, bookingCount, coachingCount, saleCount] =
      await Promise.all([
        this.count(this.prisma.attendanceLog, {
          check_in_at: {
            gte: since,
          },
          user: VISIBLE_MEMBER_USER_WHERE,
        }),
        this.count(this.prisma.amenityBooking, {
          user: VISIBLE_MEMBER_USER_WHERE,
          OR: [
            { created_at: { gte: since } },
            { completed_at: { gte: since } },
            { cancelled_at: { gte: since } },
          ],
        }),
        this.count(this.prisma.coachAppointment, {
          user: VISIBLE_MEMBER_USER_WHERE,
          OR: [
            { created_at: { gte: since } },
            { completed_at: { gte: since } },
            { cancelled_at: { gte: since } },
            { no_show_at: { gte: since } },
          ],
        }),
        this.count(this.prisma.saleTransaction, {
          OR: [
            { customer_user_id: null },
            { customer_user: VISIBLE_MEMBER_USER_WHERE },
          ],
          status: SaleStatus.completed,
          created_at: {
            gte: since,
          },
        }),
      ]);

    return attendanceCount + bookingCount + coachingCount + saleCount;
  }

  async listSystemAlerts(limit = 4): Promise<AnalyticsSystemAlertRow[]> {
    const perLane = Math.max(1, Math.ceil(limit / 2));
    const [lowStockProducts, equipmentAttentionItems] = await Promise.all([
      this.prisma.retailProduct.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ stock_quantity: 'asc' }, { updated_at: 'desc' }],
        take: limit * 3,
      }),
      this.prisma.gymEquipmentItem.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ quantity_current: 'asc' }, { updated_at: 'desc' }],
        take: limit * 3,
      }),
    ]);

    const lowStockAlerts: AnalyticsSystemAlertRow[] = lowStockProducts
      .filter((product) => product.stock_quantity <= product.reorder_threshold)
      .slice(0, perLane)
      .map((product) => ({
        id: product.id,
        kind: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Alert',
        body: `${product.name} is down to ${product.stock_quantity} units and needs replenishment to stay above the ${product.reorder_threshold}-unit threshold.`,
        action_label: 'OPEN RESTOCK',
        href: `/inventory?tab=retail&modal=restock&productId=${encodeURIComponent(product.id)}`,
      }));

    const maintenanceAlerts: AnalyticsSystemAlertRow[] = equipmentAttentionItems
      .filter((item) => item.quantity_current < item.quantity_total)
      .slice(0, perLane)
      .map((item) => {
        const missingCount = Math.max(
          item.quantity_total - item.quantity_current,
          0,
        );

        return {
          id: item.id,
          kind: 'maintenance_due',
          severity: 'warning',
          title: 'Maintenance Due',
          body: `${item.name} has ${missingCount} ${item.unit} unavailable and needs maintenance follow-up.`,
          action_label: 'REVIEW EQUIPMENT',
          href: `/inventory?tab=equipment&modal=details&equipmentId=${encodeURIComponent(item.id)}`,
        };
      });

    return [...lowStockAlerts, ...maintenanceAlerts].slice(0, limit);
  }

  async listRecentActivities(limit = 8): Promise<AnalyticsRecentActivityRow[]> {
    const [attendanceLogs, amenityBookings, coachAppointments, sales] =
      await Promise.all([
        this.prisma.attendanceLog.findMany({
          take: limit * 3,
          where: {
            user: VISIBLE_MEMBER_USER_WHERE,
          },
          orderBy: { check_in_at: 'desc' },
          include: {
            user: {
              select: {
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.amenityBooking.findMany({
          take: limit * 3,
          where: {
            user: VISIBLE_MEMBER_USER_WHERE,
          },
          orderBy: { updated_at: 'desc' },
          include: {
            amenity: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.coachAppointment.findMany({
          take: limit * 3,
          where: {
            user: VISIBLE_MEMBER_USER_WHERE,
          },
          orderBy: { updated_at: 'desc' },
          include: {
            coach: {
              select: {
                display_name: true,
              },
            },
            user: {
              select: {
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.saleTransaction.findMany({
          take: limit * 3,
          where: {
            OR: [
              { customer_user_id: null },
              { customer_user: VISIBLE_MEMBER_USER_WHERE },
            ],
            status: SaleStatus.completed,
          },
          orderBy: { created_at: 'desc' },
          include: {
            customer_user: {
              select: {
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
            items: {
              select: {
                quantity: true,
              },
            },
            staff: {
              select: {
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const activities: AnalyticsRecentActivityRow[] = [
      ...attendanceLogs.map((entry) => {
        const actorName = toDisplayName(entry.user.profile);

        return {
          id: entry.id,
          kind: 'attendance' as const,
          title: 'Attendance check-in',
          description: `${actorName} checked in and started a new training day.`,
          occurred_at: entry.check_in_at,
          actor_name: actorName,
          status: 'completed',
          entity_label: 'Attendance',
          entity_id: entry.id,
        };
      }),
      ...amenityBookings.map((entry) => {
        const actorName = toDisplayName(entry.user.profile);
        const occurredAt =
          entry.completed_at ?? entry.cancelled_at ?? entry.created_at;
        const isMaintenanceCancellation =
          entry.cancellation_reason === 'VENUE_MAINTENANCE';

        return {
          id: entry.id,
          kind: 'booking' as const,
          title: 'Venue booking activity',
          description: isMaintenanceCancellation
            ? `${entry.amenity.name} was cancelled by operations because of venue maintenance.`
            : `${actorName} updated a ${entry.amenity.name} booking.`,
          occurred_at: occurredAt,
          actor_name: actorName,
          status: isMaintenanceCancellation
            ? 'operational_maintenance'
            : entry.status,
          entity_label: 'Venue booking',
          entity_id: entry.id,
        };
      }),
      ...coachAppointments.map((entry) => {
        const actorName = toDisplayName(entry.user.profile);
        const coachName = entry.coach.display_name?.trim() || 'Coach profile';
        const occurredAt =
          entry.completed_at ??
          entry.cancelled_at ??
          entry.no_show_at ??
          entry.created_at;

        return {
          id: entry.id,
          kind: 'coaching' as const,
          title: 'Coaching appointment activity',
          description: `${actorName} has a ${entry.status.replace(/_/g, ' ')} coaching flow with ${coachName}.`,
          occurred_at: occurredAt,
          actor_name: actorName,
          status: entry.status,
          entity_label: 'Coaching appointment',
          entity_id: entry.id,
        };
      }),
      ...sales.map((entry) => {
        const customerName = entry.customer_name?.trim();
        const actorName = customerName
          ? customerName
          : entry.customer_user?.profile
            ? toDisplayName(entry.customer_user.profile)
            : 'Walk-in customer';
        const itemCount = entry.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
        const sourceLabel =
          entry.source === 'mobile'
            ? 'through the mobile app'
            : 'from the retail counter';

        return {
          id: entry.id,
          kind: 'sale' as const,
          title: 'Retail sale completed',
          description: `${actorName} purchased ${itemCount} item${itemCount === 1 ? '' : 's'} ${sourceLabel}.`,
          occurred_at: entry.created_at,
          actor_name:
            entry.source === 'mobile'
              ? actorName
              : toDisplayName(entry.staff.profile),
          status: entry.status,
          entity_label: 'Retail sale',
          entity_id: entry.id,
        };
      }),
    ];

    return activities
      .sort(
        (left, right) =>
          right.occurred_at.getTime() - left.occurred_at.getTime(),
      )
      .slice(0, limit);
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
      JOIN users ON users.id = attendance_logs.user_id
      LEFT JOIN account_deletion_requests pending_requests
        ON pending_requests.user_id = users.id
       AND pending_requests.status = 'pending'
      WHERE check_in_at BETWEEN ${start} AND ${end}
        AND users.role = 'member'
        AND users."deletedAt" IS NULL
        AND pending_requests.id IS NULL
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
      WITH membership_sources AS (
        SELECT
          membership_plans.name,
          subscriptions.id AS source_id,
          payments.amount
        FROM payments
        JOIN subscriptions ON subscriptions.id = payments.payable_id
        JOIN membership_plans ON membership_plans.id = subscriptions.plan_id
        WHERE payments.payable_type = 'subscription'
          AND payments.status = 'completed'
          AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}

        UNION ALL

        SELECT
          'Membership Card Access' AS name,
          membership_cards.id AS source_id,
          payments.amount
        FROM payments
        JOIN membership_cards ON membership_cards.id = payments.payable_id
        WHERE payments.payable_type = 'membership_card'
          AND payments.status = 'completed'
          AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
      )
      SELECT
        name,
        COUNT(DISTINCT source_id) AS subscriber_count,
        COALESCE(SUM(amount), 0) AS revenue
      FROM membership_sources
      GROUP BY name
      ORDER BY revenue DESC, subscriber_count DESC, name ASC
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

  async getInventorySummary(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<InventorySummaryRows> {
    const [retail, equipment, topProducts] = await Promise.all([
      this.getRetailInventorySummary(),
      this.getEquipmentInventorySummary(),
      this.getTopInventoryProducts(start, end, limit),
    ]);

    return {
      equipment,
      retail,
      topProducts,
    };
  }

  private async getPaymentRevenueTotals(
    start: Date,
    end: Date,
  ): Promise<PaymentRevenueTotalsRow> {
    const rows = await this.queryRaw<PaymentRevenueTotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
        COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
        (
          SELECT COALESCE(SUM(total_amount), 0)
          FROM sale_transactions
          WHERE status = 'completed'
            AND created_at BETWEEN ${start} AND ${end}
        ) AS product_revenue,
        COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
      FROM payments
      WHERE status = 'completed'
        AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
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
      WITH coaching_payment_rows AS (
        SELECT COALESCE(SUM(gym_share), 0) AS coaching_gym_revenue
        FROM (
          SELECT
            payments.amount * (
              COALESCE(coach_appointments.gym_revenue, 0) /
              NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
            ) AS gym_share
          FROM payments
          JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          WHERE payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}

          UNION ALL

          SELECT
            payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100) AS gym_share
          FROM payments
          JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = recurring_coaching_plans.coach_id
          WHERE payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
        ) coaching_gym_share_rows
      ),
      completed_session_rows AS (
        SELECT COUNT(*) AS completed_coaching_sessions
        FROM coach_appointments
        WHERE status = 'completed'
          AND completed_at BETWEEN ${start} AND ${end}
      )
      SELECT
        coaching_payment_rows.coaching_gym_revenue,
        completed_session_rows.completed_coaching_sessions
      FROM coaching_payment_rows
      CROSS JOIN completed_session_rows
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
      JOIN users ON users.id = attendance_logs.user_id
      LEFT JOIN account_deletion_requests pending_requests
        ON pending_requests.user_id = users.id
       AND pending_requests.status = 'pending'
      WHERE check_in_at BETWEEN ${start} AND ${end}
        AND users.role = 'member'
        AND users."deletedAt" IS NULL
        AND pending_requests.id IS NULL
    `;

    return rows[0] ?? { total_check_ins: 0 };
  }

  private async getNewMembersSummary(
    start: Date,
    end: Date,
  ): Promise<NewMembersSummaryRow> {
    const rows = await this.queryRaw<NewMembersSummaryRow[]>`
      SELECT COUNT(*) AS new_members
      FROM membership_cards
      JOIN users ON users.id = membership_cards.user_id
      LEFT JOIN account_deletion_requests pending_requests
        ON pending_requests.user_id = users.id
       AND pending_requests.status = 'pending'
      WHERE users.role = 'member'
        AND users."deletedAt" IS NULL
        AND pending_requests.id IS NULL
        AND membership_cards.status = 'active'
        AND COALESCE(
          membership_cards.activated_at,
          membership_cards.verified_at,
          membership_cards.purchased_at
        ) BETWEEN ${start} AND ${end}
    `;

    return rows[0] ?? { new_members: 0 };
  }

  private async getMembersSummary(
    start: Date,
    end: Date,
  ): Promise<MemberMetricsRow> {
    const [rows, activeMembers] = await Promise.all([
      this.queryRaw<NewMembersSummaryRow[]>`
        SELECT COUNT(*) AS new_members
        FROM membership_cards
        JOIN users ON users.id = membership_cards.user_id
        LEFT JOIN account_deletion_requests pending_requests
          ON pending_requests.user_id = users.id
         AND pending_requests.status = 'pending'
        WHERE users.role = 'member'
          AND users."deletedAt" IS NULL
          AND pending_requests.id IS NULL
          AND membership_cards.status = 'active'
          AND COALESCE(
            membership_cards.activated_at,
            membership_cards.verified_at,
            membership_cards.purchased_at
          ) BETWEEN ${start} AND ${end}
      `,
      this.getCurrentActiveMembers(end),
    ]);

    return {
      new_members: Number(rows[0]?.new_members ?? 0),
      active_members: activeMembers,
    };
  }

  private async getRetailInventorySummary(): Promise<RetailInventorySummaryRow> {
    const rows = await this.queryRaw<RetailInventorySummaryRow[]>`
      SELECT
        COUNT(*) AS retail_items,
        COUNT(*) FILTER (
          WHERE stock_quantity > 0
            AND stock_quantity <= reorder_threshold
        ) AS low_stock_items,
        COUNT(*) FILTER (
          WHERE stock_quantity <= 0
        ) AS out_of_stock_items,
        COALESCE(SUM(price * stock_quantity), 0) AS retail_inventory_value
      FROM retail_products
      WHERE is_active = true
    `;

    return (
      rows[0] ?? {
        retail_items: 0,
        low_stock_items: 0,
        out_of_stock_items: 0,
        retail_inventory_value: new Prisma.Decimal(0),
      }
    );
  }

  private async getEquipmentInventorySummary(): Promise<EquipmentInventorySummaryRow> {
    const rows = await this.queryRaw<EquipmentInventorySummaryRow[]>`
      SELECT
        COUNT(*) AS equipment_types,
        COALESCE(SUM(quantity_current), 0) AS equipment_units_available,
        COALESCE(SUM(quantity_total), 0) AS equipment_units_total,
        COUNT(*) FILTER (
          WHERE quantity_current < quantity_total
        ) AS equipment_under_maintenance
      FROM gym_equipment_items
      WHERE is_active = true
    `;

    return (
      rows[0] ?? {
        equipment_types: 0,
        equipment_units_available: 0,
        equipment_units_total: 0,
        equipment_under_maintenance: 0,
      }
    );
  }

  private getPaymentRevenueSeries(
    start: Date,
    end: Date,
    period: AnalyticsSeriesPeriod,
  ): Promise<PaymentRevenueSeriesRow[]> {
    switch (this.normalizeSeriesPeriod(period)) {
      case 'hourly':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          WITH payment_rows AS (
            SELECT
              date_trunc('hour', COALESCE(verified_at, created_at)) AS bucket_start,
              COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
              COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
              COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
            FROM payments
            WHERE status = 'completed'
              AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
            GROUP BY 1
          ),
          sale_rows AS (
            SELECT
              date_trunc('hour', created_at) AS bucket_start,
              COALESCE(SUM(total_amount), 0) AS product_revenue
            FROM sale_transactions
            WHERE status = 'completed'
              AND created_at BETWEEN ${start} AND ${end}
            GROUP BY 1
          )
          SELECT
            COALESCE(payment_rows.bucket_start, sale_rows.bucket_start) AS bucket_start,
            COALESCE(payment_rows.membership_revenue, 0) AS membership_revenue,
            COALESCE(payment_rows.booking_revenue, 0) AS booking_revenue,
            COALESCE(sale_rows.product_revenue, 0) AS product_revenue,
            COALESCE(payment_rows.coaching_payments_collected, 0) AS coaching_payments_collected
          FROM payment_rows
          FULL OUTER JOIN sale_rows
            ON sale_rows.bucket_start = payment_rows.bucket_start
          ORDER BY 1
        `;
      case 'daily':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          WITH payment_rows AS (
            SELECT
              date_trunc('day', COALESCE(verified_at, created_at)) AS bucket_start,
              COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
              COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
              COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
            FROM payments
            WHERE status = 'completed'
              AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
            GROUP BY 1
          ),
          sale_rows AS (
            SELECT
              date_trunc('day', created_at) AS bucket_start,
              COALESCE(SUM(total_amount), 0) AS product_revenue
            FROM sale_transactions
            WHERE status = 'completed'
              AND created_at BETWEEN ${start} AND ${end}
            GROUP BY 1
          )
          SELECT
            COALESCE(payment_rows.bucket_start, sale_rows.bucket_start) AS bucket_start,
            COALESCE(payment_rows.membership_revenue, 0) AS membership_revenue,
            COALESCE(payment_rows.booking_revenue, 0) AS booking_revenue,
            COALESCE(sale_rows.product_revenue, 0) AS product_revenue,
            COALESCE(payment_rows.coaching_payments_collected, 0) AS coaching_payments_collected
          FROM payment_rows
          FULL OUTER JOIN sale_rows
            ON sale_rows.bucket_start = payment_rows.bucket_start
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          WITH payment_rows AS (
            SELECT
              date_trunc('week', COALESCE(verified_at, created_at)) AS bucket_start,
              COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
              COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
              COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
            FROM payments
            WHERE status = 'completed'
              AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
            GROUP BY 1
          ),
          sale_rows AS (
            SELECT
              date_trunc('week', created_at) AS bucket_start,
              COALESCE(SUM(total_amount), 0) AS product_revenue
            FROM sale_transactions
            WHERE status = 'completed'
              AND created_at BETWEEN ${start} AND ${end}
            GROUP BY 1
          )
          SELECT
            COALESCE(payment_rows.bucket_start, sale_rows.bucket_start) AS bucket_start,
            COALESCE(payment_rows.membership_revenue, 0) AS membership_revenue,
            COALESCE(payment_rows.booking_revenue, 0) AS booking_revenue,
            COALESCE(sale_rows.product_revenue, 0) AS product_revenue,
            COALESCE(payment_rows.coaching_payments_collected, 0) AS coaching_payments_collected
          FROM payment_rows
          FULL OUTER JOIN sale_rows
            ON sale_rows.bucket_start = payment_rows.bucket_start
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          WITH payment_rows AS (
            SELECT
              date_trunc('year', COALESCE(verified_at, created_at)) AS bucket_start,
              COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
              COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
              COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
            FROM payments
            WHERE status = 'completed'
              AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
            GROUP BY 1
          ),
          sale_rows AS (
            SELECT
              date_trunc('year', created_at) AS bucket_start,
              COALESCE(SUM(total_amount), 0) AS product_revenue
            FROM sale_transactions
            WHERE status = 'completed'
              AND created_at BETWEEN ${start} AND ${end}
            GROUP BY 1
          )
          SELECT
            COALESCE(payment_rows.bucket_start, sale_rows.bucket_start) AS bucket_start,
            COALESCE(payment_rows.membership_revenue, 0) AS membership_revenue,
            COALESCE(payment_rows.booking_revenue, 0) AS booking_revenue,
            COALESCE(sale_rows.product_revenue, 0) AS product_revenue,
            COALESCE(payment_rows.coaching_payments_collected, 0) AS coaching_payments_collected
          FROM payment_rows
          FULL OUTER JOIN sale_rows
            ON sale_rows.bucket_start = payment_rows.bucket_start
          ORDER BY 1
        `;
      case 'monthly':
      default:
        return this.queryRaw<PaymentRevenueSeriesRow[]>`
          WITH payment_rows AS (
            SELECT
              date_trunc('month', COALESCE(verified_at, created_at)) AS bucket_start,
              COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0) AS membership_revenue,
              COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS booking_revenue,
              COALESCE(SUM(CASE WHEN payable_type IN ('coaching', 'recurring_coaching') THEN amount ELSE 0 END), 0) AS coaching_payments_collected
            FROM payments
            WHERE status = 'completed'
              AND COALESCE(verified_at, created_at) BETWEEN ${start} AND ${end}
            GROUP BY 1
          ),
          sale_rows AS (
            SELECT
              date_trunc('month', created_at) AS bucket_start,
              COALESCE(SUM(total_amount), 0) AS product_revenue
            FROM sale_transactions
            WHERE status = 'completed'
              AND created_at BETWEEN ${start} AND ${end}
            GROUP BY 1
          )
          SELECT
            COALESCE(payment_rows.bucket_start, sale_rows.bucket_start) AS bucket_start,
            COALESCE(payment_rows.membership_revenue, 0) AS membership_revenue,
            COALESCE(payment_rows.booking_revenue, 0) AS booking_revenue,
            COALESCE(sale_rows.product_revenue, 0) AS product_revenue,
            COALESCE(payment_rows.coaching_payments_collected, 0) AS coaching_payments_collected
          FROM payment_rows
          FULL OUTER JOIN sale_rows
            ON sale_rows.bucket_start = payment_rows.bucket_start
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
      case 'hourly':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('hour', COALESCE(payments.verified_at, payments.created_at)) AS bucket_start,
            COALESCE(SUM(
              CASE
                WHEN payments.payable_type = 'coaching' THEN
                  payments.amount * (
                    COALESCE(coach_appointments.gym_revenue, 0) /
                    NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
                  )
                WHEN payments.payable_type = 'recurring_coaching' THEN
                  payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100)
                ELSE 0
              END
            ), 0) AS coaching_gym_revenue
          FROM payments
          LEFT JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          LEFT JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          LEFT JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
          WHERE payments.payable_type IN ('coaching', 'recurring_coaching')
            AND payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'daily':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('day', COALESCE(payments.verified_at, payments.created_at)) AS bucket_start,
            COALESCE(SUM(
              CASE
                WHEN payments.payable_type = 'coaching' THEN
                  payments.amount * (
                    COALESCE(coach_appointments.gym_revenue, 0) /
                    NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
                  )
                WHEN payments.payable_type = 'recurring_coaching' THEN
                  payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100)
                ELSE 0
              END
            ), 0) AS coaching_gym_revenue
          FROM payments
          LEFT JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          LEFT JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          LEFT JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
          WHERE payments.payable_type IN ('coaching', 'recurring_coaching')
            AND payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('week', COALESCE(payments.verified_at, payments.created_at)) AS bucket_start,
            COALESCE(SUM(
              CASE
                WHEN payments.payable_type = 'coaching' THEN
                  payments.amount * (
                    COALESCE(coach_appointments.gym_revenue, 0) /
                    NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
                  )
                WHEN payments.payable_type = 'recurring_coaching' THEN
                  payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100)
                ELSE 0
              END
            ), 0) AS coaching_gym_revenue
          FROM payments
          LEFT JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          LEFT JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          LEFT JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
          WHERE payments.payable_type IN ('coaching', 'recurring_coaching')
            AND payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('year', COALESCE(payments.verified_at, payments.created_at)) AS bucket_start,
            COALESCE(SUM(
              CASE
                WHEN payments.payable_type = 'coaching' THEN
                  payments.amount * (
                    COALESCE(coach_appointments.gym_revenue, 0) /
                    NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
                  )
                WHEN payments.payable_type = 'recurring_coaching' THEN
                  payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100)
                ELSE 0
              END
            ), 0) AS coaching_gym_revenue
          FROM payments
          LEFT JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          LEFT JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          LEFT JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
          WHERE payments.payable_type IN ('coaching', 'recurring_coaching')
            AND payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
          GROUP BY 1
          ORDER BY 1
        `;
      case 'monthly':
      default:
        return this.queryRaw<CoachingRevenueSeriesRow[]>`
          SELECT
            date_trunc('month', COALESCE(payments.verified_at, payments.created_at)) AS bucket_start,
            COALESCE(SUM(
              CASE
                WHEN payments.payable_type = 'coaching' THEN
                  payments.amount * (
                    COALESCE(coach_appointments.gym_revenue, 0) /
                    NULLIF(COALESCE(coach_appointments.total_amount, 0), 0)
                  )
                WHEN payments.payable_type = 'recurring_coaching' THEN
                  payments.amount * (COALESCE(coach_profiles.gym_commission_pct, 0) / 100)
                ELSE 0
              END
            ), 0) AS coaching_gym_revenue
          FROM payments
          LEFT JOIN coach_appointments
            ON payments.payable_type = 'coaching'
           AND coach_appointments.id = payments.payable_id
          LEFT JOIN recurring_coaching_billing_cycles
            ON payments.payable_type = 'recurring_coaching'
           AND recurring_coaching_billing_cycles.id = payments.payable_id
          LEFT JOIN recurring_coaching_plans
            ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
          JOIN coach_profiles
            ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
          WHERE payments.payable_type IN ('coaching', 'recurring_coaching')
            AND payments.status = 'completed'
            AND COALESCE(payments.verified_at, payments.created_at) BETWEEN ${start} AND ${end}
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
      case 'hourly':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('hour', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          JOIN users ON users.id = attendance_logs.user_id
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          WHERE check_in_at BETWEEN ${start} AND ${end}
            AND users.role = 'member'
            AND users."deletedAt" IS NULL
            AND pending_requests.id IS NULL
          GROUP BY 1
          ORDER BY 1
        `;
      case 'daily':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('day', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          JOIN users ON users.id = attendance_logs.user_id
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          WHERE check_in_at BETWEEN ${start} AND ${end}
            AND users.role = 'member'
            AND users."deletedAt" IS NULL
            AND pending_requests.id IS NULL
          GROUP BY 1
          ORDER BY 1
        `;
      case 'weekly':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('week', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          JOIN users ON users.id = attendance_logs.user_id
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          WHERE check_in_at BETWEEN ${start} AND ${end}
            AND users.role = 'member'
            AND users."deletedAt" IS NULL
            AND pending_requests.id IS NULL
          GROUP BY 1
          ORDER BY 1
        `;
      case 'yearly':
        return this.queryRaw<AttendanceTrendRow[]>`
          SELECT
            date_trunc('year', check_in_at) AS bucket_start,
            COUNT(*) AS check_ins
          FROM attendance_logs
          JOIN users ON users.id = attendance_logs.user_id
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          WHERE check_in_at BETWEEN ${start} AND ${end}
            AND users.role = 'member'
            AND users."deletedAt" IS NULL
            AND pending_requests.id IS NULL
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
          JOIN users ON users.id = attendance_logs.user_id
          LEFT JOIN account_deletion_requests pending_requests
            ON pending_requests.user_id = users.id
           AND pending_requests.status = 'pending'
          WHERE check_in_at BETWEEN ${start} AND ${end}
            AND users.role = 'member'
            AND users."deletedAt" IS NULL
            AND pending_requests.id IS NULL
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
