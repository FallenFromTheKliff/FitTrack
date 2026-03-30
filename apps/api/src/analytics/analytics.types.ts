import { InsightFocus, InsightPeriod } from '@prisma/client';

export type BuildBusinessInsightGroundingInput = {
  end_date?: string;
  focus?: InsightFocus;
  period?: InsightPeriod;
  start_date?: string;
};

export type ResolvedBusinessInsightWindow = {
  end: Date;
  focus: InsightFocus;
  period: InsightPeriod;
  start: Date;
};

export type BusinessAnalyticsGroundingPayload = {
  window: {
    end_date: string;
    focus: InsightFocus;
    period: InsightPeriod;
    start_date: string;
  };
  overview: {
    completed_coaching_sessions: number;
    new_members: number;
    total_check_ins: number;
    total_revenue: string;
  };
  revenue: {
    series: Array<{
      booking_revenue: string;
      bucket_start: string;
      coaching_gym_revenue: string;
      coaching_payments_collected: string;
      membership_revenue: string;
      product_revenue: string;
      total_revenue: string;
    }>;
    totals: {
      booking_revenue: string;
      coaching_gym_revenue: string;
      coaching_payments_collected: string;
      membership_revenue: string;
      product_revenue: string;
      total_revenue: string;
    };
  };
  attendance: {
    peak_hours: Array<{
      check_ins: number;
      hour_label: string;
    }>;
    series: Array<{
      bucket_start: string;
      check_ins: number;
    }>;
  };
  membership: {
    active_members: number;
    new_members: number;
    top_plans: Array<{
      name: string;
      revenue: string;
      subscriber_count: number;
    }>;
  };
  coaching: {
    coaches: Array<{
      coach_id: string;
      completed_sessions: number;
      coach_payout: string;
      first_name: string | null;
      gym_cut: string;
      last_name: string | null;
      total_billed: string;
    }>;
  };
  inventory?: {
    top_products: Array<{
      name: string;
      quantity_sold: number;
      revenue: string;
    }>;
  };
};
