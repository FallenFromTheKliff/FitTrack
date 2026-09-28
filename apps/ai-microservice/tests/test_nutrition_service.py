from __future__ import annotations

from app.models.nutrition import CalculateTdeeRequest
from app.services.nutrition import NutritionService


def test_calculate_tdee_returns_stable_target_profile() -> None:
    service = NutritionService()

    result = service.calculate_tdee(
        CalculateTdeeRequest(
            age=28,
            gender="female",
            weight_kg=62,
            height_cm=165,
            activity_level="active",
            fitness_goal="maintenance",
        )
    )

    assert result.bmr == 1330.25
    assert result.tdee == 2294.68
    assert result.target_calories == 2295
    assert result.protein_g == 112
    assert result.carbs_g == 320
    assert result.fat_g == 64


def test_calculate_tdee_clamps_low_cutting_targets() -> None:
    service = NutritionService()

    result = service.calculate_tdee(
        CalculateTdeeRequest(
            age=55,
            gender="female",
            weight_kg=45,
            height_cm=150,
            activity_level="sedentary",
            fitness_goal="cutting",
        )
    )

    assert result.target_calories == 1200
    assert result.protein_g == 99
    assert result.carbs_g >= 0
