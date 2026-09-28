from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    orientation_signature: dict[str, object] = Field(default_factory=dict)
    movement_pattern: dict[str, object] = Field(default_factory=dict)
    visibility_pattern: dict[str, object] = Field(default_factory=dict)
    dominant_joint: Literal["elbow", "shoulder", "hip", "knee", "ankle"] | None = None
    tolerance: float | None = None
    rep_thresholds: dict[str, object] | None = None
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


class PoseKeypoint(StrictModel):
    x: float
    y: float
    z: float
    visibility: float = Field(ge=0.0, le=1.0)


class PoseSequenceFrame(StrictModel):
    captured_at_ms: int
    keypoints: list[PoseKeypoint] = Field(min_length=33, max_length=33)


class PoseAngleSignalEntry(StrictModel):
    captured_at_ms: int
    elbow: float | None = None
    shoulder: float | None = None
    hip: float | None = None
    knee: float | None = None
    ankle: float | None = None
    left_elbow: float | None = None
    right_elbow: float | None = None
    left_shoulder: float | None = None
    right_shoulder: float | None = None
    left_hip: float | None = None
    right_hip: float | None = None
    left_knee: float | None = None
    right_knee: float | None = None
    left_ankle: float | None = None
    right_ankle: float | None = None


class PoseOrientationVector(StrictModel):
    x: float
    y: float


class PoseOrientationSignal(StrictModel):
    body_orientation: str
    torso_slope_deg: float
    vector: PoseOrientationVector


class PoseVisibilitySignal(StrictModel):
    average_visibility: float
    feet_visibility: float
    low_confidence_landmarks: list[str] = Field(default_factory=list)
    reliable_frame_count: int
    wrist_visibility: float
    left_arm_visibility: float | None = None
    right_arm_visibility: float | None = None


class PoseHipSignal(StrictModel):
    average_y: float
    range_y: float
    range_x: float | None = None
    stable: bool


class PoseTemporalSignal(StrictModel):
    amplitudes: dict[str, float] = Field(default_factory=dict)
    oscillating_joints: list[str] = Field(default_factory=list)
    phase_sync_ms: int | None = None


class PoseDerivedSignals(StrictModel):
    angles: list[PoseAngleSignalEntry] = Field(default_factory=list)
    orientation: PoseOrientationSignal
    visibility: PoseVisibilitySignal
    hip: PoseHipSignal
    temporal: PoseTemporalSignal


class PoseRepThreshold(StrictModel):
    angle: float
    tolerance: float


class PoseRepThresholdPair(StrictModel):
    down: PoseRepThreshold
    up: PoseRepThreshold


class PoseSpatialRequirements(StrictModel):
    body_y_travel_min: float | None = None
    hip_y_travel_min: float | None = None
    shoulder_y_travel_min: float | None = None
    shoulder_hip_travel_min: float | None = None
    body_x_drift_max: float | None = None
    wrist_anchor_drift_max: float | None = None
    torso_slope_min_deg: float | None = None
    torso_slope_max_deg: float | None = None
    body_line_tolerance: float | None = None
    left_right_symmetry_tolerance: float | None = None
    phase_sync_tolerance_ms: int | None = None


class PoseMovementContract(StrictModel):
    exercise: str = Field(min_length=1)
    dominant_joint: Literal["elbow", "shoulder", "hip", "knee", "ankle"]
    rep_thresholds: PoseRepThresholdPair
    secondary_check: str = Field(min_length=1)
    oscillating_joints: list[str] = Field(default_factory=list)
    rep_model: Literal[
        "bilateral",
        "unilateral_left",
        "unilateral_right",
        "alternating",
        "static_hold",
        "unknown",
    ] = "unknown"
    required_sides: Literal["both", "left", "right", "either", "alternating"] | None = None
    primary_joints: list[str] = Field(default_factory=list)
    secondary_joints: list[str] = Field(default_factory=list)
    phase_order: list[str] = Field(default_factory=list)
    spatial_requirements: PoseSpatialRequirements | None = None
    no_count_conditions: list[str] = Field(default_factory=list)
    degraded_conditions: list[str] = Field(default_factory=list)


class PoseAnalyzeRequest(StrictModel):
    pose_session_id: str = Field(min_length=1)
    frame_b64: str | None = None
    landmark_schema: Literal["mediapipe_pose_v1"] | None = None
    exercise_hint: str | None = None
    camera_facing_mode: Literal["user", "environment"] | None = None
    frames: list[PoseSequenceFrame] | None = Field(default=None, min_length=12, max_length=20)
    signals: PoseDerivedSignals | None = None

    @model_validator(mode="after")
    def validate_transport(self) -> "PoseAnalyzeRequest":
        has_frame = isinstance(self.frame_b64, str) and len(self.frame_b64.strip()) > 0
        has_sequence = self.frames is not None
        if not has_frame and not has_sequence:
            raise ValueError("either frame_b64 or frames must be provided")
        if has_sequence and self.landmark_schema != "mediapipe_pose_v1":
            raise ValueError("landmark_schema must be mediapipe_pose_v1 when frames are provided")
        if has_sequence and self.signals is None:
            raise ValueError("signals must be provided when frames are provided")
        return self


class PoseAnalyzeResponse(StrictModel):
    confidence: float = Field(ge=0.0, le=1.0)
    exercise_class: str | None = None
    matched_profile_id: str | None = None
    movement_contract: PoseMovementContract | None = None
    subject_locked: bool
    subject_lock_confidence: float = Field(ge=0.0, le=1.0)
    classification_source: Literal["preset", "classifier", "user_confirmed"] = "classifier"
    needs_confirmation: bool = False
    processing_mode: Literal["legacy_frame", "sequence"] = "sequence"
    rep_event: bool = False
    rep_count_delta: int = Field(default=0, ge=0)
    rep_count_total: int = Field(default=0, ge=0)
    phase: str | None = None
    keypoints: list[PoseKeypoint] | None = Field(default=None, min_length=33, max_length=33)
    candidate_exercises: list[str] = Field(default_factory=list)
    form_feedback: list[str] = Field(default_factory=list)
    learned_profile: LearnedProfile | None = None


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
    orientation_signature: dict[str, object]
    movement_pattern: dict[str, object]
    visibility_pattern: dict[str, object]
    dominant_joint: Literal["elbow", "shoulder", "hip", "knee", "ankle"] | None = None
    tolerance: float | None = None
    rep_thresholds: dict[str, object] | None = None
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
