import { Injectable } from '@nestjs/common';
import { InsightFocus, InsightPeriod } from '@prisma/client';

import type { BusinessAnalyticsInsightResponse } from '../ai/ai-python-client.service';
import {
  buildAnalyticsPdfBuffer,
  type AnalyticsPdfInsightBlock,
} from './analytics-pdf.builder';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import {
  ANALYTICS_PDF_SECTIONS,
  type AnalyticsPeriod,
  type AnalyticsQueryDTO,
  ExportAnalyticsPdfDTO,
} from './dto/analytics.dto';
import type { GenerateBusinessInsightDTO } from './dto/business-analytics-insight.dto';

@Injectable()
export class AnalyticsPdfExportService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly businessAnalyticsInsightService: BusinessAnalyticsInsightService,
  ) {}

  async exportPdf(dto: ExportAnalyticsPdfDTO) {
    const generatedAt = new Date();
    const selectedSections =
      dto.selected_sections && dto.selected_sections.length > 0
        ? dto.selected_sections
        : [...ANALYTICS_PDF_SECTIONS];
    const revenueQuery = this.toQueryWindow({
      end_date: dto.revenue_end_date,
      period: dto.revenue_period,
      start_date: dto.revenue_start_date,
    });
    const attendanceQuery = this.toQueryWindow({
      end_date: dto.attendance_end_date,
      period: dto.attendance_period,
      start_date: dto.attendance_start_date,
    });

    const [snapshot, revenue, attendance, dailyInsightsTrend, inventory] =
      await Promise.all([
        this.analyticsService.getSnapshot(),
        this.analyticsService.getRevenue(revenueQuery),
        this.analyticsService.getAttendance(attendanceQuery),
        this.analyticsService.getDailyInsightsTrend(attendanceQuery),
        this.analyticsService.getInventorySummary(revenueQuery),
      ]);

    const [
      overviewInsight,
      revenueInsight,
      attendanceInsight,
      inventoryInsight,
    ] = await Promise.all([
      this.generateInsight({
        ...revenueQuery,
        focus: InsightFocus.overview,
        period: this.toInsightPeriod(revenueQuery.period),
      }),
      this.generateInsight({
        ...revenueQuery,
        focus: InsightFocus.revenue,
        period: this.toInsightPeriod(revenueQuery.period),
      }),
      this.generateInsight({
        ...attendanceQuery,
        focus: InsightFocus.attendance,
        period: this.toInsightPeriod(attendanceQuery.period),
      }),
      this.generateInsight({
        ...revenueQuery,
        focus: InsightFocus.inventory,
        period: this.toInsightPeriod(revenueQuery.period),
      }),
    ]);

    const insights = {
      attendance: this.buildAttendanceInsight(attendance, attendanceInsight),
      dailyInsights: this.buildDailyInsightsInsight(
        snapshot,
        dailyInsightsTrend,
        overviewInsight,
      ),
      inventory: this.buildInventoryInsight(
        inventory,
        revenue,
        inventoryInsight,
      ),
      performanceKpis: this.buildPerformanceInsight(
        snapshot,
        revenue,
        overviewInsight,
      ),
      recentActivities: this.buildRecentActivitiesInsight(
        snapshot,
        overviewInsight,
      ),
      recommendations: this.buildRecommendationsInsight({
        attendance,
        attendanceInsight,
        inventoryInsight,
        overviewInsight,
        revenue,
        revenueInsight,
        snapshot,
      }),
      revenue: this.buildRevenueInsight(revenue, revenueInsight),
      systemAlerts: this.buildSystemAlertsInsight(snapshot, inventoryInsight),
    };

    const buffer = buildAnalyticsPdfBuffer({
      attendance,
      attendanceLabel: this.describeAttendanceWindow(attendanceQuery),
      dailyInsightsTrend,
      generatedAt: generatedAt.toISOString(),
      insights,
      inventory,
      revenue,
      sections: selectedSections,
      snapshot,
    });

    return {
      buffer,
      fileName: `fittrack-analytics-${generatedAt.toISOString().slice(0, 10)}.pdf`,
    };
  }

  private async generateInsight(
    dto: GenerateBusinessInsightDTO,
  ): Promise<BusinessAnalyticsInsightResponse | null> {
    try {
      return await this.businessAnalyticsInsightService.generateTransientInsight(
        dto,
      );
    } catch {
      return null;
    }
  }

  private buildDailyInsightsInsight(
    snapshot: Awaited<ReturnType<AnalyticsService['getSnapshot']>>,
    trend: Awaited<ReturnType<AnalyticsService['getDailyInsightsTrend']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const peakPoint =
      [...trend.series].sort(
        (left, right) => right.sessions - left.sessions,
      )[0] ?? null;
    const quietPoint =
      [...trend.series].sort(
        (left, right) => left.sessions - right.sessions,
      )[0] ?? null;
    const averageActiveMembers =
      trend.series.length > 0
        ? trend.series.reduce(
            (total, point) => total + point.active_members,
            0,
          ) / trend.series.length
        : snapshot.daily_insights.active_members;

    const local: AnalyticsPdfInsightBlock = {
      summary: peakPoint
        ? `Active member access averaged ${averageActiveMembers.toFixed(1)} across the selected ${trend.period} window, while session activity peaked at ${peakPoint.sessions} on ${this.toLabel(peakPoint.bucket_start, trend.period)}.`
        : `Daily activity is currently anchored by ${snapshot.daily_insights.active_members} active members and ${snapshot.daily_insights.sessions_today} sessions today.`,
      highlights: [
        `${snapshot.daily_insights.sessions_today} sessions were recorded today with ${snapshot.daily_insights.recent_activities} recent activities currently in the live feed.`,
        peakPoint
          ? `The busiest bucket landed on ${this.toLabel(peakPoint.bucket_start, trend.period)} with ${peakPoint.sessions} sessions.`
          : 'No peak session bucket was available for the selected window.',
        quietPoint
          ? `The quietest bucket was ${this.toLabel(quietPoint.bucket_start, trend.period)} with ${quietPoint.sessions} sessions.`
          : 'There is no low-traffic bucket identified for this window yet.',
      ],
      recommendedActions: [
        peakPoint
          ? `Schedule stronger floor coverage and retail prompts around ${this.toLabel(peakPoint.bucket_start, trend.period)}.`
          : 'Keep monitoring the session curve before shifting staffing coverage.',
        quietPoint &&
        quietPoint.sessions < (peakPoint?.sessions ?? quietPoint.sessions)
          ? `Run reactivation or class-fill campaigns ahead of ${this.toLabel(quietPoint.bucket_start, trend.period)} to lift softer traffic.`
          : 'Keep the current member activation cadence while monitoring demand swings.',
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildPerformanceInsight(
    snapshot: Awaited<ReturnType<AnalyticsService['getSnapshot']>>,
    revenue: Awaited<ReturnType<AnalyticsService['getRevenue']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const local: AnalyticsPdfInsightBlock = {
      summary: `All-time KPIs show ${this.formatMoney(snapshot.performance_kpis.total_revenue)} in revenue, ${snapshot.performance_kpis.total_venue_bookings} venue bookings, and ${snapshot.performance_kpis.total_coaching_appointments} coaching appointments across recorded FitTrack activity.`,
      highlights: [
        `${snapshot.performance_kpis.check_ins} check-ins generated the operating traffic behind ${snapshot.performance_kpis.coaching_sessions} completed coaching sessions.`,
        `${snapshot.performance_kpis.new_members} members have been added across the tracked platform history.`,
        `Revenue is currently led by ${revenue.top_revenue_sources[0]?.source_label ?? 'the strongest active source'} within the live mix.`,
      ],
      recommendedActions: [
        snapshot.performance_kpis.new_members > 0
          ? `Convert the ${snapshot.performance_kpis.new_members} new members quickly into coaching and venue usage before their first-week momentum fades.`
          : 'Push a short-term acquisition offer so KPI growth is not fully dependent on existing members.',
        snapshot.performance_kpis.total_coaching_appointments <
        snapshot.performance_kpis.total_venue_bookings
          ? 'Promote coaching at booking touchpoints so service revenue rises with venue demand.'
          : 'Protect coaching capacity because service demand is already matching or beating venue demand.',
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildInventoryInsight(
    inventory: Awaited<ReturnType<AnalyticsService['getInventorySummary']>>,
    revenue: Awaited<ReturnType<AnalyticsService['getRevenue']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const topProduct = inventory.top_products[0] ?? null;

    const local: AnalyticsPdfInsightBlock = {
      summary: `Inventory currently tracks ${inventory.retail_items} retail items worth ${this.formatMoney(inventory.retail_inventory_value)}, with ${inventory.low_stock_items} low-stock item(s), ${inventory.out_of_stock_items} out-of-stock item(s), and ${inventory.equipment_under_maintenance} equipment type(s) under maintenance.`,
      highlights: [
        `Retail sales contributed ${this.formatMoney(revenue.totals.product_revenue)} in the selected revenue window.`,
        topProduct
          ? `${topProduct.name} leads retail sell-through at ${topProduct.quantity_sold} units and ${this.formatMoney(topProduct.revenue)} in revenue.`
          : 'No retail sales were recorded for the selected export window.',
        `${inventory.equipment_units_available} of ${inventory.equipment_units_total} equipment units are currently available on the floor.`,
      ],
      recommendedActions: [
        inventory.low_stock_items > 0
          ? `Restock the ${inventory.low_stock_items} low-stock retail item(s) before peak traffic loses add-on sales.`
          : 'Keep the current retail reorder cadence because no low-stock retail items are active right now.',
        inventory.equipment_under_maintenance > 0
          ? `Resolve ${inventory.equipment_under_maintenance} maintenance queue item(s) so equipment availability stays ahead of attendance demand.`
          : 'Equipment availability is stable, so the next inventory focus can stay on retail conversion.',
        topProduct
          ? `Feature ${topProduct.name} in front-desk prompts and bundles while it remains the strongest retail seller.`
          : 'Review retail assortment and merchandising because the selected window produced no meaningful top seller.',
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildRevenueInsight(
    revenue: Awaited<ReturnType<AnalyticsService['getRevenue']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const strongestSource = revenue.top_revenue_sources[0] ?? null;
    const series = revenue.series.filter(
      (entry) => Number(entry.total_revenue) > 0,
    );
    const firstPoint = series[0] ?? revenue.series[0] ?? null;
    const lastPoint =
      series[series.length - 1] ??
      revenue.series[revenue.series.length - 1] ??
      null;
    const trendDirection =
      firstPoint && lastPoint
        ? Number(lastPoint.total_revenue) - Number(firstPoint.total_revenue)
        : 0;

    const local: AnalyticsPdfInsightBlock = {
      summary: strongestSource
        ? `Total generated revenue reached ${this.formatMoney(revenue.totals.total_revenue)}, led by ${strongestSource.source_label} at ${strongestSource.share_percentage.toFixed(1)}% of the current mix.`
        : `Total generated revenue reached ${this.formatMoney(revenue.totals.total_revenue)} in the selected window.`,
      highlights: [
        strongestSource
          ? `${strongestSource.source_label} produced ${this.formatMoney(strongestSource.revenue)} and remains the lead revenue source.`
          : 'No dominant revenue source was available for the current export window.',
        firstPoint && lastPoint
          ? `Revenue moved from ${this.formatMoney(firstPoint.total_revenue)} to ${this.formatMoney(lastPoint.total_revenue)} across the visible trend line.`
          : 'Revenue trend points were too sparse to compare the start and end of the window.',
        `Coaching collections currently contribute ${this.formatMoney(revenue.totals.coaching_payments_collected)} while retail contributes ${this.formatMoney(revenue.totals.product_revenue)}.`,
      ],
      recommendedActions: [
        strongestSource && strongestSource.share_percentage >= 45
          ? `Reduce dependence on ${strongestSource.source_label} by growing the weaker revenue lanes next.`
          : 'Keep the revenue mix diversified and protect the strongest performing lane with repeatable offers.',
        trendDirection < 0
          ? 'Investigate the recent revenue softening and launch a short-cycle offer before the next reporting window closes.'
          : 'Use the current revenue trend to press upsells while demand is holding or improving.',
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildAttendanceInsight(
    attendance: Awaited<ReturnType<AnalyticsService['getAttendance']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const peakPoint =
      [...attendance.series].sort(
        (left, right) => right.check_ins - left.check_ins,
      )[0] ?? null;
    const quietPoint =
      [...attendance.series].sort(
        (left, right) => left.check_ins - right.check_ins,
      )[0] ?? null;

    const local: AnalyticsPdfInsightBlock = {
      summary: peakPoint
        ? `Attendance delivered ${attendance.total_check_ins} check-ins in the selected window, with the strongest bucket hitting ${peakPoint.check_ins} on ${this.toLabel(peakPoint.bucket_start, attendance.period)}.`
        : `Attendance delivered ${attendance.total_check_ins} check-ins in the selected window.`,
      highlights: [
        attendance.peak_hours[0]
          ? `The peak attendance hour is ${attendance.peak_hours[0].hour_label} with ${attendance.peak_hours[0].check_ins} check-ins.`
          : 'No peak-hour lane was available for the selected attendance filter.',
        quietPoint
          ? `The lowest bucket was ${this.toLabel(quietPoint.bucket_start, attendance.period)} at ${quietPoint.check_ins} check-ins.`
          : 'A quiet bucket could not be identified for this window.',
        `${attendance.series.length} attendance buckets were rendered into the chart for this export.`,
      ],
      recommendedActions: [
        attendance.peak_hours[0]
          ? `Align staffing and queue handling around ${attendance.peak_hours[0].hour_label}, where demand is most concentrated.`
          : 'Keep monitoring the attendance distribution before shifting staff coverage.',
        quietPoint && peakPoint && quietPoint.check_ins < peakPoint.check_ins
          ? `Test off-peak promos around ${this.toLabel(quietPoint.bucket_start, attendance.period)} to flatten the demand curve.`
          : 'Protect the current attendance cadence with stable scheduling and member reminders.',
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildSystemAlertsInsight(
    snapshot: Awaited<ReturnType<AnalyticsService['getSnapshot']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const lowStockCount = snapshot.system_alerts.filter(
      (alert) => alert.kind === 'low_stock',
    ).length;
    const maintenanceCount = snapshot.system_alerts.filter(
      (alert) => alert.kind === 'maintenance_due',
    ).length;

    const local: AnalyticsPdfInsightBlock = {
      summary:
        snapshot.system_alerts.length > 0
          ? `${snapshot.system_alerts.length} live system alerts require attention, with ${lowStockCount} stock-related warnings and ${maintenanceCount} maintenance items currently in the lane.`
          : 'There are no active stock or maintenance warnings in the current analytics snapshot.',
      highlights: snapshot.system_alerts.slice(0, 3).map((alert) => alert.body),
      recommendedActions:
        snapshot.system_alerts.length > 0
          ? snapshot.system_alerts
              .slice(0, 3)
              .map(
                (alert) =>
                  `${alert.action_label}: resolve the ${alert.title.toLowerCase()} item linked to ${alert.id}.`,
              )
          : [
              'Keep the current restock and maintenance cadence so new alerts stay suppressed.',
            ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildRecentActivitiesInsight(
    snapshot: Awaited<ReturnType<AnalyticsService['getSnapshot']>>,
    insight: BusinessAnalyticsInsightResponse | null,
  ): AnalyticsPdfInsightBlock {
    const byKind = snapshot.recent_activities.reduce<Record<string, number>>(
      (accumulator, activity) => {
        accumulator[activity.kind] = (accumulator[activity.kind] ?? 0) + 1;
        return accumulator;
      },
      {},
    );
    const cancelledCount = snapshot.recent_activities.filter((activity) =>
      activity.status.toLowerCase().includes('cancel'),
    ).length;
    const latest = snapshot.recent_activities[0] ?? null;
    const dominantKind =
      Object.entries(byKind).sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0] ?? 'mixed';

    const local: AnalyticsPdfInsightBlock = {
      summary: latest
        ? `Recent activity is currently dominated by ${dominantKind.replace(/_/g, ' ')} events, with the newest record showing ${latest.actor_name} at ${this.formatDateTime(latest.occurred_at)}.`
        : 'Recent activity is quiet right now, with no live events in the current snapshot.',
      highlights: [
        `${snapshot.recent_activities.length} recent records were pulled into the export timeline.`,
        cancelledCount > 0
          ? `${cancelledCount} recent activities ended in a cancelled state and may need operational follow-up.`
          : 'Recent activity is currently landing without visible cancellation pressure.',
        latest
          ? latest.description
          : 'No latest activity description was available.',
      ],
      recommendedActions: [
        cancelledCount > 0
          ? 'Review recent cancellations to see whether schedule fit, staffing, or venue friction is causing the drop-off.'
          : 'Keep using the live activity feed to spot demand shifts before they become KPI changes.',
        dominantKind === 'attendance'
          ? 'Use the attendance-heavy activity mix to promote add-on services while members are already on site.'
          : `Monitor the ${dominantKind.replace(/_/g, ' ')} lane for repeat patterns worth operational standardization.`,
      ],
    };

    return this.mergeInsightBlock(insight, local);
  }

  private buildRecommendationsInsight(args: {
    attendance: Awaited<ReturnType<AnalyticsService['getAttendance']>>;
    attendanceInsight: BusinessAnalyticsInsightResponse | null;
    inventoryInsight: BusinessAnalyticsInsightResponse | null;
    overviewInsight: BusinessAnalyticsInsightResponse | null;
    revenue: Awaited<ReturnType<AnalyticsService['getRevenue']>>;
    revenueInsight: BusinessAnalyticsInsightResponse | null;
    snapshot: Awaited<ReturnType<AnalyticsService['getSnapshot']>>;
  }): AnalyticsPdfInsightBlock {
    const topRevenueSource = args.revenue.top_revenue_sources[0] ?? null;
    const lowStockCount = args.snapshot.system_alerts.filter(
      (alert) => alert.kind === 'low_stock',
    ).length;
    const maintenanceCount = args.snapshot.system_alerts.filter(
      (alert) => alert.kind === 'maintenance_due',
    ).length;
    const peakAttendance = args.attendance.peak_hours[0] ?? null;

    const local: AnalyticsPdfInsightBlock = {
      summary: `The current analytics window shows ${this.formatMoney(args.revenue.totals.total_revenue)} in revenue, ${args.attendance.total_check_ins} check-ins, and ${args.snapshot.system_alerts.length} active operational alerts, so the best next gains come from protecting the strongest revenue lane while reducing avoidable operational drag.`,
      highlights: [
        topRevenueSource
          ? `${topRevenueSource.source_label} is the current lead revenue source at ${topRevenueSource.share_percentage.toFixed(1)}% of the mix.`
          : 'No single revenue source dominated the current export window.',
        peakAttendance
          ? `Attendance pressure concentrates around ${peakAttendance.hour_label}, which is the clearest staffing and sales conversion opportunity.`
          : 'Attendance did not expose a single dominant peak lane.',
        lowStockCount + maintenanceCount > 0
          ? `${lowStockCount} stock alerts and ${maintenanceCount} maintenance alerts are live and can suppress conversion if left unresolved.`
          : 'Operational alerts are currently low, which creates room to focus on growth actions.',
      ],
      recommendedActions: this.mergeUniqueStrings([
        topRevenueSource && topRevenueSource.share_percentage >= 45
          ? `Grow the weaker revenue lanes so the business is less dependent on ${topRevenueSource.source_label}.`
          : 'Maintain a balanced offer mix across memberships, bookings, coaching, and retail.',
        peakAttendance
          ? `Shift staffing, retail prompts, and coaching availability toward ${peakAttendance.hour_label} so peak demand is monetized cleanly.`
          : 'Keep monitoring the attendance curve and re-evaluate staffing once a new peak pattern appears.',
        lowStockCount > 0
          ? 'Clear the low-stock queue first so top-selling retail items remain available during peak traffic.'
          : null,
        maintenanceCount > 0
          ? 'Resolve maintenance items before capacity loss starts affecting bookings or member experience.'
          : null,
        args.snapshot.performance_kpis.total_coaching_appointments <
        args.snapshot.performance_kpis.total_venue_bookings
          ? 'Use bookings as an upsell channel for coaching so service revenue grows with venue traffic.'
          : 'Protect coaching capacity because service demand is already strong enough to support expansion.',
      ]),
    };

    return {
      summary: local.summary,
      highlights: local.highlights.slice(0, 4),
      recommendedActions: local.recommendedActions.slice(0, 5),
    };
  }

  private mergeInsightBlock(
    insight: BusinessAnalyticsInsightResponse | null,
    local: AnalyticsPdfInsightBlock,
  ): AnalyticsPdfInsightBlock {
    void insight;
    return {
      summary: local.summary,
      highlights: local.highlights.slice(0, 3),
      recommendedActions: local.recommendedActions.slice(0, 3),
    };
  }

  private isPrimaryInsight(insight: BusinessAnalyticsInsightResponse | null) {
    return Boolean(
      insight &&
      insight.model_used !== 'grounded-fallback' &&
      !insight.summary.startsWith('Fallback insight:'),
    );
  }

  private mergeUniqueStrings(values: Array<string | null | undefined>) {
    return values.filter(
      (value, index, items): value is string =>
        Boolean(value?.trim()) && items.indexOf(value) === index,
    );
  }

  private toQueryWindow(args: {
    end_date?: string;
    period?: AnalyticsPeriod;
    start_date?: string;
  }): AnalyticsQueryDTO {
    return {
      ...(args.start_date ? { start_date: args.start_date } : {}),
      ...(args.end_date ? { end_date: args.end_date } : {}),
      period: args.period ?? 'monthly',
    };
  }

  private toInsightPeriod(period: AnalyticsPeriod | undefined) {
    return (period ?? 'monthly') as InsightPeriod;
  }

  private describeAttendanceWindow(window: AnalyticsQueryDTO) {
    const periodLabel = this.capitalize(window.period ?? 'monthly');
    if (window.start_date && window.end_date) {
      return `${periodLabel} view (${window.start_date} to ${window.end_date})`;
    }

    return `${periodLabel} view`;
  }

  private capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private toLabel(bucketStart: string, period: AnalyticsPeriod) {
    const date = new Date(bucketStart);
    switch (period) {
      case 'hourly':
        return date.toLocaleTimeString('en-PH', {
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'daily':
        return date.toLocaleDateString('en-PH', {
          day: 'numeric',
          month: 'short',
        });
      case 'weekly':
        return `week of ${date.toLocaleDateString('en-PH', {
          day: 'numeric',
          month: 'short',
        })}`;
      case 'yearly':
        return date.toLocaleDateString('en-PH', {
          year: 'numeric',
        });
      case 'monthly':
      default:
        return date.toLocaleDateString('en-PH', {
          month: 'short',
          year: 'numeric',
        });
    }
  }

  private formatMoney(value: string) {
    const amount = Number(value);
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-PH', {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
