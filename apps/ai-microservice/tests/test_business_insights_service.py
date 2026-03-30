from __future__ import annotations

import json

import pytest

from app.errors import ServiceError
from app.models.business_insights import BusinessAnalyticsInsightRequest
from app.services.business_insights import (
    BusinessInsightService,
    OpenRouterBusinessInsightProvider,
)


def _build_grounding_payload(
    *,
    total_revenue: str = "8849.00",
    total_check_ins: int = 30,
    peak_hour_check_ins: int = 14,
    include_inventory: bool = True,
    top_product_quantity: int = 12,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "window": {
            "start_date": "2025-01-01",
            "end_date": "2025-01-31",
            "period": "custom",
            "focus": "overview",
        },
        "overview": {
            "total_revenue": total_revenue,
            "total_check_ins": total_check_ins,
            "new_members": 18,
            "completed_coaching_sessions": 4,
        },
        "revenue": {
            "totals": {
                "membership_revenue": total_revenue,
                "booking_revenue": "1200.00",
                "product_revenue": "850.00",
                "coaching_payments_collected": "3000.00",
                "coaching_gym_revenue": "1800.00",
                "total_revenue": total_revenue,
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
                    "check_ins": total_check_ins,
                }
            ],
            "peak_hours": [{"hour_label": "06:00", "check_ins": peak_hour_check_ins}],
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
    }

    if include_inventory:
        payload["inventory"] = {
            "top_products": [
                {
                    "name": "Protein Bar",
                    "quantity_sold": top_product_quantity,
                    "revenue": "840.00",
                }
            ]
        }

    return payload


def _build_request(**payload_overrides: object) -> BusinessAnalyticsInsightRequest:
    payload = _build_grounding_payload(**payload_overrides)
    return BusinessAnalyticsInsightRequest.model_validate({"grounding": payload})


def test_detect_anomalies_flags_expected_grounding_edges() -> None:
    request = _build_request(
        total_revenue="0.00",
        total_check_ins=0,
        peak_hour_check_ins=0,
        top_product_quantity=0,
    )

    assert BusinessInsightService.detect_anomalies(request.grounding) == [
        "No attendance was recorded for the selected window.",
        "Revenue is zero even though active members exist in the selected window.",
        "Peak attendance hours were computed without recorded check-ins.",
        "Inventory sales data is present, but the top product has zero quantity sold.",
    ]


def test_detect_anomalies_returns_empty_list_for_healthy_grounding() -> None:
    request = _build_request()

    assert BusinessInsightService.detect_anomalies(request.grounding) == []


def test_build_openrouter_insight_request_includes_schema_and_detected_anomalies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request(
        total_revenue="0.00",
        total_check_ins=0,
        peak_hour_check_ins=0,
        top_product_quantity=0,
    )

    payload = provider.build_openrouter_insight_request(request)
    user_message = payload["messages"][1]
    user_content = json.loads(user_message["content"])

    assert payload["model"] == "openrouter/test-model"
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert user_content["grounding"]["window"]["focus"] == "overview"
    assert user_content["detected_anomaly_flags"] == [
        "No attendance was recorded for the selected window.",
        "Revenue is zero even though active members exist in the selected window.",
        "Peak attendance hours were computed without recorded check-ins.",
        "Inventory sales data is present, but the top product has zero quantity sold.",
    ]


def test_generate_business_insight_parses_provider_response_and_merges_anomalies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request(total_revenue="0.00", total_check_ins=0)

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 321},
                "choices": [
                    {
                        "message": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": json.dumps(
                                        {
                                            "summary": "Revenue underperformed this window.",
                                            "highlights": ["Membership revenue softened."],
                                            "risks": ["Revenue is trending down."],
                                            "opportunities": ["Promote retention offers."],
                                            "anomaly_flags": [
                                                "Revenue is zero even though active members exist in the selected window."
                                            ],
                                            "recommended_actions": ["Review offer timing."],
                                        }
                                    ),
                                }
                            ]
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.business_insights.httpx.post",
        lambda *args, **kwargs: FakeResponse(),
    )

    response = provider.generate_business_insight(request)

    assert response.summary == "Revenue underperformed this window."
    assert response.model_used == "openrouter/test-model"
    assert response.token_count == 321
    assert response.anomaly_flags == [
        "Revenue is zero even though active members exist in the selected window.",
        "No attendance was recorded for the selected window.",
    ]


def test_generate_business_insight_rejects_invalid_provider_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps({"summary": "Missing required fields"})
                        }
                    }
                ]
            }

    monkeypatch.setattr(
        "app.services.business_insights.httpx.post",
        lambda *args, **kwargs: FakeResponse(),
    )

    with pytest.raises(ServiceError) as error:
        provider.generate_business_insight(request)

    assert error.value.type == "BAD_GATEWAY"
    assert error.value.status == 502
    assert "required schema" in error.value.detail
