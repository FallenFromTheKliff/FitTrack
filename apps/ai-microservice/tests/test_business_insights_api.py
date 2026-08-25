from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.routes import business_insight_service
from app.main import app
from app.models.business_insights import (
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
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
