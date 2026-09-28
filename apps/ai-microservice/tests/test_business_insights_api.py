from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.routes import business_insight_service
from app.main import app
from app.models.business_insights import (
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
    BusinessInsightOutcomeEvaluationRequest,
    BusinessInsightOutcomeEvaluationResponse,
)


def _build_grounding_payload() -> dict[str, object]:
    return {
        "window": {
            "start_date": "2025-01-01",
            "end_date": "2025-01-31",
            "previous_start_date": "2024-12-01",
            "previous_end_date": "2024-12-31",
            "period": "custom",
            "focus": "overview",
        },
        "comparisons": {
            "total_revenue": {
                "current": "8849.00",
                "previous": "9000.00",
                "absolute_change": "-151.00",
                "percentage_change": -1.7,
                "direction": "decrease",
            },
            "check_ins": {
                "current": 30,
                "previous": 24,
                "absolute_change": 6,
                "percentage_change": 25.0,
                "direction": "increase",
            },
            "new_members": {
                "current": 18,
                "previous": 0,
                "absolute_change": 18,
                "percentage_change": None,
                "direction": "new_from_zero",
            },
            "completed_coaching_sessions": {
                "current": 4,
                "previous": 5,
                "absolute_change": -1,
                "percentage_change": -20.0,
                "direction": "decrease",
            },
        },
        "derived_signals": {
            "revenue_mix_percentages": {
                "memberships": 56.5,
                "bookings": 13.6,
                "products": 9.6,
                "coaching": 20.3,
            },
            "top_revenue_source_concentration": {
                "source_key": "memberships",
                "source_label": "Memberships",
                "percentage": 56.5,
            },
            "peak_hour_attendance_concentration": {
                "hour_label": "06:00",
                "check_ins": 14,
                "percentage": 46.7,
            },
            "equipment_availability_percentage": 87.5,
            "low_stock_exposure_percentage": 14.3,
            "out_of_stock_exposure_percentage": 7.1,
        },
        "overview": {
            "total_revenue": "8849.00",
            "total_check_ins": 30,
            "new_members": 18,
            "completed_coaching_sessions": 4,
        },
        "revenue": {
            "totals": {
                "membership_revenue": "4999.00",
                "booking_revenue": "1200.00",
                "product_revenue": "850.00",
                "coaching_payments_collected": "3000.00",
                "coaching_gym_revenue": "1800.00",
                "total_revenue": "8849.00",
            },
            "series": [
                {
                    "bucket_start": "2025-01-05T00:00:00.000Z",
                    "membership_revenue": "1000.00",
                    "booking_revenue": "250.00",
                    "product_revenue": "100.00",
                    "coaching_payments_collected": "900.00",
                    "coaching_gym_revenue": "600.00",
                    "total_revenue": "1950.00",
                }
            ],
        },
        "attendance": {
            "series": [
                {
                    "bucket_start": "2025-01-05T00:00:00.000Z",
                    "check_ins": 21,
                }
            ],
            "peak_hours": [{"hour_label": "06:00", "check_ins": 14}],
        },
        "membership": {
            "new_members": 18,
            "active_members": 124,
            "top_plans": [
                {
                    "name": "Elite",
                    "subscriber_count": 3,
                    "revenue": "4500.00",
                }
            ],
        },
        "coaching": {
            "coaches": [
                {
                    "coach_id": "coach-1",
                    "first_name": "Maria",
                    "last_name": "Santos",
                    "total_billed": "5400.00",
                    "gym_cut": "1080.00",
                    "coach_payout": "4320.00",
                    "completed_sessions": 6,
                }
            ]
        },
        "inventory": {
            "retail_items": 14,
            "low_stock_items": 2,
            "out_of_stock_items": 1,
            "retail_inventory_value": "16450.00",
            "retail_sales_revenue": "850.00",
            "equipment_types": 9,
            "equipment_units_available": 28,
            "equipment_units_total": 32,
            "equipment_under_maintenance": 2,
            "top_products": [
                {
                    "name": "Protein Bar",
                    "quantity_sold": 12,
                    "revenue": "840.00",
                }
            ]
        },
    }


def test_business_insight_route_returns_structured_insight(
    monkeypatch,
) -> None:
    client = TestClient(app)

    def fake_generate_insight(
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        assert payload.grounding.window.focus == "overview"
        return BusinessAnalyticsInsightResponse(
            summary="Membership revenue led the selected window.",
            highlights=[
                "Membership revenue contributed most of the total revenue.",
                "Morning attendance remained the busiest time block.",
            ],
            risks=["Attendance concentration is narrow around one peak hour."],
            opportunities=["Bundle promotions with the Elite plan upsell."],
            anomaly_flags=[],
            recommended_actions=[
                "Review staffing coverage around the 06:00 attendance spike."
            ],
            model_used="openrouter/test-model",
            token_count=321,
        )

    monkeypatch.setattr(
        business_insight_service,
        "generate_insight",
        fake_generate_insight,
    )

    response = client.post(
        "/analytics/insights",
        json={"grounding": _build_grounding_payload()},
    )

    assert response.status_code == 200
    assert response.json() == {
        "summary": "Membership revenue led the selected window.",
        "highlights": [
            "Membership revenue contributed most of the total revenue.",
            "Morning attendance remained the busiest time block.",
        ],
        "risks": ["Attendance concentration is narrow around one peak hour."],
        "opportunities": ["Bundle promotions with the Elite plan upsell."],
        "anomaly_flags": [],
        "recommended_actions": [
            "Review staffing coverage around the 06:00 attendance spike."
        ],
        "model_used": "openrouter/test-model",
        "token_count": 321,
    }


def test_business_insight_route_returns_422_for_invalid_focus() -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    payload["window"]["focus"] = "sales"

    response = client.post(
        "/analytics/insights",
        json={"grounding": payload},
    )

    error_payload = response.json()

    assert response.status_code == 422
    assert error_payload["type"] == "INVALID_REQUEST"
    assert error_payload["title"] == "Invalid Request"
    assert error_payload["status"] == 422
    assert "body.grounding.window.focus" in error_payload["detail"]


def test_business_insight_route_accepts_revenue_breakdowns_and_analysis_metadata(
    monkeypatch,
) -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    breakdowns = {
        "membership_card_revenue": "1200.00",
        "gym_membership_revenue": "800.00",
        "cash_membership_revenue": "600.00",
        "paymongo_membership_revenue": "3400.00",
    }
    payload["revenue"]["totals"].update(breakdowns)
    payload["revenue"]["series"][0].update(breakdowns)
    captured: dict[str, object] = {}

    def fake_generate_insight(
        request: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        captured["request"] = request
        assert request.analysis is not None
        assert request.analysis.analysis_depth == "deep"
        assert request.analysis.selected_sections == ["overview", "revenue"]
        assert request.analysis.section_contexts["revenue"]["window"] == "2025-01"
        assert request.grounding.revenue.totals.membership_card_revenue == "1200.00"
        assert request.grounding.revenue.series[0].paymongo_membership_revenue == "3400.00"
        return BusinessAnalyticsInsightResponse(
            summary="Revenue mix accepted.",
            highlights=["Breakdowns reached the provider boundary."],
            risks=[],
            opportunities=[],
            anomaly_flags=[],
            recommended_actions=["Keep the selected sections in the saved snapshot."],
            model_used="openrouter/test-model",
        )

    monkeypatch.setattr(
        business_insight_service,
        "generate_insight",
        fake_generate_insight,
    )

    response = client.post(
        "/analytics/insights",
        json={
            "grounding": payload,
            "analysis": {
                "analysis_depth": "deep",
                "selected_sections": ["overview", "revenue"],
                "section_contexts": {
                    "overview": {"window": "2025-01"},
                    "revenue": {"window": "2025-01"},
                },
                "data_fingerprint": "fingerprint-2025-01",
            },
        },
    )

    assert response.status_code == 200
    assert captured["request"] is not None


@pytest.mark.parametrize("bucket", ["totals", "series"])
def test_business_insight_route_rejects_empty_revenue_breakdowns(bucket: str) -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    target = payload["revenue"][bucket]
    if bucket == "series":
        target = target[0]
    target["cash_membership_revenue"] = ""

    response = client.post(
        "/analytics/insights",
        json={"grounding": payload},
    )

    assert response.status_code == 422
    assert "cash_membership_revenue" in response.json()["detail"]


def test_business_insight_route_rejects_unknown_revenue_breakdowns() -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    payload["revenue"]["totals"]["unknown_revenue"] = "1.00"

    response = client.post(
        "/analytics/insights",
        json={"grounding": payload},
    )

    assert response.status_code == 422
    assert "unknown_revenue" in response.json()["detail"]


def test_business_insight_route_returns_422_for_nested_extra_fields() -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    payload["overview"]["unexpected"] = "not allowed"

    response = client.post(
        "/analytics/insights",
        json={"grounding": payload},
    )

    error_payload = response.json()

    assert response.status_code == 422
    assert error_payload["type"] == "INVALID_REQUEST"
    assert error_payload["title"] == "Invalid Request"
    assert error_payload["status"] == 422
    assert "body.grounding.overview.unexpected" in error_payload["detail"]
    assert "Extra inputs are not permitted" in error_payload["detail"]


def test_business_insight_outcome_route_uses_the_dedicated_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    grounding = _build_grounding_payload()
    captured: dict[str, object] = {}

    def fake_evaluate_outcome(
        request: BusinessInsightOutcomeEvaluationRequest,
    ) -> BusinessInsightOutcomeEvaluationResponse:
        captured["request"] = request
        assert request.previous.summary == "Earlier recommendation"
        assert request.previous.selected_sections == ["attendance"]
        assert request.current.selected_sections == ["attendance"]
        assert request.comparison_context.elapsed_minutes == 35
        assert request.comparison_context.analytics_snapshot_changed is False
        return BusinessInsightOutcomeEvaluationResponse(
            score=8,
            verdict="effective",
            explanation=(
                "The later snapshot is consistent with the earlier recommendation."
            ),
        )

    monkeypatch.setattr(
        business_insight_service,
        "evaluate_outcome",
        fake_evaluate_outcome,
    )

    response = client.post(
        "/analytics/insights/evaluate",
        json={
            "previous": {
                "summary": "Earlier recommendation",
                "recommended_actions": ["Adjust attendance coverage."],
                "selected_sections": ["attendance"],
                "grounding": grounding,
            },
            "current": {
                "selected_sections": ["attendance"],
                "grounding": grounding,
            },
            "comparison_context": {
                "previous_created_at": "2026-09-21T01:00:00+08:00",
                "current_created_at": "2026-09-21T01:35:00+08:00",
                "elapsed_minutes": 35,
                "analytics_snapshot_changed": False,
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "score": 8,
        "verdict": "effective",
        "explanation": (
            "The later snapshot is consistent with the earlier recommendation."
        ),
    }
    assert captured["request"] is not None
