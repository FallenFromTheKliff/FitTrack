from __future__ import annotations

import json
import ssl

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
        assert isinstance(kwargs["verify"], ssl.SSLContext)
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
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
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
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
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


@pytest.mark.parametrize(
    (
        "provider_content",
        "allowed_actions",
        "expected_content",
        "expected_action",
        "expected_params",
    ),
    [
        (
            {
                "response": "Lunch logged.\\nReview the portions before saving.",
                "action": "LOG_NUTRITION",
                "params": {"meal_type": "lunch"},
                "provider_metadata": {"request_id": "hidden"},
            },
            ["LOG_NUTRITION", "NONE"],
            "Lunch logged.\nReview the portions before saving.",
            "LOG_NUTRITION",
            {"meal_type": "lunch"},
        ),
        (
            json.dumps(
                {
                    "reply": "**Recovery**\n\n- Sleep consistently\n- Keep one easy day",
                    "action_triggered": "NONE",
                    "action_result": None,
                    "model_used": "provider-wrapper-model",
                }
            ),
            ["NONE"],
            "**Recovery**\n\n- Sleep consistently\n- Keep one easy day",
            "NONE",
            None,
        ),
        (
            json.dumps(
                json.dumps(
                    {
                        "response": "Line one\\nLine two",
                        "action": "NONE",
                        "params": None,
                    }
                )
            ),
            ["NONE"],
            "Line one\nLine two",
            "NONE",
            None,
        ),
        (
            "**Today**\n\n- Squat with control\n- Stop if form breaks down",
            ["NONE"],
            "**Today**\n\n- Squat with control\n- Stop if form breaks down",
            "NONE",
            None,
        ),
    ],
)
def test_chat_route_normalizes_supported_provider_output_shapes(
    monkeypatch: pytest.MonkeyPatch,
    provider_content: object,
    allowed_actions: list[str],
    expected_content: str,
    expected_action: str,
    expected_params: dict[str, object] | None,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class ProviderResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "usage": {"total_tokens": 44},
                "choices": [{"message": {"content": provider_content}}],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: ProviderResponse(),
    )

    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Help with today's plan."}],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": "assistant-session-normalized-output",
                "context_type": "general",
                "allowed_actions": allowed_actions,
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["content"] == expected_content
    assert payload["action"] == expected_action
    assert payload["params"] == expected_params
    assert "provider_metadata" not in payload["content"]
    assert '"action"' not in payload["content"]
    assert '"params"' not in payload["content"]


@pytest.mark.parametrize(
    "provider_message",
    [
        {
            "content": {
                "action": "NONE",
                "params": None,
                "provider_metadata": {"request_id": "hidden"},
            }
        },
        {
            "content": json.dumps(
                {
                    "response": {
                        "reply": {
                            "content": {
                                "action": "NONE",
                                "params": None,
                            }
                        }
                    },
                    "provider_metadata": {"request_id": "hidden"},
                }
            )
        },
        {
            "content": [
                {
                    "type": "reasoning",
                    "provider_metadata": {"request_id": "hidden"},
                }
            ]
        },
    ],
)
def test_chat_route_uses_friendly_fallback_for_success_without_human_text(
    monkeypatch: pytest.MonkeyPatch,
    provider_message: dict[str, object],
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class MalformedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "choices": [
                    {
                        "message": provider_message,
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: MalformedResponse(),
    )

    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Give me one workout tip."}],
            "user_context": {},
            "session_context": {
                "session_id": "assistant-session-malformed-output",
                "context_type": "general",
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["model_used"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert payload["content"] == "I couldn't format that response cleanly. Please try again."
    assert "OpenRouter" not in payload["content"]
    assert "provider_metadata" not in payload["content"]
    assert '"action"' not in payload["content"]
    assert '"params"' not in payload["content"]


def test_chat_route_extracts_nested_content_block_text_and_action(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )

    class NestedResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": json.dumps(
                                        {
                                            "response": {
                                                "reply": {
                                                    "content": "Keep the next set controlled.\\nStop before form breaks down."
                                                }
                                            },
                                            "action": "LOG_NUTRITION",
                                            "params": {"meal_type": "lunch"},
                                        }
                                    ),
                                }
                            ],
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: NestedResponse(),
    )

    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Log lunch and give one tip."}],
            "user_context": {},
            "session_context": {
                "session_id": "assistant-session-nested-live-shape",
                "context_type": "nutrition",
                "allowed_actions": ["LOG_NUTRITION", "NONE"],
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["content"] == (
        "Keep the next set controlled.\nStop before form breaks down."
    )
    assert payload["action"] == "LOG_NUTRITION"
    assert payload["params"] == {"meal_type": "lunch"}
    assert '"action"' not in payload["content"]
    assert '"params"' not in payload["content"]


@pytest.mark.parametrize(
    "provider_content",
    [
        (
            'We need to infer intent: user says "hey bro explain cardio". '
            "Action policy: allowed actions are ADJUST_TDEE, GENERATE_PLAN, "
            "LOG_NUTRITION, NONE. The instruction says return strict JSON only, "
            "so we need to output JSON with action and params."
        ),
        {
            "content": (
                'We need to infer intent: user says "hey bro explain cardio". '
                "Action policy lists the allowed actions. Return strict JSON only."
            ),
            "action": "NONE",
            "params": None,
        },
    ],
)
def test_chat_route_never_exposes_provider_internal_reasoning(
    monkeypatch: pytest.MonkeyPatch,
    provider_content: object,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    calls: list[dict[str, object]] = []

    class ReasoningLeakResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "choices": [{"message": {"content": provider_content}}],
            }

    def fake_post(*args, **kwargs):
        calls.append(kwargs["json"])
        return ReasoningLeakResponse()

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Explain cardio."}],
            "user_context": {},
            "session_context": {
                "session_id": "assistant-session-reasoning-leak",
                "context_type": "general",
                "allowed_actions": ["NONE"],
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["content"] == (
        "I couldn't format that response cleanly. Please try again."
    )
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert "infer intent" not in payload["content"].lower()
    assert calls[0]["reasoning"] == {"exclude": True}


def test_chat_route_keeps_legitimate_plain_text_that_mentions_we_need_to(
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
                "choices": [
                    {
                        "message": {
                            "content": (
                                "We need to warm up gradually before hard cardio "
                                "intervals."
                            )
                        }
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.assistant.httpx.post",
        lambda *args, **kwargs: PlainTextResponse(),
    )

    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "How should I start cardio?"}
            ],
            "user_context": {},
            "session_context": {
                "session_id": "assistant-session-valid-plain-text",
                "context_type": "general",
                "allowed_actions": ["NONE"],
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["content"] == (
        "We need to warm up gradually before hard cardio intervals."
    )
    assert payload["action"] == "NONE"
    assert payload["params"] is None


@pytest.mark.parametrize("role", ["ADMIN", "COACH", "STAFF", "MEMBER"])
@pytest.mark.parametrize(
    ("message", "expected_mode"),
    [
        ("hello", "answer"),
        ("Can you explain macros for a cutting phase?", "answer"),
        ("How do I cut while keeping my strength?", "answer"),
        ("Where is SERTFIT and what are today's hours?", "answer"),
        ("Can you explain that?", "clarify"),
        ("What is photosynthesis?", "refuse"),
        ("How do I reverse-sort a Python array?", "refuse"),
    ],
)
def test_chat_route_uses_one_shared_semantic_policy_for_every_role_and_example(
    monkeypatch: pytest.MonkeyPatch,
    role: str,
    message: str,
    expected_mode: str,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv(
        "OPENROUTER_ASSISTANT_CHAT_MODEL",
        "meta-llama/llama-3.3-70b-instruct:free",
    )
    calls: list[dict[str, object]] = []

    def fake_post(*args, **kwargs):
        request_payload = kwargs["json"]
        calls.append(request_payload)
        provider_input = json.loads(request_payload["messages"][1]["content"])
        current_message = provider_input["messages"][-1]["content"]
        if current_message == "Can you explain that?":
            content = "Could you clarify whether you mean the exercise, nutrition, or gym question?"
        elif current_message in {
            "What is photosynthesis?",
            "How do I reverse-sort a Python array?",
        }:
            content = "I can help with fitness, nutrition, recovery, gym information, app help, or authorized gym operations."
        else:
            content = f"BrodigyAI can help with this FitTrack question: {current_message}"
        return _openrouter_response(
            {"content": content, "action": "NONE", "params": None},
            model="meta-llama/llama-3.3-70b-instruct:free",
            tokens=61,
        )

    monkeypatch.setattr("app.services.assistant.httpx.post", fake_post)

    allowed_actions = (
        ["ADJUST_TDEE", "GENERATE_PLAN", "LOG_NUTRITION", "NONE"]
        if role == "MEMBER"
        else ["NONE"]
    )
    response = TestClient(app).post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": message}],
            "user_context": {
                "age": 29,
                "gender": "female",
                "weight_kg": 62,
                "height_cm": 165,
                "activity_level": "moderate",
                "fitness_goal": "cutting",
            },
            "session_context": {
                "session_id": f"semantic-{role.lower()}",
                "context_type": "general",
                "assistant_scope": "all",
                "allowed_actions": allowed_actions,
            },
        },
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["action"] == "NONE"
    assert payload["params"] is None
    assert len(calls) == 1

    system_prompt = calls[0]["messages"][0]["content"]
    assert "Shared capability policy for every eligible Brodigy role" in system_prompt
    assert "macros and nutrition education" in system_prompt
    assert "photosynthesis" in system_prompt
    assert "reverse" in system_prompt
    assert "admin business operations assistant" not in system_prompt
    assert "in-app fitness and nutrition assistant" not in system_prompt

    provider_input = json.loads(calls[0]["messages"][1]["content"])
    assert provider_input["messages"][-1]["content"] == message
    assert len(provider_input["messages"]) <= 4
    assert provider_input["session_context"] == {"context_type": "general"}
    assert provider_input["action_policy"]["allowed_actions"] == allowed_actions
    assert "session_id" not in provider_input["session_context"]
    assert "assistant_scope" not in provider_input["session_context"]

    if expected_mode == "clarify":
        assert "clarify" in payload["content"].lower()
    elif expected_mode == "refuse":
        assert message not in payload["content"]
        assert "python array" not in payload["content"].lower()
        assert "photosynthesis" not in payload["content"].lower()


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

    monkeypatch.setenv("OPENROUTER_ASSISTANT_TIMEOUT_SECONDS", "NaN")
    assert provider._read_request_timeout_seconds() == 25

    monkeypatch.setenv("OPENROUTER_ASSISTANT_TIMEOUT_SECONDS", "Infinity")
    assert provider._read_request_timeout_seconds() == 25


def test_openrouter_ssl_context_ignores_optional_keylog_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SSLKEYLOGFILE", r"\\.\unavailable\keylog.txt")

    context = OpenRouterAssistantProvider()._build_ssl_context()

    assert isinstance(context, ssl.SSLContext)
    assert context.check_hostname is True
    assert context.verify_mode == ssl.CERT_REQUIRED


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
