from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


def _build_grounding_payload() -> dict[str, object]:
    return {
        "operating_hours": [
            {
                "day_of_week": 1,
                "opens_at": "06:00",
                "closes_at": "22:00",
                "is_closed": False,
                "label": "Weekday hours",
            },
            {
                "day_of_week": 6,
                "opens_at": "08:00",
                "closes_at": "20:00",
                "is_closed": False,
                "label": "Saturday hours",
            }
        ],
        "special_schedules": [
            {
                "starts_on": "2026-12-24",
                "ends_on": "2026-12-25",
                "opens_at": "08:00",
                "closes_at": "18:00",
                "is_closed": False,
                "reason": "Christmas schedule",
                "pricing_note": "Holiday passes remain valid.",
            }
        ],
        "faqs": [
            {
                "category": "membership",
                "question": "Do you offer walk-in rates?",
                "answer": "Yes, day passes are available at the front desk.",
                "keywords": ["walk-in", "day pass"],
            },
            {
                "category": "general",
                "question": "How do I book a coach appointment?",
                "answer": "Open Bookings, choose a coach, select an available slot, and complete full payment.",
                "keywords": ["book", "booking", "coach", "appointment"],
            },
            {
                "category": "rates",
                "question": "How do online payments work?",
                "answer": "Pay the full amount through PayMongo to confirm an online booking.",
                "keywords": ["payment", "PayMongo", "booking"],
            },
            {
                "category": "general",
                "question": "Gym name",
                "answer": "SERTFIT Gym",
                "keywords": ["gym", "name"],
            },
            {
                "category": "general",
                "question": "Gym address",
                "answer": "Pasay City, Metro Manila, Philippines",
                "keywords": ["gym", "address", "location"],
            },
            {
                "category": "general",
                "question": "Gym phone",
                "answer": "+639281234567",
                "keywords": ["gym", "phone", "contact"],
            },
            {
                "category": "general",
                "question": "Gym email",
                "answer": "contact@sertfit.com",
                "keywords": ["gym", "email", "contact"],
            },
            {
                "category": "general",
                "question": "Gym opening time",
                "answer": "06:00",
                "keywords": ["gym", "hours", "opening"],
            },
            {
                "category": "general",
                "question": "Gym closing time",
                "answer": "22:00",
                "keywords": ["gym", "hours", "closing"],
            },
        ],
        "membership_plans": [
            {
                "name": "Monthly Flex",
                "price": "PHP 1999",
                "duration_days": 30,
                "description": "Month-to-month access.",
            }
        ],
        "session_history": [
            {
                "role": "user" if index % 2 == 0 else "assistant",
                "content": f"Turn {index + 1}.",
            }
            for index in range(14)
        ],
        "user_context": {
            "first_name": "Alex",
            "role": "member",
            "active_membership": True,
        },
    }


class _FakeResponse:
    def __init__(self, payload: dict[str, object], status_code: int = 200) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict[str, object]:
        return self._payload


def _openrouter_response(
    draft: dict[str, object],
    *,
    model: str = "primary-model",
    tokens: int = 41,
    status_code: int = 200,
) -> _FakeResponse:
    return _FakeResponse(
        {
            "model": model,
            "usage": {"total_tokens": tokens},
            "choices": [{"message": {"content": json.dumps(draft)}}],
        },
        status_code=status_code,
    )


def _configure_openrouter(
    monkeypatch: pytest.MonkeyPatch,
    calls: list[dict[str, object]],
    responses: list[_FakeResponse],
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_ASSISTANT_CHAT_MODEL", "primary-model")
    monkeypatch.setenv("OPENROUTER_FREE_MODEL_FALLBACK", "openrouter/free")

    def fake_post(*_args: object, **kwargs: object) -> _FakeResponse:
        request_payload = kwargs["json"]
        assert isinstance(request_payload, dict)
        calls.append(request_payload)
        return responses[min(len(calls) - 1, len(responses) - 1)]

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)


def test_gym_chat_route_calls_openrouter_with_structured_public_grounding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _configure_openrouter(
        monkeypatch,
        calls,
        [
            _openrouter_response(
                {
                    "reply": "The model confirms the gym opens at 06:00 and closes at 22:00.",
                    "out_of_scope": False,
                    "sources": ["gym_profile", "operating_hours"],
                    "follow_up_suggestions": ["Ask about today's gym hours."],
                }
            )
        ],
    )
    grounding = _build_grounding_payload()
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-1",
            "message": "When do you open today?",
            "grounding": grounding,
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "The model confirms the gym opens at 06:00 and closes at 22:00.",
        "out_of_scope": False,
        "sources": ["gym_profile", "operating_hours"],
        "follow_up_suggestions": ["Ask about today's gym hours."],
        "model_used": "primary-model",
        "token_count": 41,
    }

    assert len(calls) == 1
    request_payload = calls[0]
    assert request_payload["models"] == ["primary-model", "openrouter/free"]
    assert "model" not in request_payload
    assert request_payload["provider"] == {
        "require_parameters": True,
        "allow_fallbacks": True,
    }
    system_prompt = request_payload["messages"][0]["content"]
    assert "strict JSON" in system_prompt
    assert "authoritative source" in system_prompt
    assert "recent_turns" in system_prompt

    provider_input = json.loads(request_payload["messages"][1]["content"])
    assert provider_input["current_message"] == "When do you open today?"
    assert provider_input["gym_identity"] == {
        "name": "SERTFIT Gym",
        "address": "Pasay City, Metro Manila, Philippines",
        "opening_time": "06:00",
        "closing_time": "22:00",
        "contact": {
            "phone": "+639281234567",
            "email": "contact@sertfit.com",
        },
    }
    assert provider_input["operating_hours"] == grounding["operating_hours"]
    assert provider_input["special_schedules"] == grounding["special_schedules"]
    assert provider_input["membership_plans"] == grounding["membership_plans"]
    assert provider_input["faqs"] == grounding["faqs"]
    assert provider_input["recent_turns"] == grounding["session_history"][-12:]
    assert "user_context" not in provider_input
    assert "session_history" not in provider_input


def test_gym_chat_route_keeps_a_single_free_router_lane_when_fallback_matches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _configure_openrouter(
        monkeypatch,
        calls,
        [
            _openrouter_response(
                {
                    "reply": "The free router answered from the supplied gym identity.",
                    "out_of_scope": False,
                    "sources": ["gym_identity"],
                    "follow_up_suggestions": [],
                },
                model="openrouter/free",
            )
        ],
    )
    monkeypatch.setenv("OPENROUTER_ASSISTANT_CHAT_MODEL", "openrouter/free")

    response = TestClient(app).post(
        "/chat/gym",
        json={
            "session_id": "gym-session-free-router",
            "message": "What is the gym address?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    assert len(calls) == 1
    assert calls[0]["model"] == "openrouter/free"
    assert "models" not in calls[0]


def test_gym_chat_route_asks_provider_to_refuse_out_of_scope_prompts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _configure_openrouter(
        monkeypatch,
        calls,
        [
            _openrouter_response(
                {
                    "reply": "I can help with gym support questions only.",
                    "out_of_scope": True,
                    "sources": [],
                    "follow_up_suggestions": ["Ask about gym hours."],
                }
            )
        ],
    )
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-2",
            "message": "Can you help me pick stocks for my portfolio?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    assert response.json()["reply"] == "I can help with gym support questions only."
    assert response.json()["out_of_scope"] is True
    assert response.json()["model_used"] == "primary-model"
    assert len(calls) == 1
    provider_input = json.loads(calls[0]["messages"][1]["content"])
    assert provider_input["current_message"] == "Can you help me pick stocks for my portfolio?"


def test_gym_chat_route_returns_422_for_invalid_policy_payload() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-3",
            "message": "What are your hours today?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": False, "refuse_out_of_scope": True},
        },
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "body.policy.gym_only" in payload["detail"]


def test_gym_chat_route_returns_422_for_invalid_session_history_role() -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    payload["session_history"] = [
        {
            "role": "system",
            "content": "This should fail strict session history validation.",
        }
    ]

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-4",
            "message": "What are your hours today?",
            "grounding": payload,
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    error_payload = response.json()

    assert response.status_code == 422
    assert error_payload["type"] == "INVALID_REQUEST"
    assert error_payload["title"] == "Invalid Request"
    assert error_payload["status"] == 422
    assert "body.grounding.session_history.0.role" in error_payload["detail"]


def test_gym_chat_route_returns_422_for_nested_extra_fields() -> None:
    client = TestClient(app)
    payload = _build_grounding_payload()
    payload["session_history"][0]["unexpected"] = "not allowed"

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-5",
            "message": "What are your hours today?",
            "grounding": payload,
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    error_payload = response.json()

    assert response.status_code == 422
    assert error_payload["type"] == "INVALID_REQUEST"
    assert error_payload["title"] == "Invalid Request"
    assert error_payload["status"] == 422
    assert "body.grounding.session_history.0.unexpected" in error_payload["detail"]
    assert "Extra inputs are not permitted" in error_payload["detail"]


def test_gym_chat_route_uses_openrouter_model_fallback_routing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _configure_openrouter(
        monkeypatch,
        calls,
        [
            _openrouter_response(
                {"error": {"message": "primary rate limited"}},
                status_code=503,
            ),
            _openrouter_response(
                {"error": {"message": "structured output unavailable"}},
                status_code=503,
            ),
            _openrouter_response(
                {
                    "reply": "The fallback model answered from the supplied gym identity.",
                    "out_of_scope": False,
                    "sources": ["gym_identity"],
                    "follow_up_suggestions": [],
                },
                model="openrouter/free",
                tokens=55,
            ),
        ],
    )

    response = TestClient(app).post(
        "/chat/gym",
        json={
            "session_id": "gym-session-6",
            "message": "What is the gym address?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    assert response.json()["model_used"] == "openrouter/free"
    assert response.json()["token_count"] == 55
    assert len(calls) == 3
    assert calls[0]["models"] == ["primary-model", "openrouter/free"]
    assert calls[1]["models"] == ["primary-model", "openrouter/free"]
    assert calls[2]["models"] == ["primary-model", "openrouter/free"]
    assert "model" not in calls[0]
    assert "response_format" not in calls[2]


def test_gym_chat_route_rejects_a_malformed_provider_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _configure_openrouter(
        monkeypatch,
        calls,
        [
            _openrouter_response(
                {
                    "reply": "Missing required contract fields.",
                    "out_of_scope": False,
                }
            )
        ],
    )

    response = TestClient(app).post(
        "/chat/gym",
        json={
            "session_id": "gym-session-7",
            "message": "What are today's gym hours?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 502
    assert response.json()["type"] == "BAD_GATEWAY"
    assert "Brodigy contract" in response.json()["detail"]


def test_gym_chat_route_returns_provider_configuration_error_without_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "OPENROUTER_ASSISTANT_MODEL",
        "OPENROUTER_INSIGHT_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)

    response = TestClient(app).post(
        "/chat/gym",
        json={
            "session_id": "gym-session-8",
            "message": "What is the gym address?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 503
    assert response.json()["type"] == "SERVICE_UNAVAILABLE"
    assert "not configured" in response.json()["detail"]
