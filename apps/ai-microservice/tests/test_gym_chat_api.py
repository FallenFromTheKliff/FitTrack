from __future__ import annotations

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
        "promotions": [
            {
                "title": "Summer Starter Pack",
                "description": "Get two weeks free on annual plans.",
                "promo_code": "SUMMER26",
                "starts_at": "2026-05-01T00:00:00.000Z",
                "ends_at": "2026-05-31T23:59:59.000Z",
                "pricing_note": "Applies to new signups.",
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
                "answer": "Open Bookings, choose a coach, pick an available slot, and submit the request.",
                "keywords": ["book", "booking", "coach", "appointment"],
            },
            {
                "category": "rates",
                "question": "How do downpayments work?",
                "answer": "A downpayment reserves the booking; the remaining balance is settled before completion.",
                "keywords": ["payment", "downpayment", "balance"],
            }
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
                "role": "user",
                "content": "I want to compare your membership plans.",
            }
        ],
        "user_context": {
            "first_name": "Alex",
            "role": "member",
            "active_membership": True,
        },
    }


def test_gym_chat_route_returns_grounded_membership_reply() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-1",
            "message": "What membership plans do you offer right now?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "Alex, Membership option: Monthly Flex at PHP 1999 for 30 days.",
        "out_of_scope": False,
        "sources": ["membership_plans"],
        "follow_up_suggestions": [
            "Ask which membership plan fits your visit frequency."
        ],
        "model_used": None,
        "token_count": None,
    }


def test_gym_chat_route_refuses_out_of_scope_prompts() -> None:
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
    assert response.json() == {
        "reply": (
            "I can only help with gym support topics like hours, bookings, "
            "payments, memberships, coaching, training, promotions, schedules, "
            "and FAQs."
        ),
        "out_of_scope": True,
        "sources": [],
        "follow_up_suggestions": [
            "Ask about gym hours or holiday schedules.",
            "Ask about membership plans or current promotions.",
        ],
        "model_used": None,
        "token_count": None,
    }


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


def test_gym_chat_route_answers_opening_and_closing_hours() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-6",
            "message": "When is SertFit opening and closing time?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["out_of_scope"] is False
    assert payload["sources"] == ["operating_hours"]
    assert "Current gym hours: Monday: 06:00-22:00; Saturday: 08:00-20:00." in payload["reply"]


def test_gym_chat_route_answers_booking_faq() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-7",
            "message": "How do I book a coach appointment?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["out_of_scope"] is False
    assert payload["sources"] == ["faqs"]
    assert "How do I book a coach appointment?" in payload["reply"]


def test_gym_chat_route_answers_payment_faq() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-8",
            "message": "How does the downpayment balance work?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["out_of_scope"] is False
    assert payload["sources"] == ["faqs"]
    assert "How do downpayments work?" in payload["reply"]


def test_gym_chat_route_refuses_member_sensitive_analytics() -> None:
    client = TestClient(app)

    response = client.post(
        "/chat/gym",
        json={
            "session_id": "gym-session-9",
            "message": "What are the total sales and attendance this month?",
            "grounding": _build_grounding_payload(),
            "policy": {"gym_only": True, "refuse_out_of_scope": True},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["out_of_scope"] is True
    assert payload["sources"] == []
    assert "private business analytics" in payload["reply"]
