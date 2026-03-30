from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BusinessAnalyticsWindow(StrictModel):
    start_date: date
    end_date: date
    period: Literal["daily", "weekly", "monthly", "yearly", "custom"]
    focus: Literal[
        "overview",
        "revenue",
        "attendance",
        "membership",
        "coaching",
        "inventory",
    ]


class BusinessAnalyticsOverview(StrictModel):
    total_revenue: str = Field(min_length=1)
    total_check_ins: int = Field(ge=0)
    new_members: int = Field(ge=0)
    completed_coaching_sessions: int = Field(ge=0)


class BusinessAnalyticsRevenueTotals(StrictModel):
    membership_revenue: str = Field(min_length=1)
    booking_revenue: str = Field(min_length=1)
    product_revenue: str = Field(min_length=1)
    coaching_payments_collected: str = Field(min_length=1)
    coaching_gym_revenue: str = Field(min_length=1)
    total_revenue: str = Field(min_length=1)


class BusinessAnalyticsRevenueSeriesPoint(BusinessAnalyticsRevenueTotals):
    bucket_start: str = Field(min_length=1)


class BusinessAnalyticsRevenue(StrictModel):
    totals: BusinessAnalyticsRevenueTotals
    series: list[BusinessAnalyticsRevenueSeriesPoint]


class BusinessAnalyticsAttendanceSeriesPoint(StrictModel):
    bucket_start: str = Field(min_length=1)
    check_ins: int = Field(ge=0)


class BusinessAnalyticsPeakHour(StrictModel):
    hour_label: str = Field(min_length=1)
    check_ins: int = Field(ge=0)


class BusinessAnalyticsAttendance(StrictModel):
    series: list[BusinessAnalyticsAttendanceSeriesPoint]
    peak_hours: list[BusinessAnalyticsPeakHour]


class BusinessAnalyticsTopPlan(StrictModel):
    name: str = Field(min_length=1)
    subscriber_count: int = Field(ge=0)
    revenue: str = Field(min_length=1)


class BusinessAnalyticsMembership(StrictModel):
    new_members: int = Field(ge=0)
    active_members: int = Field(ge=0)
    top_plans: list[BusinessAnalyticsTopPlan]


class BusinessAnalyticsCoach(StrictModel):
    coach_id: str = Field(min_length=1)
    first_name: str | None = None
    last_name: str | None = None
    total_billed: str = Field(min_length=1)
    gym_cut: str = Field(min_length=1)
    coach_payout: str = Field(min_length=1)
    completed_sessions: int = Field(ge=0)


class BusinessAnalyticsCoaching(StrictModel):
    coaches: list[BusinessAnalyticsCoach]


class BusinessAnalyticsTopProduct(StrictModel):
    name: str = Field(min_length=1)
    quantity_sold: int = Field(ge=0)
    revenue: str = Field(min_length=1)


class BusinessAnalyticsInventory(StrictModel):
    top_products: list[BusinessAnalyticsTopProduct]


class BusinessAnalyticsGroundingPayload(StrictModel):
    window: BusinessAnalyticsWindow
    overview: BusinessAnalyticsOverview
    revenue: BusinessAnalyticsRevenue
    attendance: BusinessAnalyticsAttendance
    membership: BusinessAnalyticsMembership
    coaching: BusinessAnalyticsCoaching
    inventory: BusinessAnalyticsInventory | None = None


class BusinessAnalyticsInsightRequest(StrictModel):
    grounding: BusinessAnalyticsGroundingPayload


class GeneratedBusinessInsight(StrictModel):
    summary: str = Field(min_length=1)
    highlights: list[str]
    risks: list[str]
    opportunities: list[str]
    anomaly_flags: list[str]
    recommended_actions: list[str]


class BusinessAnalyticsInsightResponse(GeneratedBusinessInsight):
    model_used: str | None = None
    token_count: int | None = Field(default=None, ge=0)
