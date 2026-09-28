from __future__ import annotations

import json
import logging
import ssl

import pytest
from pydantic import ValidationError

from app.errors import ServiceError
from app.models.business_insights import (
    BusinessAnalyticsInsightRequest,
    BusinessInsightOutcomeEvaluationRequest,
    BusinessInsightOutcomeEvaluationResponse,
)
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
            "previous_start_date": "2024-12-01",
            "previous_end_date": "2024-12-31",
            "period": "custom",
            "focus": "overview",
        },
        "comparisons": {
            "total_revenue": {
                "current": total_revenue,
                "previous": "9000.00" if total_revenue != "0.00" else "0.00",
                "absolute_change": "-151.00" if total_revenue != "0.00" else "0.00",
                "percentage_change": -1.7 if total_revenue != "0.00" else None,
                "direction": "decrease" if total_revenue != "0.00" else "flat",
            },
            "check_ins": {
                "current": total_check_ins,
                "previous": 24 if total_check_ins else 0,
                "absolute_change": total_check_ins - 24 if total_check_ins else 0,
                "percentage_change": 25.0 if total_check_ins else None,
                "direction": "increase" if total_check_ins else "flat",
            },
            "new_members": {
                "current": 18, "previous": 0, "absolute_change": 18,
                "percentage_change": None, "direction": "new_from_zero",
            },
            "completed_coaching_sessions": {
                "current": 4, "previous": 5, "absolute_change": -1,
                "percentage_change": -20.0, "direction": "decrease",
            },
        },
        "derived_signals": {
            "revenue_mix_percentages": {
                "memberships": 56.5, "bookings": 13.6,
                "products": 9.6, "coaching": 20.3,
            },
            "top_revenue_source_concentration": {
                "source_key": "memberships", "source_label": "Memberships",
                "percentage": 56.5,
            } if total_revenue != "0.00" else None,
            "peak_hour_attendance_concentration": {
                "hour_label": "06:00", "check_ins": peak_hour_check_ins,
                "percentage": 46.7,
            } if total_check_ins else None,
            "equipment_availability_percentage": 87.5 if include_inventory else None,
            "low_stock_exposure_percentage": 14.3 if include_inventory else None,
            "out_of_stock_exposure_percentage": 7.1 if include_inventory else None,
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


def _build_outcome_request() -> BusinessInsightOutcomeEvaluationRequest:
    grounding = _build_grounding_payload()
    return BusinessInsightOutcomeEvaluationRequest.model_validate(
        {
            "previous": {
                "summary": "Earlier attendance recommendation.",
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
        }
    )


def test_outcome_contract_rejects_inconsistent_score_and_verdict() -> None:
    with pytest.raises(ValidationError):
        BusinessInsightOutcomeEvaluationResponse(
            score=8,
            verdict="partially_effective",
            explanation="The score and verdict conflict.",
        )


def test_outcome_contract_rejects_fractional_scores() -> None:
    with pytest.raises(ValidationError):
        BusinessInsightOutcomeEvaluationResponse(
            score=7.5,
            verdict="effective",
            explanation="The score must be a whole number from zero to ten.",
        )


def test_outcome_score_is_required_but_nullable() -> None:
    with pytest.raises(ValidationError):
        BusinessInsightOutcomeEvaluationResponse.model_validate(
            {
                "verdict": "insufficient_data",
                "explanation": "The score field was omitted.",
            }
        )

    insufficient = BusinessInsightOutcomeEvaluationResponse(
        score=None,
        verdict="insufficient_data",
        explanation="The snapshots do not contain enough comparable evidence.",
    )
    effective = BusinessInsightOutcomeEvaluationResponse(
        score=8,
        verdict="effective",
        explanation="The later snapshot is consistent with the recommendation.",
    )

    assert insufficient.score is None
    assert effective.score == 8


def test_provider_calls_llm_for_unchanged_snapshot_and_accepts_insufficient_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_FALLBACK_MODEL", "openrouter/free")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_outcome_request()
    calls: list[dict[str, object]] = []

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "score": None,
                                    "verdict": "insufficient_data",
                                    "explanation": (
                                        "Only 35 minutes elapsed and the analytics "
                                        "snapshot remained unchanged, so there is not "
                                        "yet enough evidence to evaluate the recommendation."
                                    ),
                                }
                            )
                        }
                    }
                ]
            }

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        calls.append(kwargs["json"])
        return FakeResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.evaluate_business_insight_outcome(request)

    assert len(calls) == 1
    assert response.score is None
    assert response.verdict == "insufficient_data"
    assert response.explanation == (
        "Only 35 minutes elapsed and the analytics snapshot remained unchanged, "
        "so there is not yet enough evidence to evaluate the recommendation."
    )
    assert calls[0]["model"] == "openrouter/test-model"
    user_payload = json.loads(calls[0]["messages"][1]["content"])
    assert user_payload["previous"]["summary"] == "Earlier attendance recommendation."
    assert user_payload["comparison_context"] == {
        "previous_created_at": "2026-09-21T01:00:00+08:00",
        "current_created_at": "2026-09-21T01:35:00+08:00",
        "elapsed_minutes": 35,
        "analytics_snapshot_changed": False,
    }
    system_prompt = calls[0]["messages"][0]["content"]
    assert "comparison_context" in system_prompt
    assert "analytics_snapshot_changed is false" in system_prompt
    assert "comparison_context.elapsed_minutes" in system_prompt
    assert calls[0]["response_format"]["json_schema"]["strict"] is True


def test_outcome_evaluation_retries_primary_with_json_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "primary-test-model")
    monkeypatch.delenv("OPENROUTER_INSIGHT_FALLBACK_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_FREE_MODEL_FALLBACK", raising=False)
    provider = OpenRouterBusinessInsightProvider()
    calls: list[dict[str, object]] = []

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict[str, object]) -> None:
            self.status_code = status_code
            self.payload = payload

        def json(self) -> dict[str, object]:
            return self.payload

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        calls.append(kwargs["json"])
        if len(calls) == 1:
            return FakeResponse(
                400,
                {"error": {"message": "json_schema is not supported"}},
            )
        return FakeResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "score": 5,
                                    "verdict": "partially_effective",
                                    "explanation": "The later result is mixed.",
                                }
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.evaluate_business_insight_outcome(
        _build_outcome_request()
    )

    assert response.score == 5
    assert len(calls) == 2
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[1]["response_format"] == {"type": "json_object"}


def test_outcome_evaluation_uses_fallback_after_primary_variants_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "primary-test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_FALLBACK_MODEL", "openrouter/free")
    provider = OpenRouterBusinessInsightProvider()
    calls: list[dict[str, object]] = []

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict[str, object]) -> None:
            self.status_code = status_code
            self.payload = payload

        def json(self) -> dict[str, object]:
            return self.payload

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        request_payload = kwargs["json"]
        calls.append(request_payload)
        if request_payload["model"] == "primary-test-model":
            return FakeResponse(
                400,
                {"error": {"message": "primary model rejected the request"}},
            )
        return FakeResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "score": 8,
                                    "verdict": "effective",
                                    "explanation": (
                                        "The fallback found consistent later evidence."
                                    ),
                                }
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.evaluate_business_insight_outcome(
        _build_outcome_request()
    )

    assert response.score == 8
    assert [call["model"] for call in calls] == [
        "primary-test-model",
        "primary-test-model",
        "primary-test-model",
        "openrouter/free",
    ]
    assert "response_format" not in calls[2]
    assert calls[3]["response_format"]["type"] == "json_schema"


def test_outcome_evaluation_propagates_last_error_when_all_variants_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "primary-test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_FALLBACK_MODEL", "openrouter/free")
    provider = OpenRouterBusinessInsightProvider()
    calls: list[dict[str, object]] = []

    class RejectedResponse:
        status_code = 503

        @staticmethod
        def json() -> dict[str, object]:
            return {"error": {"message": "comparison provider unavailable"}}

    def fake_post(*args: object, **kwargs: object) -> RejectedResponse:
        calls.append(kwargs["json"])
        return RejectedResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    with pytest.raises(ServiceError) as error:
        provider.evaluate_business_insight_outcome(_build_outcome_request())

    assert len(calls) == 6
    assert error.value.status == 502
    assert error.value.detail == "comparison provider unavailable"


def test_outcome_evaluation_uses_comparison_only_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "primary-test-model")
    monkeypatch.delenv("OPENROUTER_INSIGHT_FALLBACK_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_FREE_MODEL_FALLBACK", raising=False)
    monkeypatch.delenv("OPENROUTER_BUSINESS_INSIGHT_TIMEOUT_SECONDS", raising=False)
    provider = OpenRouterBusinessInsightProvider()
    timeouts: list[float] = []

    class FakeResponse:
        status_code = 200

        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def json(self) -> dict[str, object]:
            return self.payload

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        assert isinstance(kwargs["verify"], ssl.SSLContext)
        assert kwargs["trust_env"] is False
        timeouts.append(kwargs["timeout"])
        request_payload = kwargs["json"]
        user_payload = json.loads(request_payload["messages"][1]["content"])
        if "previous" in user_payload:
            content = {
                "score": 8,
                "verdict": "effective",
                "explanation": "The later snapshot is consistent.",
            }
        else:
            content = {
                "summary": "The saved metrics support one bounded action.",
                "highlights": ["Attendance remained measurable."],
                "risks": [],
                "opportunities": [],
                "anomaly_flags": [],
                "recommended_actions": [],
            }
        return FakeResponse(
            {"choices": [{"message": {"content": json.dumps(content)}}]}
        )

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    provider.evaluate_business_insight_outcome(_build_outcome_request())
    provider.generate_business_insight(_build_request())

    assert timeouts == [30.0, 10.0]


def test_outcome_evaluation_failure_is_not_replaced_with_a_fallback() -> None:
    class FailingComparisonProvider:
        def evaluate_business_insight_outcome(self, payload: object) -> object:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Comparison Unavailable",
                status=503,
                detail="The comparison provider is unavailable.",
            )

    service = BusinessInsightService(provider=FailingComparisonProvider())

    with pytest.raises(ServiceError) as error:
        service.evaluate_outcome(_build_outcome_request())

    assert error.value.status == 503
    assert error.value.detail == "The comparison provider is unavailable."


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


def test_provider_timeout_and_attempt_bounds_compose_with_nest_outer_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = OpenRouterBusinessInsightProvider()
    monkeypatch.delenv("OPENROUTER_BUSINESS_INSIGHT_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("OPENROUTER_BUSINESS_INSIGHT_MAX_ATTEMPTS", raising=False)
    assert provider._request_timeout_seconds() == 10.0
    assert provider._max_attempts() == 4

    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_TIMEOUT_SECONDS", "99")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MAX_ATTEMPTS", "99")
    assert provider._request_timeout_seconds() == 10.0
    assert provider._max_attempts() == 4

    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_TIMEOUT_SECONDS", "0")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MAX_ATTEMPTS", "0")
    assert provider._request_timeout_seconds() == 3.0
    assert provider._max_attempts() == 1


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
    system_prompt = payload["messages"][0]["content"]
    user_message = payload["messages"][1]
    user_content = json.loads(user_message["content"])

    assert payload["model"] == "openrouter/test-model"
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert "Never restate a dashboard metric by itself" in system_prompt
    assert "Comparative language is forbidden unless comparator evidence exists" in system_prompt
    assert "possible drivers" in system_prompt
    assert "Every highlight, risk, and opportunity must contain evidence" in system_prompt
    assert "at most three prioritized recommended_actions" in system_prompt
    assert "Owner · timeframe — action. Success: measurable outcome." in system_prompt
    assert "reviewing, observing, or monitoring" in system_prompt
    assert user_content["grounding"]["window"]["focus"] == "overview"
    assert user_content["detected_anomaly_flags"] == [
        "No attendance was recorded for the selected window.",
        "Revenue is zero even though active members exist in the selected window.",
        "Peak attendance hours were computed without recorded check-ins.",
        "Inventory sales data is present, but the top product has zero quantity sold.",
    ]


def test_revenue_breakdowns_are_valid_in_totals_and_series_but_stay_strict() -> None:
    payload = _build_grounding_payload()
    breakdowns = {
        "membership_card_revenue": "1200.00",
        "gym_membership_revenue": "800.00",
        "cash_membership_revenue": "600.00",
        "paymongo_membership_revenue": "3400.00",
    }
    payload["revenue"]["totals"].update(breakdowns)
    payload["revenue"]["series"][0].update(breakdowns)

    request = BusinessAnalyticsInsightRequest.model_validate({"grounding": payload})

    assert request.grounding.revenue.totals.membership_card_revenue == "1200.00"
    assert request.grounding.revenue.series[0].cash_membership_revenue == "600.00"

    with pytest.raises(ValueError):
        BusinessAnalyticsInsightRequest.model_validate(
            {
                "grounding": {
                    **payload,
                    "revenue": {
                        **payload["revenue"],
                        "totals": {
                            **payload["revenue"]["totals"],
                            "membership_card_revenue": "",
                            "unexpected_revenue": "1.00",
                        },
                    },
                }
            }
        )


def test_configured_provider_receives_analysis_metadata_and_revenue_breakdowns(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    monkeypatch.setenv("OPENROUTER_INSIGHT_MODEL", "openrouter/legacy-insight-model")
    provider = OpenRouterBusinessInsightProvider()
    grounding = _build_grounding_payload()
    breakdowns = {
        "membership_card_revenue": "1200.00",
        "gym_membership_revenue": "800.00",
        "cash_membership_revenue": "600.00",
        "paymongo_membership_revenue": "3400.00",
    }
    grounding["revenue"]["totals"].update(breakdowns)
    grounding["revenue"]["series"][0].update(breakdowns)
    request = BusinessAnalyticsInsightRequest.model_validate(
        {
            "grounding": grounding,
            "analysis": {
                "analysis_depth": "brief",
                "selected_sections": ["overview", "revenue"],
                "section_contexts": {
                    "overview": {"window": "2025-01"},
                    "revenue": {"window": "2025-01"},
                },
                "data_fingerprint": "fingerprint-2025-01",
            },
        }
    )
    calls: list[dict[str, object]] = []

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 88},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "summary": "Selected sections were analyzed.",
                                    "highlights": ["Revenue breakdowns were available."],
                                    "risks": [],
                                    "opportunities": [],
                                    "anomaly_flags": [],
                                    "recommended_actions": ["Keep the selected snapshot."],
                                }
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        return FakeResponse()

    monkeypatch.setattr("app.services.business_insights.httpx.post", fake_post)

    response = provider.generate_business_insight(request)

    assert response.summary == "Selected sections were analyzed."
    assert calls
    user_content = json.loads(calls[0]["messages"][1]["content"])
    assert user_content["analysis_depth"] == "brief"
    assert user_content["active_sections"] == ["overview", "revenue"]
    assert user_content["section_contexts"]["revenue"]["window"] == "2025-01"


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


def test_generate_business_insight_normalizes_nested_aliases_and_output_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "openrouter/test-model")
    provider = OpenRouterBusinessInsightProvider()
    request = _build_request()
    nested_payload = {
        "result": {
            "executive_summary": "  Revenue improved against the prior window.  ",
            "highlights": [{"text": "Membership concentration supports one bounded test."}],
            "risks": "Peak attendance concentration could constrain service.",
            "opportunities": [{"description": "Shift one offer into the measured peak."}],
            "anomalyFlags": [{"content": "A measured variance exceeded the threshold."}],
            "recommendedActions": [
                {
                    "action": "Operations · next 7 days — align peak coverage. Success: waits stay below 3 minutes."
                }
            ],
        }
    }

    class NestedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "openrouter/test-model",
                "usage": {"total_tokens": 91},
                "choices": [
                    {
                        "message": {
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json.dumps(json.dumps(nested_payload)),
                                }
                            ]
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.business_insights.httpx.post",
        lambda *args, **kwargs: NestedResponse(),
    )

    response = provider.generate_business_insight(request)

    assert response.summary == "Revenue improved against the prior window."
    assert response.highlights == [
        "Membership concentration supports one bounded test."
    ]
    assert response.risks == [
        "Peak attendance concentration could constrain service."
    ]
    assert response.opportunities == [
        "Shift one offer into the measured peak."
    ]
    assert response.recommended_actions == [
        "Operations · next 7 days — align peak coverage. Success: waits stay below 3 minutes."
    ]
    assert response.token_count == 91


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


def test_business_insight_failure_log_keeps_safe_provider_reason(
    caplog: pytest.LogCaptureFixture,
) -> None:
    request = _build_request()

    class FailingProvider:
        def generate_business_insight(self, payload: object) -> object:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Unavailable",
                status=503,
                detail=(
                    "OpenRouter rejected the request; token=secret-value "
                    "Bearer bearer-secret sk-standalone-secret-key"
                ),
            )

    service = BusinessInsightService(provider=FailingProvider())

    with caplog.at_level(logging.WARNING, logger="app.services.business_insights"):
        service.generate_insight(request)

    message = next(
        record.getMessage()
        for record in caplog.records
        if "Returning grounded fallback" in record.getMessage()
    )
    assert "503" in message
    assert "OpenRouter rejected the request" in message
    assert "secret-value" not in message
    assert "bearer-secret" not in message
    assert "sk-standalone-secret-key" not in message
    assert "token=[REDACTED]" in message
    assert "sk-[REDACTED]" in message
    assert len(message) < 600


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
    assert "It matters because" in response.summary
    assert "Next," in response.summary
    assert "revenue is" not in response.summary.lower()
    assert (
        "No attendance was recorded for the selected window."
        in response.anomaly_flags
    )
    assert response.recommended_actions
    assert len(response.recommended_actions) <= 3
    assert all(" · " in action and " — " in action and "Success:" in action for action in response.recommended_actions)
    assert not any(word in " ".join(response.recommended_actions).lower() for word in ("review", "observe", "monitor"))


@pytest.mark.parametrize(
    ("focus", "summary_evidence", "first_action_owner"),
    [
        ("overview", "Cross-domain priority:", "General manager ·"),
        ("revenue", "Revenue decreased", "Finance ·"),
        ("attendance", "Check-ins increased", "Operations ·"),
        ("membership", "New members established", "Membership lead ·"),
        (
            "coaching",
            "Completed coaching sessions decreased",
            "Coaching lead ·",
        ),
        ("inventory", "Inventory exposure shows", "Inventory lead ·"),
    ],
)
def test_grounded_fallback_is_focus_specific_and_action_bounded(
    focus: str,
    summary_evidence: str,
    first_action_owner: str,
) -> None:
    payload = _build_grounding_payload()
    payload["window"]["focus"] = focus
    request = BusinessAnalyticsInsightRequest.model_validate({"grounding": payload})

    response = BusinessInsightService.build_grounded_fallback(request.grounding)

    assert summary_evidence in response.summary
    assert "It matters because" in response.summary
    assert "Next," in response.summary
    assert response.recommended_actions[0].startswith(first_action_owner)
    assert len(response.recommended_actions) <= 3
    assert all(
        " · " in action and " — " in action and "Success:" in action
        for action in response.recommended_actions
    )
    assert not any(
        word in " ".join(response.recommended_actions).lower()
        for word in ("review", "observe", "monitor")
    )


def test_inventory_fallback_labels_missing_denominators_without_inventing_ratios() -> None:
    payload = _build_grounding_payload(include_inventory=False)
    payload["window"]["focus"] = "inventory"
    request = BusinessAnalyticsInsightRequest.model_validate({"grounding": payload})

    response = BusinessInsightService.build_grounded_fallback(request.grounding)

    assert "unavailable because no reliable equipment or retail denominator exists" in response.summary
    assert response.recommended_actions[0].startswith("Inventory lead ·")
    assert "availability and stock exposure are calculable" in response.recommended_actions[0]
