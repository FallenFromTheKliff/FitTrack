from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CalculateTdeeRequest(StrictModel):
    age: int = Field(ge=1, le=120)
    gender: Literal["male", "female", "other"]
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    activity_level: Literal["sedentary", "light", "moderate", "active", "very_active"]
    fitness_goal: Literal["bulking", "cutting", "maintenance", "sport_specific"]


class CalculateTdeeResponse(StrictModel):
    bmr: float = Field(gt=0)
    tdee: float = Field(gt=0)
    target_calories: int = Field(gt=0)
    protein_g: int = Field(ge=0)
    carbs_g: int = Field(ge=0)
    fat_g: int = Field(ge=0)
