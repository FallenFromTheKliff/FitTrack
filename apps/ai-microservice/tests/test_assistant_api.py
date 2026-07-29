from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.assistant import (
    OpenRouterAssistantProvider,
    OpenRouterAssistantSettings,
)


def _openrouter_response(content: dict[str, object], *, model: str, tokens: int) -> object:
    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": model,
                "usage": {"total_tokens": tokens},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(content),
                        }
                    }
                ],
            }

    return FakeResponse()


def test_chat_route_uses_openrouter_assistant_model_when_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_MODEL",
        "openrouter/legacy-assistant-model",
    )
    monkeypatch.setenv(
        "OPENROUTER_INSIGHT_MODEL",
        "nvidia/nemotron-3-super-120b-a12b:free",
    )

    calls: list[dict[str, object]] = []

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        return _openrouter_response(
            {
                "content": "I can help you stay on track this week.",
                "action": "NONE",
                "params": None,
            },
            model="meta-llama/llama-3.3-70b-instruct:free",
            tokens=87,
        )

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Can you help me stay on track this week?"}
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-1",
                "context_type": "general",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["content"] == "I can help you stay on track this week."
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert payload["model_used"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert payload["token_count"] == 87
    assert calls[0]["model"] == "meta-llama/llama-3.3-70b-instruct:free"


def test_chat_route_returns_provider_status_message_when_openrouter_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    monkeypatch.setenv("OPENROUTER_FREE_MODEL_FALLBACK", "openrouter/free")

    class RejectedResponse:
        status_code = 503

        def json(self) -> dict[str, object]:
            return {"error": {"message": "service unavailable"}}

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: RejectedResponse(),
    )

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Can you build me a 4 week training plan with 3 days per week?",
                }
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-2",
                "context_type": "training_plan",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert payload["model_used"] == "provider-status"
    assert "temporarily unavailable" in payload["content"]


def test_chat_route_retries_with_openrouter_free_model_after_rate_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    monkeypatch.setenv("OPENROUTER_FREE_MODEL_FALLBACK", "openrouter/free")
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
                "usage": {"total_tokens": 55},
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "content": "Here is a real provider reply from the free fallback route.",
                                    "action": "NONE",
                                    "params": None,
                                }
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        if len(calls) < 3:
            return RateLimitedResponse()
        return FreeAcceptedResponse()

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Help me stay consistent with my workouts this week."}
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-fallback",
                "context_type": "general",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["model_used"] == "openrouter/free"
    assert payload["token_count"] == 55
    assert calls[0]["model"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert calls[1]["model"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert calls[2]["model"] == "openrouter/free"


def test_chat_route_parses_code_fenced_json_from_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class FencedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "usage": {"total_tokens": 41},
                "choices": [
                    {
                        "message": {
                            "content": "```json\n{\"content\":\"Lock in two realistic sessions and treat them like appointments.\",\"action\":\"NONE\",\"params\":null}\n```"
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: FencedResponse(),
    )

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Help me stay consistent with workouts this week."}
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-code-fence",
                "context_type": "general",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["content"] == "Lock in two realistic sessions and treat them like appointments."
    assert payload["action"] == "NONE"
    assert payload["params"] is None


def test_chat_route_wraps_plain_text_provider_reply_as_none_action(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class PlainTextResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "usage": {"total_tokens": 29},
                "choices": [
                    {
                        "message": {
                            "content": (
                                "Pair your workout with an existing habit, like heading to the gym "
                                "right after work."
                            )
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: PlainTextResponse(),
    )

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Give me one practical tip to stay consistent with my gym workouts this week.",
                }
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-plain-text",
                "context_type": "general",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert (
        payload["content"]
        == "Pair your workout with an existing habit, like heading to the gym right after work."
    )
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert payload["model_used"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert payload["token_count"] == 29


def test_chat_route_refuses_out_of_scope_prompts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_INSIGHT_MODEL", raising=False)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Explain the French Revolution in detail."}
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-scope",
                "context_type": "general",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["model_used"] == "intent-guard"
    assert "fitness, training, nutrition" in payload["content"]


def test_chat_route_admin_scope_refuses_fitness_coaching(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_INSIGHT_MODEL", raising=False)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Build me a 4 week workout plan."}
            ],
            "user_context": {
                "age": None,
                "gender": None,
                "weight_kg": None,
                "height_cm": None,
                "activity_level": None,
                "fitness_goal": None,
            },
            "session_context": {
                "session_id": "admin-session-fitness-refusal",
                "context_type": "general",
                "assistant_scope": "admin_business",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["model_used"] == "intent-guard"
    assert "admin business operations" in payload["content"]
    assert "can't handle fitness coaching" in payload["content"]


def test_chat_route_member_scope_refuses_business_ops(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_ASSISTANT_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_INSIGHT_MODEL", raising=False)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "How do I improve revenue and staffing?"}
            ],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "member-business-refusal",
                "context_type": "general",
                "assistant_scope": "member_fitness",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["model_used"] == "intent-guard"
    assert "business analytics" in payload["content"]


def test_chat_route_answers_admin_allowed_part_of_mixed_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    calls: list[dict[str, object]] = []

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        return _openrouter_response(
            {
                "content": "Review revenue, attendance, and staffing before the evening rush.",
                "action": "GENERATE_PLAN",
                "params": {"duration_weeks": 4, "days_per_week": 3},
            },
            model="meta-llama/llama-3.3-70b-instruct:free",
            tokens=61,
        )

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    client = TestClient(app)
    response = client.post(
        "/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "How should I improve revenue, and can you make me a workout plan?",
                }
            ],
            "user_context": {
                "age": None,
                "gender": None,
                "weight_kg": None,
                "height_cm": None,
                "activity_level": None,
                "fitness_goal": None,
            },
            "session_context": {
                "session_id": "admin-mixed-scope",
                "context_type": "general",
                "assistant_scope": "admin_business",
            },
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert "Review revenue, attendance, and staffing" in payload["content"]
    assert "fitness coaching" in payload["content"]
    assert len(calls) == 2


def test_generate_plan_route_uses_openrouter_plan_model_when_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_PLAN_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_MODEL",
        "openrouter/legacy-assistant-model",
    )
    monkeypatch.setenv(
        "OPENROUTER_INSIGHT_MODEL",
        "nvidia/nemotron-3-super-120b-a12b:free",
    )

    calls: list[dict[str, object]] = []

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        return _openrouter_response(
            {
                "weeks": [
                    {
                        "week_number": 1,
                        "days": [
                            {
                                "day_of_week": 1,
                                "focus_label": "Legs focus",
                                "notes": "Week 1: Keep it efficient and joint-friendly.",
                                "exercises": [
                                    {
                                        "name": "Barbell Back Squat",
                                        "sets": 4,
                                        "reps": 10,
                                        "duration_seconds": None,
                                        "rest_seconds": 90,
                                        "weight_kg_target": None,
                                        "order_index": 0,
                                        "notes": "Prioritize controlled form.",
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
            model="meta-llama/llama-3.3-70b-instruct:free",
            tokens=192,
        )

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    client = TestClient(app)
    response = client.post(
        "/generate-plan",
        json={
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "plan_input": {
                "duration_weeks": 1,
                "days_per_week": 1,
                "preferences": "Keep it efficient and joint-friendly.",
            },
            "allowed_exercises": [
                {
                    "name": "Barbell Back Squat",
                    "muscle_group": "legs",
                    "category": "strength",
                },
                {
                    "name": "Lat Pulldown",
                    "muscle_group": "back",
                    "category": "strength",
                },
                {
                    "name": "Stationary Bike",
                    "muscle_group": "conditioning",
                    "category": "cardio",
                },
            ],
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert len(payload["weeks"]) == 1
    assert len(payload["weeks"][0]["days"]) == 1
    assert payload["weeks"][0]["days"][0]["exercises"][0]["name"] == "Barbell Back Squat"
    assert payload["model_used"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert payload["token_count"] == 192
    assert calls[0]["model"] == "meta-llama/llama-3.3-70b-instruct:free"


def test_generate_plan_route_falls_back_when_openrouter_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class RejectedResponse:
        status_code = 503

        def json(self) -> dict[str, object]:
            return {"error": {"message": "service unavailable"}}

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: RejectedResponse(),
    )

    client = TestClient(app)
    response = client.post(
        "/generate-plan",
        json={
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "plan_input": {
                "duration_weeks": 2,
                "days_per_week": 3,
                "preferences": "Keep it efficient and joint-friendly.",
            },
            "allowed_exercises": [
                {
                    "name": "Barbell Back Squat",
                    "muscle_group": "legs",
                    "category": "strength",
                },
                {
                    "name": "Lat Pulldown",
                    "muscle_group": "back",
                    "category": "strength",
                },
                {
                    "name": "Stationary Bike",
                    "muscle_group": "conditioning",
                    "category": "cardio",
                },
            ],
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert len(payload["weeks"]) == 2
    assert len(payload["weeks"][0]["days"]) == 3
    assert payload["weeks"][0]["days"][0]["exercises"][0]["name"] == "Barbell Back Squat"
    assert payload["model_used"] == "grounded-fallback"


def test_generate_plan_route_rejects_empty_allowed_exercise_catalog() -> None:
    client = TestClient(app)

    response = client.post(
        "/generate-plan",
        json={
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "plan_input": {
                "duration_weeks": 2,
                "days_per_week": 3,
            },
            "allowed_exercises": [],
        },
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "body.allowed_exercises" in payload["detail"]


def test_openrouter_timeout_is_configurable_and_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = OpenRouterAssistantProvider()

    monkeypatch.setenv("OPENROUTER_ASSISTANT_TIMEOUT_SECONDS", "42")
    assert provider._read_request_timeout_seconds() == 42

    monkeypatch.setenv("OPENROUTER_ASSISTANT_TIMEOUT_SECONDS", "500")
    assert provider._read_request_timeout_seconds() == 55

    monkeypatch.setenv("OPENROUTER_ASSISTANT_TIMEOUT_SECONDS", "not-a-number")
    assert provider._read_request_timeout_seconds() == 25


def test_openrouter_request_variants_continue_after_a_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = OpenRouterAssistantProvider()
    settings = OpenRouterAssistantSettings(
        api_key="test-key",
        base_url="https://openrouter.ai/api/v1",
        assistant_model="primary-model",
        assistant_plan_model="primary-model",
        fallback_model="fallback-model",
        http_referer=None,
        app_title=None,
        request_timeout_seconds=25,
    )
    calls: list[str] = []

    def fake_post(*_args, **kwargs):
        model = kwargs["json"]["model"]
        calls.append(model)
        if model == "primary-model":
            raise httpx.ReadTimeout("primary model timed out")
        return _openrouter_response(
            {
                "content": "Fallback completed the request.",
                "action": "NONE",
                "params": None,
            },
            model=model,
            tokens=12,
        )

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    response = provider._run_request_variants(
        settings,
        [{"model": "primary-model"}, {"model": "fallback-model"}],
        request_label="assistant",
    )

    assert response.status_code == 200
    assert calls == ["primary-model", "fallback-model"]
