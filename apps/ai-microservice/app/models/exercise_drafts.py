from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExerciseDraftProposalRequest(StrictModel):
    category: Literal["balance", "cardio", "flexibility", "strength"] | None = None
    description: str | None = Field(default=None, max_length=1000)
    evidence: dict[str, Any] | None = None
    hand_shape_profile: dict[str, Any] | None = None
    instructions: str | None = Field(default=None, max_length=1200)
    movement_profile: dict[str, Any] | None = None
    muscle_group: str | None = Field(default=None, max_length=100)
    muscle_targets: list[dict[str, Any]] | None = None
    pose_session_id: str | None = None
    proposed_name: str | None = Field(default=None, max_length=255)
    summary: str | None = Field(default=None, max_length=500)


class ExerciseDraftProposalResponse(StrictModel):
    category: Literal["balance", "cardio", "flexibility", "strength"]
    confidence: float = Field(ge=0, le=1)
    description: str = Field(min_length=1, max_length=1000)
    evidence: dict[str, Any]
    hand_shape_profile: dict[str, Any]
    instructions: str = Field(min_length=1, max_length=1200)
    movement_profile: dict[str, Any]
    muscle_group: str = Field(min_length=1, max_length=100)
    muscle_targets: list[dict[str, Any]]
    model_used: str | None = None
    proposal_source: Literal["ai"] = "ai"
    proposed_name: str = Field(min_length=1, max_length=255)
    review_warnings: list[str]
    summary: str = Field(min_length=1, max_length=500)
    token_count: int | None = Field(default=None, ge=0)
