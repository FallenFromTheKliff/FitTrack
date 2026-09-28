from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    StringConstraints,
    model_validator,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BusinessAnalyticsWindow(StrictModel):
    start_date: date
    end_date: date
    previous_start_date: date
    previous_end_date: date
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


ComparisonDirection = Literal["decrease", "flat", "increase", "new_from_zero"]


class BusinessAnalyticsCountComparison(StrictModel):
    current: int = Field(ge=0)
    previous: int = Field(ge=0)
    absolute_change: int
    percentage_change: float | None = None
    direction: ComparisonDirection


class BusinessAnalyticsMoneyComparison(StrictModel):
    current: str = Field(min_length=1)
    previous: str = Field(min_length=1)
    absolute_change: str = Field(min_length=1)
    percentage_change: float | None = None
    direction: ComparisonDirection


class BusinessAnalyticsComparisons(StrictModel):
    total_revenue: BusinessAnalyticsMoneyComparison
    check_ins: BusinessAnalyticsCountComparison
    new_members: BusinessAnalyticsCountComparison
    completed_coaching_sessions: BusinessAnalyticsCountComparison


class BusinessAnalyticsRevenueMix(StrictModel):
    memberships: float = Field(ge=0, le=100)
    bookings: float = Field(ge=0, le=100)
    products: float = Field(ge=0, le=100)
    coaching: float = Field(ge=0, le=100)


class BusinessAnalyticsRevenueConcentration(StrictModel):
    source_key: Literal["memberships", "bookings", "products", "coaching"]
    source_label: str = Field(min_length=1, max_length=80)
    percentage: float = Field(ge=0, le=100)


class BusinessAnalyticsPeakHourConcentration(StrictModel):
    hour_label: str = Field(min_length=1, max_length=20)
    check_ins: int = Field(ge=0)
    percentage: float = Field(ge=0, le=100)


class BusinessAnalyticsDerivedSignals(StrictModel):
    revenue_mix_percentages: BusinessAnalyticsRevenueMix
    top_revenue_source_concentration: BusinessAnalyticsRevenueConcentration | None
    peak_hour_attendance_concentration: BusinessAnalyticsPeakHourConcentration | None
    equipment_availability_percentage: float | None = Field(default=None, ge=0, le=100)
    low_stock_exposure_percentage: float | None = Field(default=None, ge=0, le=100)
    out_of_stock_exposure_percentage: float | None = Field(default=None, ge=0, le=100)


class BusinessAnalyticsRevenueTotals(StrictModel):
    cash_membership_revenue: str | None = Field(default=None, min_length=1)
    gym_membership_revenue: str | None = Field(default=None, min_length=1)
    membership_revenue: str = Field(min_length=1)
    membership_card_revenue: str | None = Field(default=None, min_length=1)
    paymongo_membership_revenue: str | None = Field(default=None, min_length=1)
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
    retail_items: int = Field(ge=0)
    low_stock_items: int = Field(ge=0)
    out_of_stock_items: int = Field(ge=0)
    retail_inventory_value: str = Field(min_length=1)
    retail_sales_revenue: str = Field(min_length=1)
    equipment_types: int = Field(ge=0)
    equipment_units_available: int = Field(ge=0)
    equipment_units_total: int = Field(ge=0)
    equipment_under_maintenance: int = Field(ge=0)
    top_products: list[BusinessAnalyticsTopProduct]


class BusinessAnalyticsGroundingPayload(StrictModel):
    window: BusinessAnalyticsWindow
    comparisons: BusinessAnalyticsComparisons
    derived_signals: BusinessAnalyticsDerivedSignals
    overview: BusinessAnalyticsOverview
    revenue: BusinessAnalyticsRevenue
    attendance: BusinessAnalyticsAttendance
    membership: BusinessAnalyticsMembership
    coaching: BusinessAnalyticsCoaching
    inventory: BusinessAnalyticsInventory | None = None


BusinessAnalyticsSectionName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=80),
]


class BusinessAnalyticsInsightAnalysis(StrictModel):
    """Optional bounded analysis controls sent alongside legacy grounding."""

    analysis_depth: Literal["brief", "detailed", "deep"] = "brief"
    selected_sections: list[BusinessAnalyticsSectionName] = Field(
        default_factory=list,
        max_length=32,
    )
    section_contexts: dict[BusinessAnalyticsSectionName, JsonValue] = Field(
        default_factory=dict,
        max_length=32,
    )
    data_fingerprint: str | None = Field(default=None, max_length=256)


class BusinessAnalyticsInsightRequest(StrictModel):
    grounding: BusinessAnalyticsGroundingPayload
    analysis: BusinessAnalyticsInsightAnalysis | None = None


InsightSummaryText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=1200),
]
InsightEvidenceText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=600),
]
InsightCompactText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=400),
]


class GeneratedBusinessInsight(StrictModel):
    summary: InsightSummaryText
    highlights: list[InsightEvidenceText] = Field(max_length=5)
    risks: list[InsightEvidenceText] = Field(max_length=5)
    opportunities: list[InsightEvidenceText] = Field(max_length=5)
    anomaly_flags: list[InsightCompactText] = Field(max_length=8)
    recommended_actions: list[InsightCompactText] = Field(max_length=3)


class BusinessAnalyticsInsightResponse(GeneratedBusinessInsight):
    model_used: str | None = None
    token_count: int | None = Field(default=None, ge=0)
    section_analyses: dict[BusinessAnalyticsSectionName, GeneratedBusinessInsight] | None = Field(
        default=None,
        max_length=32,
        exclude_if=lambda value: value is None,
    )
    failed_sections: list[BusinessAnalyticsSectionName] = Field(
        default_factory=list,
        max_length=32,
        exclude_if=lambda value: not value,
    )


BusinessInsightOutcomeVerdict = Literal[
    "effective",
    "partially_effective",
    "not_effective",
    "insufficient_data",
]


class BusinessInsightPreviousSnapshot(StrictModel):
    summary: InsightSummaryText
    recommended_actions: list[InsightCompactText] = Field(max_length=3)
    selected_sections: list[BusinessAnalyticsSectionName] = Field(
        min_length=1,
        max_length=32,
    )
    grounding: BusinessAnalyticsGroundingPayload


class BusinessInsightCurrentSnapshot(StrictModel):
    selected_sections: list[BusinessAnalyticsSectionName] = Field(
        min_length=1,
        max_length=32,
    )
    grounding: BusinessAnalyticsGroundingPayload


class BusinessInsightOutcomeComparisonContext(StrictModel):
    previous_created_at: datetime
    current_created_at: datetime
    elapsed_minutes: int = Field(ge=0)
    analytics_snapshot_changed: bool


class BusinessInsightOutcomeEvaluationRequest(StrictModel):
    previous: BusinessInsightPreviousSnapshot
    current: BusinessInsightCurrentSnapshot
    comparison_context: BusinessInsightOutcomeComparisonContext


class BusinessInsightOutcomeEvaluationResponse(StrictModel):
    score: int | None = Field(..., ge=0, le=10)
    verdict: BusinessInsightOutcomeVerdict
    explanation: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=600),
    ]

    @model_validator(mode="after")
    def validate_score_verdict_consistency(
        self,
    ) -> BusinessInsightOutcomeEvaluationResponse:
        score_ranges = {
            "effective": range(7, 11),
            "partially_effective": range(4, 7),
            "not_effective": range(0, 4),
        }
        if self.verdict == "insufficient_data":
            if self.score is not None:
                raise ValueError("score must be null when verdict is insufficient_data")
        elif self.score is None or self.score not in score_ranges[self.verdict]:
            raise ValueError("score does not match the selected outcome verdict")
        return self
