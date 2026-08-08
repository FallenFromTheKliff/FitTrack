from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AssistantChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class AssistantChatUserContext(StrictModel):
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    activity_level: str | None = None
    fitness_goal: str | None = None


class AssistantChatSessionContext(StrictModel):
    session_id: str = Field(min_length=1)
    context_type: str = Field(min_length=1)
    # Older direct callers may still send the legacy scope labels. The
    # authenticated Nest path sends "all" after enforcing role/action access.
    assistant_scope: Literal["all", "admin_business", "member_fitness"] = "member_fitness"
    allowed_actions: list[
        Literal["ADJUST_TDEE", "GENERATE_PLAN", "LOG_NUTRITION", "NONE"]
    ] = Field(default_factory=lambda: ["NONE"])


class AssistantChatRequest(StrictModel):
    messages: list[AssistantChatMessage] = Field(min_length=1)
    user_context: AssistantChatUserContext
    session_context: AssistantChatSessionContext


class AssistantChatResponse(StrictModel):
    content: str = Field(min_length=1)
    action: Literal["ADJUST_TDEE", "GENERATE_PLAN", "LOG_NUTRITION", "NONE"]
    params: dict[str, Any] | None = None
    model_used: str | None = None
    token_count: int | None = Field(default=None, ge=0)


class AssistantPlanUserContext(StrictModel):
    age: int = Field(ge=1, le=120)
    gender: str = Field(min_length=1)
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    activity_level: str = Field(min_length=1)
    fitness_goal: str = Field(min_length=1)


class AssistantPlanInput(StrictModel):
    duration_weeks: int = Field(ge=1, le=52)
    days_per_week: int = Field(ge=1, le=7)
    preferences: str | None = Field(default=None, max_length=500)


class AllowedExerciseItem(StrictModel):
    name: str = Field(min_length=1)
    muscle_group: str = Field(min_length=1)
    category: Literal["strength", "cardio", "flexibility", "balance"]


class AssistantPlanRequest(StrictModel):
    user_context: AssistantPlanUserContext
    plan_input: AssistantPlanInput
    allowed_exercises: list[AllowedExerciseItem] = Field(min_length=1)


class AssistantPlanExercise(StrictModel):
    name: str = Field(min_length=1)
    sets: int = Field(ge=1, le=8)
    reps: int | None = Field(default=None, ge=1, le=100)
    duration_seconds: int | None = Field(default=None, ge=1)
    rest_seconds: int | None = Field(default=None, ge=0)
    weight_kg_target: float | None = Field(default=None, ge=0)
    order_index: int | None = Field(default=None, ge=0)
    notes: str | None = None


class AssistantPlanDay(StrictModel):
    day_of_week: int = Field(ge=0, le=6)
    focus_label: str | None = None
    notes: str | None = None
    exercises: list[AssistantPlanExercise] = Field(min_length=1)


class AssistantPlanWeek(StrictModel):
    week_number: int = Field(ge=1)
    days: list[AssistantPlanDay] = Field(min_length=1)


class AssistantPlanResponse(StrictModel):
    weeks: list[AssistantPlanWeek] = Field(min_length=1)
    model_used: str | None = None
    token_count: int | None = Field(default=None, ge=0)
