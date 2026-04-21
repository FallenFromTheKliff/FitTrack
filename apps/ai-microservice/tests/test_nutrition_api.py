from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_calculate_tdee_route_returns_macro_targets() -> None:
    client = TestClient(app)

    response = client.post(
        "/calculate-tdee",
        json={
            "age": 30,
            "gender": "male",
            "weight_kg": 82,
            "height_cm": 178,
            "activity_level": "moderate",
            "fitness_goal": "cutting",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "bmr": 1802.5,
        "tdee": 2793.88,
        "target_calories": 2294,
        "protein_g": 180,
        "carbs_g": 219,
        "fat_g": 64,
    }


def test_calculate_tdee_route_rejects_invalid_activity_level() -> None:
    client = TestClient(app)

    response = client.post(
        "/calculate-tdee",
        json={
            "age": 30,
            "gender": "male",
            "weight_kg": 82,
            "height_cm": 178,
            "activity_level": "weekend-warrior",
            "fitness_goal": "cutting",
        },
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "body.activity_level" in payload["detail"]
