from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HealthResponse(StrictModel):
    status: Literal["ok"]


class CandidateProfileInput(StrictModel):
    id: str = Field(min_length=1)
    canonical_name: str = Field(min_length=1, max_length=100)
    profile_kind: Literal["seed", "learned"]
    landmark_signature: dict[str, object]
    angle_signature: dict[str, object]
    rep_rules: dict[str, object] | None = None


class PoseBootstrapRequest(StrictModel):
    pose_session_id: str = Field(min_length=1)
    exercise_hint: str | None = None
    starter_catalog: list[str]
    candidate_profiles: list[CandidateProfileInput]


class PoseBootstrapResponse(StrictModel):
    status: Literal["ready"]
    accepted_fps: int = Field(gt=0)
    subject_lock_mode: Literal["single_subject"]


class PoseAnalyzeRequest(StrictModel):
    pose_session_id: str = Field(min_length=1)
    frame_b64: str = Field(min_length=1)


class PoseAnalyzeResponse(StrictModel):
    rep_event: bool
    rep_count_delta: int = Field(ge=0)
    confidence: float = Field(ge=0.0, le=1.0)
    exercise_class: str = Field(min_length=1)
    matched_profile_id: str | None = None
    subject_locked: bool
    subject_lock_confidence: float = Field(ge=0.0, le=1.0)
    phase: str | None = None
    form_feedback: list[str]


class PoseFinalizeRequest(StrictModel):
    pose_session_id: str = Field(min_length=1)


class PoseAnalysisSummary(StrictModel):
    reps_detected: int = Field(ge=0)
    form_feedback: list[str]
    average_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    dominant_joint_angles: dict[str, float]


class LearnedProfile(StrictModel):
    canonical_name: str = Field(min_length=1, max_length=100)
    landmark_signature: dict[str, object]
    angle_signature: dict[str, object]
    rep_rules: dict[str, object] | None = None


class PoseFinalizeResponse(StrictModel):
    detected_exercise_name: str | None = None
    matched_profile_id: str | None = None
    classification_confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )
    subject_lock_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    analysis_summary: PoseAnalysisSummary
    learned_profile: LearnedProfile | None = None
