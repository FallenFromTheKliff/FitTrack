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
  previousEnd: Date;
  previousStart: Date;
  start: Date;
};

export type BusinessInsightDirection =
  | 'decrease'
  | 'flat'
  | 'increase'
  | 'new_from_zero';

export type BusinessInsightComparison<T extends number | string> = {
  absolute_change: T;
  current: T;
  direction: BusinessInsightDirection;
  percentage_change: number | null;
  previous: T;
};

export type BusinessAnalyticsGroundingPayload = {
  window: {
    end_date: string;
    focus: InsightFocus;
    period: InsightPeriod;
    previous_end_date: string;
    previous_start_date: string;
    start_date: string;
  };
  comparisons: {
    check_ins: BusinessInsightComparison<number>;
    completed_coaching_sessions: BusinessInsightComparison<number>;
    new_members: BusinessInsightComparison<number>;
    total_revenue: BusinessInsightComparison<string>;
  };
  derived_signals: {
    equipment_availability_percentage: number | null;
    low_stock_exposure_percentage: number | null;
    out_of_stock_exposure_percentage: number | null;
    peak_hour_attendance_concentration: {
      check_ins: number;
      hour_label: string;
      percentage: number;
    } | null;
    revenue_mix_percentages: {
      bookings: number;
      coaching: number;
      memberships: number;
      products: number;
    };
    top_revenue_source_concentration: {
      percentage: number;
      source_key: 'bookings' | 'coaching' | 'memberships' | 'products';
      source_label: string;
    } | null;
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
      cash_membership_revenue?: string | null;
      bucket_start: string;
      coaching_gym_revenue: string;
      coaching_payments_collected: string;
      gym_membership_revenue?: string | null;
      membership_revenue: string;
      membership_card_revenue?: string | null;
      paymongo_membership_revenue?: string | null;
      product_revenue: string;
      total_revenue: string;
    }>;
    totals: {
      booking_revenue: string;
      cash_membership_revenue?: string | null;
      coaching_gym_revenue: string;
      coaching_payments_collected: string;
      gym_membership_revenue?: string | null;
      membership_revenue: string;
      membership_card_revenue?: string | null;
      paymongo_membership_revenue?: string | null;
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
    equipment_types: number;
    equipment_under_maintenance: number;
    equipment_units_available: number;
    equipment_units_total: number;
    low_stock_items: number;
    out_of_stock_items: number;
    retail_inventory_value: string;
    retail_items: number;
    retail_sales_revenue: string;
    top_products: Array<{
      name: string;
      quantity_sold: number;
      revenue: string;
    }>;
  };
};
