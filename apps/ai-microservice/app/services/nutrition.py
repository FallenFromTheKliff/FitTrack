from __future__ import annotations

from ..models.nutrition import CalculateTdeeRequest, CalculateTdeeResponse


class NutritionService:
    _ACTIVITY_MULTIPLIERS = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }

    _GOAL_CALORIE_ADJUSTMENTS = {
        "bulking": 300,
        "cutting": -500,
        "maintenance": 0,
        "sport_specific": 150,
    }

    _PROTEIN_PER_KG = {
        "bulking": 2.0,
        "cutting": 2.2,
        "maintenance": 1.8,
        "sport_specific": 2.0,
    }

    _FAT_RATIO = {
        "bulking": 0.25,
        "cutting": 0.25,
        "maintenance": 0.25,
        "sport_specific": 0.27,
    }

    def calculate_tdee(self, payload: CalculateTdeeRequest) -> CalculateTdeeResponse:
        bmr = self._calculate_bmr(payload)
        tdee = bmr * self._ACTIVITY_MULTIPLIERS[payload.activity_level]
        target_calories = max(1200, round(tdee + self._GOAL_CALORIE_ADJUSTMENTS[payload.fitness_goal]))
        protein_g = max(0, round(payload.weight_kg * self._PROTEIN_PER_KG[payload.fitness_goal]))
        fat_g = max(0, round((target_calories * self._FAT_RATIO[payload.fitness_goal]) / 9))
        carbs_g = max(0, round((target_calories - (protein_g * 4) - (fat_g * 9)) / 4))

        return CalculateTdeeResponse(
            bmr=round(bmr, 2),
            tdee=round(tdee, 2),
            target_calories=target_calories,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
        )

    def _calculate_bmr(self, payload: CalculateTdeeRequest) -> float:
        base = (10 * payload.weight_kg) + (6.25 * payload.height_cm) - (5 * payload.age)

        if payload.gender == "male":
            return base + 5
        if payload.gender == "female":
            return base - 161

        return base - 78
