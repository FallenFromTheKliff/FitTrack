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
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
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
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
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


def test_generate_business_insight_retries_with_json_object_when_schema_mode_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()
    calls: list[dict[str, object]] = []

    class FakeRejectedResponse:
        status_code = 400

        def json(self) -> dict[str, object]:
            return {"error": {"message": "json_schema unsupported"}}

    class FakeAcceptedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 144},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Membership stayed stable.",
                                    "highlights": ["Membership revenue led the window."],
                                    "risks": ["Check-in volume is still concentrated."],
                                    "opportunities": ["Promote retail items near peak hours."],
                                    "anomaly_flags": [],
                                    "recommended_actions": ["Review staffing around 06:00."],
                                }
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        if len(calls) == 1:
            return FakeRejectedResponse()
        return FakeAcceptedResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.generate_business_insight(request)

    assert response.summary == "Membership stayed stable."
    assert response.token_count == 144
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[1]["response_format"]["type"] == "json_object"


def test_generate_business_insight_retries_with_openrouter_free_model_after_rate_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
    monkeypatch.setenv("OPENROUTER_FREE_MODEL_FALLBACK", "openrouter/free")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()
    calls: list[dict[str, object]] = []

    class RateLimitedResponse:
        status_code = 429

        def json(self) -> dict[str, object]:
            return {"error": {"message": "rate limited"}}

    class FreeAcceptedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/free",
                "usage": {"total_tokens": 88},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Fallback free-model insight.",
                                    "highlights": ["Attendance is stable."],
                                    "risks": ["Peak hours still need staffing review."],
                                    "opportunities": ["Promote retail near check-in spikes."],
                                    "anomaly_flags": [],
                                    "recommended_actions": ["Review front-desk coverage."],
                                }
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        if len(calls) < 4:
            return RateLimitedResponse()
        return FreeAcceptedResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.generate_business_insight(request)

    assert response.model_used == "openrouter/free"
    assert response.token_count == 88
    assert calls[0]["model"] == "openrouter/test-model"
    assert calls[1]["model"] == "openrouter/test-model"
    assert calls[2]["model"] == "openrouter/test-model"
    assert "response_format" not in calls[2]
    assert calls[3]["model"] == "openrouter/free"


def test_generate_business_insight_retries_after_invalid_200_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()
    calls: list[dict[str, object]] = []

    class InvalidAcceptedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "choices": [
                    {
                        "message": {
                            "content": json.dumps({"summary": "Missing fields"})
                        }
                    }
                ],
            }

    class ValidAcceptedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 102},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Revenue is holding steady.",
                                    "highlights": ["Attendance stayed consistent."],
                                    "risks": ["Peak-hour pressure remains."],
                                    "opportunities": ["Pair retail prompts with check-ins."],
                                    "anomaly_flags": [],
                                    "recommended_actions": ["Review staffing at 06:00."],
                                }
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        if len(calls) == 1:
            return InvalidAcceptedResponse()
        return ValidAcceptedResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.generate_business_insight(request)

    assert response.summary == "Revenue is holding steady."
    assert response.model_used == "openrouter/test-model"
    assert response.token_count == 102
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[1]["response_format"]["type"] == "json_object"


def test_generate_business_insight_parses_code_fenced_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()

    class FencedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 77},
                "choices": [
                    {
                        "message": {
                            "content": "```json\n{\"summary\":\"Retail is healthy.\",\"highlights\":[\"Membership revenue led the window.\"],\"risks\":[\"Peak traffic is still concentrated.\"],\"opportunities\":[\"Push add-ons near check-in surges.\"],\"anomaly_flags\":[],\"recommended_actions\":[\"Review staffing around the top hour.\"]}\n```"
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.business_insights.httpx.post",
        lambda *args, **kwargs: FencedResponse(),
    )

    response = provider.generate_business_insight(request)

    assert response.summary == "Retail is healthy."
    assert response.model_used == "openrouter/test-model"


def test_generate_business_insight_rejects_invalid_provider_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
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


def test_generate_insight_falls_back_to_grounded_summary_when_provider_is_unavailable() -> None:
    request = _build_request(total_revenue="0.00", total_check_ins=0)

    class FailingProvider:
        def generate_business_insight(self, payload: object) -> object:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Unavailable",
                status=503,
                detail="OpenRouter business insight generation is unavailable.",
            )

    service = BusinessInsightService(provider=FailingProvider())

    response = service.generate_insight(request)

    assert response.model_used == "grounded-fallback"
    assert response.summary.startswith("Fallback insight:")
    assert (
        "No attendance was recorded for the selected window."
        in response.anomaly_flags
    )
    assert response.recommended_actions
