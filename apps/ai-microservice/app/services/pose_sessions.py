from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass, field
from math import acos, degrees, sqrt
from pathlib import Path
from statistics import mean
from threading import Lock

from ..errors import ServiceError
from ..models.pose import (
    CandidateProfileInput,
    LearnedProfile,
    PoseAnalysisSummary,
    PoseAnalyzeRequest,
    PoseAnalyzeResponse,
    PoseBootstrapRequest,
    PoseBootstrapResponse,
    PoseFinalizeRequest,
    PoseFinalizeResponse,
    PoseKeypoint,
    PoseMovementContract,
    PoseRepThreshold,
    PoseRepThresholdPair,
    PoseSpatialRequirements,
)


KNOWN_EXERCISES = (
    "push_up",
    "pull_up",
    "bench_press",
    "squat",
    "bicep_curl",
    "dip",
    "shoulder_press",
    "plank",
)

MATPLOTLIB_CACHE_DIR = Path(__file__).resolve().parents[2] / ".matplotlib-cache"

MOVEMENT_CONTRACT_DEFAULTS: dict[str, dict[str, object]] = {
    "bench_press": {
        "rep_model": "bilateral",
        "required_sides": "both",
        "primary_joints": ["left_elbow", "right_elbow"],
        "secondary_joints": ["left_shoulder", "right_shoulder"],
        "phase_order": ["setup", "down", "up"],
        "spatial_requirements": {
            "body_line_tolerance": 40.0,
            "body_x_drift_max": 0.08,
            "body_y_travel_min": 0.0,
            "left_right_symmetry_tolerance": 28.0,
            "phase_sync_tolerance_ms": 350,
        },
        "no_count_conditions": [
            "one_arm_only",
            "left_right_phase_desync",
            "bar_path_unavailable",
        ],
        "degraded_conditions": [
            "left_arm_occluded",
            "right_arm_occluded",
            "asymmetry_over_tolerance",
        ],
    },
    "bicep_curl": {
        "rep_model": "alternating",
        "required_sides": "either",
        "primary_joints": ["left_elbow", "right_elbow"],
        "secondary_joints": ["hip", "shoulder"],
        "phase_order": ["setup", "curl", "extend"],
        "spatial_requirements": {
            "body_line_tolerance": 45.0,
            "body_x_drift_max": 0.08,
            "body_y_travel_min": 0.0,
            "left_right_symmetry_tolerance": 45.0,
            "phase_sync_tolerance_ms": 650,
        },
        "no_count_conditions": [
            "equipment_required",
            "insufficient_elbow_rom",
            "hip_swing_over_tolerance",
        ],
        "degraded_conditions": ["wrist_occluded", "hip_swing_detected"],
    },
    "dip": {
        "rep_model": "bilateral",
        "required_sides": "both",
        "primary_joints": ["left_elbow", "right_elbow"],
        "secondary_joints": ["left_shoulder", "right_shoulder", "hip"],
        "phase_order": ["setup", "down", "up"],
        "spatial_requirements": {
            "body_line_tolerance": 38.0,
            "body_x_drift_max": 0.08,
            "body_y_travel_min": 0.014,
            "left_right_symmetry_tolerance": 38.0,
            "phase_sync_tolerance_ms": 650,
        },
        "no_count_conditions": [
            "bilateral_arm_motion_unconfirmed",
            "body_y_travel_below_min",
            "left_right_phase_desync",
        ],
        "degraded_conditions": [
            "left_arm_occluded",
            "right_arm_occluded",
            "phase_desync",
        ],
    },
    "plank": {
        "rep_model": "static_hold",
        "required_sides": "both",
        "primary_joints": ["left_hip", "right_hip"],
        "secondary_joints": ["left_shoulder", "right_shoulder"],
        "phase_order": ["setup", "hold"],
        "spatial_requirements": {
            "body_line_tolerance": 22.0,
            "body_x_drift_max": 0.06,
            "body_y_travel_min": 0.0,
            "left_right_symmetry_tolerance": 35.0,
            "phase_sync_tolerance_ms": 500,
        },
        "no_count_conditions": ["body_line_failure", "hold_too_short"],
        "degraded_conditions": ["hip_sag", "shoulder_occluded"],
    },
    "push_up": {
        "rep_model": "bilateral",
        "required_sides": "both",
        "primary_joints": ["left_elbow", "right_elbow"],
        "secondary_joints": ["left_shoulder", "right_shoulder", "hip"],
        "phase_order": ["setup", "down", "up"],
        "spatial_requirements": {
            "body_line_tolerance": 86.0,
            "body_x_drift_max": 0.22,
            "body_y_travel_min": 0.012,
            "hip_y_travel_min": 0.01,
            "shoulder_hip_travel_min": 0.01,
            "shoulder_y_travel_min": 0.008,
            "torso_slope_max_deg": 92.0,
            "torso_slope_min_deg": 0.0,
            "wrist_anchor_drift_max": 0.18,
            "left_right_symmetry_tolerance": 55.0,
            "phase_sync_tolerance_ms": 650,
        },
        "no_count_conditions": [
            "bilateral_arm_motion_unconfirmed",
            "push_up_body_not_horizontal",
            "body_line_failure",
            "left_right_phase_desync",
        ],
        "degraded_conditions": [
            "left_arm_occluded",
            "right_arm_occluded",
            "body_line_failure",
            "phase_desync",
        ],
    },
    "pull_up": {
        "rep_model": "bilateral",
        "required_sides": "either",
        "primary_joints": ["left_elbow", "right_elbow"],
        "secondary_joints": ["left_shoulder", "right_shoulder", "hip"],
        "phase_order": ["setup", "pull", "lower"],
        "spatial_requirements": {
            "body_line_tolerance": 45.0,
            "body_x_drift_max": 0.16,
            "body_y_travel_min": 0.0,
            "left_right_symmetry_tolerance": 60.0,
            "phase_sync_tolerance_ms": 700,
        },
        "no_count_conditions": [
            "insufficient_elbow_rom",
            "body_swing_over_tolerance",
        ],
        "degraded_conditions": [
            "left_arm_occluded",
            "right_arm_occluded",
            "bar_unavailable",
        ],
    },
    "shoulder_press": {
        "rep_model": "bilateral",
        "required_sides": "both",
        "primary_joints": ["left_shoulder", "right_shoulder"],
        "secondary_joints": ["left_elbow", "right_elbow"],
        "phase_order": ["setup", "down", "up"],
        "spatial_requirements": {
            "body_line_tolerance": 32.0,
            "body_x_drift_max": 0.08,
            "body_y_travel_min": 0.0,
            "left_right_symmetry_tolerance": 28.0,
            "phase_sync_tolerance_ms": 350,
        },
        "no_count_conditions": [
            "one_arm_only",
            "left_right_phase_desync",
            "lockout_control_failure",
        ],
        "degraded_conditions": [
            "left_arm_occluded",
            "right_arm_occluded",
            "asymmetry_over_tolerance",
        ],
    },
    "squat": {
        "rep_model": "bilateral",
        "required_sides": "both",
        "primary_joints": ["left_knee", "right_knee"],
        "secondary_joints": ["left_hip", "right_hip"],
        "phase_order": ["setup", "down", "up"],
        "spatial_requirements": {
            "body_line_tolerance": 45.0,
            "body_x_drift_max": 0.1,
            "body_y_travel_min": 0.02,
            "left_right_symmetry_tolerance": 35.0,
            "phase_sync_tolerance_ms": 450,
        },
        "no_count_conditions": [
            "one_leg_only",
            "body_y_travel_below_min",
            "left_right_phase_desync",
        ],
        "degraded_conditions": [
            "left_leg_occluded",
            "right_leg_occluded",
            "depth_unavailable",
        ],
    },
}


@dataclass(slots=True)
class PoseSessionState:
    pose_session_id: str
    exercise_hint: str | None
    starter_catalog: list[str]
    candidate_profiles: list[CandidateProfileInput]
    frames_analyzed: int = 0
    rep_count: int = 0
    confidence_total: float = 0.0
    subject_lock_total: float = 0.0
    matched_profile_id: str | None = None
    detected_exercise_name: str | None = None
    candidate_exercises: list[str] = field(default_factory=list)
    feedback_history: list[str] = field(default_factory=list)
    last_joint_angles: dict[str, float] = field(default_factory=dict)
    last_landmark_signature: dict[str, object] = field(default_factory=dict)
    last_orientation_signature: dict[str, object] = field(default_factory=dict)
    last_movement_pattern: dict[str, object] = field(default_factory=dict)
    last_visibility_pattern: dict[str, object] = field(default_factory=dict)
    last_rep_rules: dict[str, object] | None = None
    last_movement_contract: PoseMovementContract | None = None
    last_frame_signature: float | None = None
    last_frame_samples: list[int] = field(default_factory=list)
    legacy_signature_history: list[float] = field(default_factory=list)
    legacy_phase: str = "primed"
    legacy_cycle_ready: bool = False


class PoseSessionService:
    accepted_fps = 20
    confirmation_threshold = 0.80
    min_reliable_frames = 6
    fallback_tolerance = 12.0

    def __init__(self) -> None:
        self._sessions: dict[str, PoseSessionState] = {}
        self._pose_estimator: object | None = None
        self._pose_estimator_lock = Lock()

    def reset(self) -> None:
        self._sessions.clear()

    def bootstrap_session(
        self,
        payload: PoseBootstrapRequest,
    ) -> PoseBootstrapResponse:
        self._sessions[payload.pose_session_id] = PoseSessionState(
            pose_session_id=payload.pose_session_id,
            exercise_hint=payload.exercise_hint,
            starter_catalog=payload.starter_catalog,
            candidate_profiles=payload.candidate_profiles,
        )
        return PoseBootstrapResponse(
            status="ready",
            accepted_fps=self.accepted_fps,
            subject_lock_mode="single_subject",
        )

    def analyze_frame(self, payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
        if payload.frames:
            return self._analyze_sequence(payload)
        return self._analyze_legacy_frame(payload)

    def finalize_session(
        self,
        payload: PoseFinalizeRequest,
    ) -> PoseFinalizeResponse:
        state = self._get_session(payload.pose_session_id)
        average_confidence = (
            round(state.confidence_total / state.frames_analyzed, 3)
            if state.frames_analyzed > 0
            else None
        )
        subject_lock_confidence = (
            round(state.subject_lock_total / state.frames_analyzed, 3)
            if state.frames_analyzed > 0
            else None
        )
        summary = PoseAnalysisSummary(
            reps_detected=state.rep_count,
            form_feedback=self._dedupe_feedback(state.feedback_history),
            average_confidence=average_confidence,
            dominant_joint_angles=state.last_joint_angles,
        )
        learned_profile = self._build_learned_profile(
            state,
            state.detected_exercise_name,
            state.matched_profile_id,
        )
        del self._sessions[payload.pose_session_id]

        return PoseFinalizeResponse(
            detected_exercise_name=state.detected_exercise_name,
            matched_profile_id=state.matched_profile_id,
            classification_confidence=average_confidence,
            subject_lock_confidence=subject_lock_confidence,
            analysis_summary=summary,
            learned_profile=learned_profile,
        )

    def _analyze_sequence(self, payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
        state = self._get_session(payload.pose_session_id)
        assert payload.frames is not None
        assert payload.signals is not None

        reliable_frame_count = payload.signals.visibility.reliable_frame_count
        subject_locked = reliable_frame_count >= self.min_reliable_frames
        subject_lock_confidence = self._compute_subject_lock_confidence(payload)
        state.frames_analyzed += len(payload.frames)
        state.subject_lock_total += subject_lock_confidence
        state.last_joint_angles = self._latest_joint_angles(payload)
        computed_ankle_signals = self._build_keypoint_angle_signals(
            payload.frames[-1].keypoints
        )
        for name, value in computed_ankle_signals.items():
            state.last_joint_angles.setdefault(name, value)
        state.last_landmark_signature = self._build_landmark_signature(payload)
        state.last_orientation_signature = payload.signals.orientation.model_dump()
        state.last_movement_pattern = payload.signals.temporal.model_dump()
        state.last_visibility_pattern = payload.signals.visibility.model_dump()

        exercise_hint = payload.exercise_hint
        classification = self._classify_sequence(state, payload, exercise_hint)
        state.confidence_total += classification["confidence"]
        state.candidate_exercises = classification["candidate_exercises"]
        state.feedback_history.extend(classification["form_feedback"])
        if classification["exercise_class"]:
            state.detected_exercise_name = classification["exercise_class"]
        if classification["matched_profile_id"]:
            state.matched_profile_id = classification["matched_profile_id"]
        if classification["movement_contract"]:
            state.last_movement_contract = classification["movement_contract"]
            state.last_rep_rules = self._rep_rules_from_contract(
                classification["movement_contract"]
            )

        return PoseAnalyzeResponse(
            confidence=classification["confidence"],
            exercise_class=classification["exercise_class"],
            matched_profile_id=classification["matched_profile_id"],
            movement_contract=classification["movement_contract"],
            subject_locked=subject_locked,
            subject_lock_confidence=subject_lock_confidence,
            classification_source=classification["classification_source"],
            needs_confirmation=classification["needs_confirmation"],
            processing_mode="sequence",
            rep_event=False,
            rep_count_delta=0,
            rep_count_total=state.rep_count,
            phase=None,
            candidate_exercises=classification["candidate_exercises"],
            form_feedback=self._dedupe_feedback(classification["form_feedback"]),
            learned_profile=classification["learned_profile"],
        )

    def _analyze_legacy_frame(self, payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
        state = self._get_session(payload.pose_session_id)
        frame_signature, frame_samples = self._compute_frame_signature(
            payload.frame_b64 or ""
        )
        keypoints = self._extract_pose_keypoints(payload.frame_b64 or "")
        keypoint_visibility = self._compute_keypoint_visibility(keypoints)
        frame_change_score = self._compute_frame_change_score(
            frame_samples,
            state.last_frame_samples,
        )
        exercise_name = self._infer_legacy_exercise(
            state,
            payload,
            frame_signature,
            frame_change_score,
        )
        profile = self._match_profile(state, exercise_name)
        movement_contract = self._build_contract_from_profile(profile) if profile else None
        if movement_contract is None and exercise_name is not None:
            movement_contract = self._build_fallback_legacy_contract(exercise_name)
        phase, rep_event, rep_count_delta = self._step_legacy_rep_counter(
            state,
            frame_signature,
            frame_change_score,
            exercise_name,
            len(frame_samples),
        )
        confidence = self._compute_legacy_confidence(
            movement_contract,
            frame_change_score,
            frame_signature,
            rep_event,
        )
        subject_lock_confidence = self._compute_legacy_subject_lock_confidence(
            payload,
            frame_change_score,
            movement_contract is not None,
        )
        if keypoint_visibility is not None:
            confidence = round(max(confidence, min(0.96, 0.7 + keypoint_visibility * 0.25)), 3)
            subject_lock_confidence = round(
                max(subject_lock_confidence, min(0.98, keypoint_visibility)),
                3,
            )
        subject_locked = (
            self._has_reliable_keypoint_lock(keypoints)
            if keypoints is not None
            else bool(payload.frame_b64)
        )
        state.frames_analyzed += 1
        state.confidence_total += confidence
        state.subject_lock_total += subject_lock_confidence
        if exercise_name:
            state.detected_exercise_name = exercise_name
        if movement_contract is not None:
            state.last_movement_contract = movement_contract
        if profile:
            state.matched_profile_id = profile.id
        state.last_frame_signature = frame_signature
        state.last_frame_samples = frame_samples
        if keypoints is not None:
            state.last_landmark_signature = self._build_keypoint_landmark_signature(
                keypoints,
                frame_signature,
            )
        else:
            state.last_landmark_signature = {
                "frame_signature": frame_signature,
                "sample_count": len(frame_samples),
            }
        state.last_joint_angles = self._build_legacy_joint_angles(
            movement_contract,
            phase,
            frame_signature,
        )
        if keypoints is not None:
            state.last_joint_angles.update(self._build_keypoint_angle_signals(keypoints))
        state.last_orientation_signature = {
            "processing_mode": "legacy_frame",
            "frame_change_score": frame_change_score,
            "frame_signature": frame_signature,
        }
        state.last_movement_pattern = {
            "phase": phase,
            "frame_change_score": frame_change_score,
            "rep_count_total": state.rep_count,
        }
        state.last_visibility_pattern = {
            "subject_locked": subject_locked,
            "subject_lock_confidence": subject_lock_confidence,
            "native_landmark_visibility": keypoint_visibility,
        }
        if movement_contract is not None:
            state.last_rep_rules = self._rep_rules_from_contract(movement_contract)
        feedback = self._build_legacy_feedback(
            exercise_name,
            phase,
            rep_event,
            movement_contract is not None,
        )
        if keypoints is not None:
            feedback = self._dedupe_feedback(
                [
                    "Native landmark extraction is active.",
                    "Keep both sides visible so bilateral reps can count cleanly.",
                    *feedback,
                ]
            )
        state.feedback_history.extend(feedback)

        return PoseAnalyzeResponse(
            confidence=confidence,
            exercise_class=exercise_name,
            matched_profile_id=profile.id if profile else None,
            movement_contract=movement_contract,
            subject_locked=subject_locked,
            subject_lock_confidence=subject_lock_confidence,
            classification_source="preset" if profile else "classifier",
            needs_confirmation=movement_contract is None,
            processing_mode="legacy_frame",
            rep_event=rep_event,
            rep_count_delta=rep_count_delta,
            rep_count_total=state.rep_count,
            phase=phase,
            keypoints=keypoints,
            candidate_exercises=self._candidate_names(state),
            form_feedback=feedback,
            learned_profile=None,
        )

    def _extract_pose_keypoints(self, frame_b64: str) -> list[PoseKeypoint] | None:
        raw_bytes = self._decode_frame_bytes(frame_b64)
        if raw_bytes is None:
            return None

        self._prepare_pose_runtime_cache()

        try:
            import numpy as np  # type: ignore[import-not-found]
            from PIL import Image, ImageOps  # type: ignore[import-not-found]

            with Image.open(io.BytesIO(raw_bytes)) as image:
                rgb_image = ImageOps.exif_transpose(image).convert("RGB")
                image_array = np.asarray(rgb_image)
            pose = self._get_pose_estimator()
            if pose is None:
                return None
            with self._pose_estimator_lock:
                result = pose.process(image_array)
        except Exception:
            return None

        landmarks = getattr(getattr(result, "pose_landmarks", None), "landmark", None)
        if not landmarks or len(landmarks) < 33:
            return None

        return [
            PoseKeypoint(
                x=self._clamp_unit(float(landmark.x)),
                y=self._clamp_unit(float(landmark.y)),
                z=float(landmark.z),
                visibility=self._clamp_unit(float(getattr(landmark, "visibility", 0.0))),
            )
            for landmark in landmarks[:33]
        ]

    def _get_pose_estimator(self) -> object | None:
        if self._pose_estimator is not None:
            return self._pose_estimator
        try:
            import mediapipe as mp  # type: ignore[import-not-found]
        except Exception:
            return None
        with self._pose_estimator_lock:
            if self._pose_estimator is None:
                self._pose_estimator = mp.solutions.pose.Pose(
                    static_image_mode=True,
                    model_complexity=1,
                    enable_segmentation=False,
                    min_detection_confidence=0.45,
                )
        return self._pose_estimator

    def _decode_frame_bytes(self, frame_b64: str) -> bytes | None:
        normalized = frame_b64.strip()
        if not normalized:
            return None
        if "," in normalized:
            normalized = normalized.split(",", 1)[1]
        try:
            return base64.b64decode(normalized + "=" * (-len(normalized) % 4))
        except Exception:
            return None

    def _prepare_pose_runtime_cache(self) -> None:
        if os.environ.get("MPLCONFIGDIR"):
            return
        try:
            MATPLOTLIB_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            os.environ["MPLCONFIGDIR"] = str(MATPLOTLIB_CACHE_DIR)
        except OSError:
            return

    def _compute_keypoint_visibility(
        self,
        keypoints: list[PoseKeypoint] | None,
    ) -> float | None:
        if not keypoints:
            return None
        return round(mean(point.visibility for point in keypoints), 3)

    def _has_reliable_keypoint_lock(self, keypoints: list[PoseKeypoint] | None) -> bool:
        if not keypoints:
            return False
        visible_count = sum(1 for point in keypoints if point.visibility >= 0.45)
        return visible_count >= 18

    def _build_keypoint_landmark_signature(
        self,
        keypoints: list[PoseKeypoint],
        frame_signature: float,
    ) -> dict[str, object]:
        visible_count = sum(1 for point in keypoints if point.visibility >= 0.45)
        hip_points = [keypoints[23], keypoints[24]]
        shoulder_points = [keypoints[11], keypoints[12]]
        return {
            "frame_signature": frame_signature,
            "provider": "python_mediapipe_pose",
            "visible_landmark_count": visible_count,
            "average_visibility": self._compute_keypoint_visibility(keypoints),
            "hip_center": {
                "x": round(mean(point.x for point in hip_points), 4),
                "y": round(mean(point.y for point in hip_points), 4),
            },
            "shoulder_center": {
                "x": round(mean(point.x for point in shoulder_points), 4),
                "y": round(mean(point.y for point in shoulder_points), 4),
            },
        }

    def _clamp_unit(self, value: float) -> float:
        return round(min(1.0, max(0.0, value)), 6)

    def _compute_keypoint_angle(
        self,
        keypoints: list[PoseKeypoint],
        first_index: int,
        vertex_index: int,
        last_index: int,
    ) -> float | None:
        if len(keypoints) <= max(first_index, vertex_index, last_index):
            return None
        first = keypoints[first_index]
        vertex = keypoints[vertex_index]
        last = keypoints[last_index]
        if min(first.visibility, vertex.visibility, last.visibility) < 0.45:
            return None
        first_vector = (
            first.x - vertex.x,
            first.y - vertex.y,
        )
        last_vector = (
            last.x - vertex.x,
            last.y - vertex.y,
        )
        first_length = sqrt(sum(component * component for component in first_vector))
        last_length = sqrt(sum(component * component for component in last_vector))
        denominator = first_length * last_length
        if denominator <= 1e-9:
            return None
        cosine = sum(
            left * right for left, right in zip(first_vector, last_vector)
        ) / denominator
        return round(degrees(acos(max(-1.0, min(1.0, cosine)))), 3)

    def _build_keypoint_angle_signals(
        self,
        keypoints: list[PoseKeypoint],
    ) -> dict[str, float]:
        left_ankle = self._compute_keypoint_angle(keypoints, 25, 27, 31)
        right_ankle = self._compute_keypoint_angle(keypoints, 26, 28, 32)
        signals = {
            name: value
            for name, value in {
                "left_ankle": left_ankle,
                "right_ankle": right_ankle,
            }.items()
            if value is not None
        }
        usable = [value for value in (left_ankle, right_ankle) if value is not None]
        if usable:
            signals["ankle"] = round(mean(usable), 3)
        return signals

    def _classify_sequence(
        self,
        state: PoseSessionState,
        payload: PoseAnalyzeRequest,
        exercise_hint: str | None,
    ) -> dict[str, object]:
        normalized_hint = self._normalize_name(exercise_hint)
        matched_profile = self._match_profile(state, normalized_hint)
        if matched_profile:
            return {
                "confidence": 0.96,
                "exercise_class": matched_profile.canonical_name,
                "matched_profile_id": matched_profile.id,
                "movement_contract": self._build_contract_from_profile(matched_profile),
                "classification_source": "preset",
                "needs_confirmation": False,
                "candidate_exercises": [matched_profile.canonical_name],
                "form_feedback": self._build_feedback(
                    matched_profile.canonical_name,
                    payload,
                    subject_locked=True,
                ),
                "learned_profile": None,
            }

        scores = self._score_candidates(payload, normalized_hint)
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_name, top_score = ranked[0]
        candidate_names = [name for name, _ in ranked[:3]]
        matched_candidate_profile = self._match_profile(state, top_name)
        movement_contract = (
            self._build_contract_from_profile(matched_candidate_profile)
            if matched_candidate_profile
            else self._build_generated_contract(top_name, payload)
        )
        needs_confirmation = top_score < self.confirmation_threshold or movement_contract is None
        exercise_class = None if needs_confirmation else top_name
        learned_profile = None

        if not needs_confirmation and movement_contract and not matched_candidate_profile:
            learned_profile = self._build_learned_profile(
                state,
                top_name,
                matched_profile_id=None,
                movement_contract=movement_contract,
            )

        return {
            "confidence": round(top_score, 3),
            "exercise_class": exercise_class,
            "matched_profile_id": matched_candidate_profile.id if matched_candidate_profile else None,
            "movement_contract": None if needs_confirmation else movement_contract,
            "classification_source": "classifier",
            "needs_confirmation": needs_confirmation,
            "candidate_exercises": candidate_names,
            "form_feedback": self._build_feedback(
                top_name if not needs_confirmation else None,
                payload,
                subject_locked=
                payload.signals.visibility.reliable_frame_count >= self.min_reliable_frames,
            ),
            "learned_profile": learned_profile,
        }

    def _score_candidates(
        self,
        payload: PoseAnalyzeRequest,
        normalized_hint: str | None,
    ) -> dict[str, float]:
        assert payload.signals is not None
        angle_ranges = self._angle_ranges(payload)
        body_orientation = payload.signals.orientation.body_orientation.lower()
        hip_range = payload.signals.hip.range_y
        hip_range_x = payload.signals.hip.range_x or 0.0
        stable_hips = payload.signals.hip.stable
        wrist_visibility = payload.signals.visibility.wrist_visibility
        feet_visibility = payload.signals.visibility.feet_visibility
        left_arm_visibility = payload.signals.visibility.left_arm_visibility or 0.0
        right_arm_visibility = payload.signals.visibility.right_arm_visibility or 0.0
        phase_sync_ms = payload.signals.temporal.phase_sync_ms
        oscillating = set(payload.signals.temporal.oscillating_joints)
        amplitudes = payload.signals.temporal.amplitudes
        total_motion = sum(amplitudes.values())
        bilateral_elbow_range = min(
            angle_ranges.get("left_elbow", 0.0),
            angle_ranges.get("right_elbow", 0.0),
        )
        bilateral_shoulder_range = min(
            angle_ranges.get("left_shoulder", 0.0),
            angle_ranges.get("right_shoulder", 0.0),
        )
        bilateral_knee_range = min(
            angle_ranges.get("left_knee", 0.0),
            angle_ranges.get("right_knee", 0.0),
        )
        one_sided_elbow_motion = (
            max(angle_ranges.get("left_elbow", 0.0), angle_ranges.get("right_elbow", 0.0)) >= 24
            and bilateral_elbow_range < 12
        )

        scores = {name: 0.25 for name in KNOWN_EXERCISES}
        if "horizontal" in body_orientation or "prone" in body_orientation:
            scores["push_up"] += 0.28
            scores["bench_press"] += 0.18
            scores["plank"] += 0.12
            scores["dip"] -= 0.12
            scores["bicep_curl"] -= 0.1
            scores["shoulder_press"] -= 0.08
        if "supine" in body_orientation:
            scores["bench_press"] += 0.3
        if "upright" in body_orientation or "inclined" in body_orientation:
            scores["squat"] += 0.18
            scores["bicep_curl"] += 0.2
            scores["dip"] += 0.18
            scores["pull_up"] += 0.14
            scores["shoulder_press"] += 0.18
            scores["push_up"] -= 0.1
            scores["bench_press"] -= 0.06

        if angle_ranges["knee"] >= 28 or bilateral_knee_range >= 22 or hip_range >= 0.04:
            scores["squat"] += 0.3
        if angle_ranges["elbow"] >= 24:
            scores["push_up"] += 0.18
            scores["pull_up"] += 0.16
            scores["bench_press"] += 0.14
            scores["bicep_curl"] += 0.12
        if bilateral_elbow_range >= 20:
            scores["push_up"] += 0.1
            scores["pull_up"] += 0.08
            scores["bench_press"] += 0.08
            scores["dip"] += 0.09
        if angle_ranges["shoulder"] >= 20:
            scores["shoulder_press"] += 0.2
            scores["pull_up"] += 0.08
        if bilateral_shoulder_range >= 16:
            scores["shoulder_press"] += 0.08
            scores["dip"] += 0.04
        if stable_hips:
            scores["bicep_curl"] += 0.08
            scores["bench_press"] += 0.05
        if not stable_hips and hip_range >= 0.05:
            scores["push_up"] += 0.06
            scores["squat"] += 0.08
            scores["bicep_curl"] -= 0.04
        if "knee" in oscillating or "hip" in oscillating:
            scores["squat"] += 0.12
        if "elbow" in oscillating:
            scores["push_up"] += 0.1
            scores["bicep_curl"] += 0.08
            scores["bench_press"] += 0.06
            scores["dip"] += 0.06
        if stable_hips and one_sided_elbow_motion and angle_ranges["elbow"] >= 20:
            scores["bicep_curl"] += 0.12
        if (
            stable_hips
            and bilateral_elbow_range < 14
            and angle_ranges["elbow"] >= 20
        ):
            scores["bicep_curl"] += 0.06
        if bilateral_elbow_range >= 20 and (
            "horizontal" in body_orientation or "prone" in body_orientation
        ):
            scores["push_up"] += 0.08
            scores["bench_press"] += 0.05
        if (
            ("upright" in body_orientation or "inclined" in body_orientation)
            and bilateral_elbow_range >= 18
            and hip_range >= 0.01
        ):
            scores["dip"] += 0.12
        if "shoulder" in oscillating:
            scores["shoulder_press"] += 0.1
            scores["pull_up"] += 0.05
        if total_motion <= 0.05 and stable_hips:
            scores["plank"] += 0.3
        if feet_visibility < 0.4:
            scores["bench_press"] += 0.08
        if wrist_visibility >= 0.6:
            scores["push_up"] += 0.05
            scores["shoulder_press"] += 0.05
        if min(left_arm_visibility, right_arm_visibility) >= 0.55:
            scores["push_up"] += 0.04
            scores["bench_press"] += 0.04
            scores["shoulder_press"] += 0.04
        if one_sided_elbow_motion:
            scores["push_up"] -= 0.14
            scores["bench_press"] -= 0.1
            scores["shoulder_press"] -= 0.08
            scores["bicep_curl"] += 0.05
        if phase_sync_ms is not None and phase_sync_ms <= 450:
            scores["push_up"] += 0.04
            scores["bench_press"] += 0.03
            scores["squat"] += 0.03
        if hip_range_x > 0.22:
            scores["push_up"] -= 0.04
            scores["bench_press"] -= 0.04

        if normalized_hint and normalized_hint in scores:
            scores[normalized_hint] += 0.08

        return {name: round(min(max(score, 0.01), 0.99), 3) for name, score in scores.items()}

    def _contract_defaults(self, exercise_name: str) -> dict[str, object]:
        normalized_name = self._normalize_name(exercise_name) or exercise_name
        return MOVEMENT_CONTRACT_DEFAULTS.get(
            normalized_name,
            MOVEMENT_CONTRACT_DEFAULTS["squat"],
        )

    def _string_list(self, value: object, fallback: object) -> list[str]:
        if isinstance(value, list):
            entries = [entry for entry in value if isinstance(entry, str) and entry]
            if entries:
                return entries
        if isinstance(fallback, list):
            return [entry for entry in fallback if isinstance(entry, str)]
        return []

    def _field_value(
        self,
        source: dict[str, object] | None,
        snake_key: str,
        camel_key: str,
    ) -> object | None:
        if not source:
            return None
        return source.get(snake_key, source.get(camel_key))

    def _number_value(
        self,
        source: dict[str, object],
        snake_key: str,
        camel_key: str,
        fallback: object,
    ) -> float | int | None:
        value = self._field_value(source, snake_key, camel_key)
        if isinstance(value, (int, float)):
            return value
        return fallback if isinstance(fallback, (int, float)) else None

    def _spatial_requirements(
        self,
        source: dict[str, object] | None,
        fallback: object,
    ) -> PoseSpatialRequirements | None:
        fallback_dict = fallback if isinstance(fallback, dict) else {}
        spatial_source = source if isinstance(source, dict) else {}
        return PoseSpatialRequirements(
            body_line_tolerance=self._number_value(
                spatial_source,
                "body_line_tolerance",
                "bodyLineTolerance",
                fallback_dict.get("body_line_tolerance"),
            ),
            body_x_drift_max=self._number_value(
                spatial_source,
                "body_x_drift_max",
                "bodyXDriftMax",
                fallback_dict.get("body_x_drift_max"),
            ),
            body_y_travel_min=self._number_value(
                spatial_source,
                "body_y_travel_min",
                "bodyYTravelMin",
                fallback_dict.get("body_y_travel_min"),
            ),
            hip_y_travel_min=self._number_value(
                spatial_source,
                "hip_y_travel_min",
                "hipYTravelMin",
                fallback_dict.get("hip_y_travel_min"),
            ),
            shoulder_y_travel_min=self._number_value(
                spatial_source,
                "shoulder_y_travel_min",
                "shoulderYTravelMin",
                fallback_dict.get("shoulder_y_travel_min"),
            ),
            shoulder_hip_travel_min=self._number_value(
                spatial_source,
                "shoulder_hip_travel_min",
                "shoulderHipTravelMin",
                fallback_dict.get("shoulder_hip_travel_min"),
            ),
            left_right_symmetry_tolerance=self._number_value(
                spatial_source,
                "left_right_symmetry_tolerance",
                "leftRightSymmetryTolerance",
                fallback_dict.get("left_right_symmetry_tolerance"),
            ),
            wrist_anchor_drift_max=self._number_value(
                spatial_source,
                "wrist_anchor_drift_max",
                "wristAnchorDriftMax",
                fallback_dict.get("wrist_anchor_drift_max"),
            ),
            torso_slope_min_deg=self._number_value(
                spatial_source,
                "torso_slope_min_deg",
                "torsoSlopeMinDeg",
                fallback_dict.get("torso_slope_min_deg"),
            ),
            torso_slope_max_deg=self._number_value(
                spatial_source,
                "torso_slope_max_deg",
                "torsoSlopeMaxDeg",
                fallback_dict.get("torso_slope_max_deg"),
            ),
            phase_sync_tolerance_ms=self._number_value(
                spatial_source,
                "phase_sync_tolerance_ms",
                "phaseSyncToleranceMs",
                fallback_dict.get("phase_sync_tolerance_ms"),
            ),
        )

    def _enrich_contract(
        self,
        contract: PoseMovementContract,
        source: dict[str, object] | None = None,
    ) -> PoseMovementContract:
        defaults = self._contract_defaults(contract.exercise)
        spatial_source = self._field_value(
            source,
            "spatial_requirements",
            "spatialRequirements",
        )
        spatial_dict = spatial_source if isinstance(spatial_source, dict) else None
        rep_model = self._field_value(source, "rep_model", "repModel")
        required_sides = self._field_value(source, "required_sides", "requiredSides")
        return contract.model_copy(
            update={
                "degraded_conditions": self._string_list(
                    self._field_value(source, "degraded_conditions", "degradedConditions"),
                    contract.degraded_conditions or defaults.get("degraded_conditions", []),
                ),
                "no_count_conditions": self._string_list(
                    self._field_value(source, "no_count_conditions", "noCountConditions"),
                    contract.no_count_conditions or defaults.get("no_count_conditions", []),
                ),
                "phase_order": self._string_list(
                    self._field_value(source, "phase_order", "phaseOrder"),
                    contract.phase_order or defaults.get("phase_order", []),
                ),
                "primary_joints": self._string_list(
                    self._field_value(source, "primary_joints", "primaryJoints"),
                    contract.primary_joints or defaults.get("primary_joints", []),
                ),
                "rep_model": rep_model
                if isinstance(rep_model, str)
                else contract.rep_model or defaults.get("rep_model", "unknown"),
                "required_sides": required_sides
                if isinstance(required_sides, str)
                else contract.required_sides or defaults.get("required_sides"),
                "secondary_joints": self._string_list(
                    self._field_value(source, "secondary_joints", "secondaryJoints"),
                    contract.secondary_joints or defaults.get("secondary_joints", []),
                ),
                "spatial_requirements": self._spatial_requirements(
                    spatial_dict,
                    contract.spatial_requirements.model_dump()
                    if contract.spatial_requirements is not None
                    else defaults.get("spatial_requirements", {}),
                ),
            },
        )

    def _build_contract_from_profile(
        self,
        profile: CandidateProfileInput | None,
    ) -> PoseMovementContract | None:
        if profile is None:
            return None

        tolerance = (
            float(profile.tolerance)
            if profile.tolerance is not None
            else self.fallback_tolerance
        )
        dominant_joint = profile.dominant_joint or self._infer_joint_from_profile(profile)
        rep_thresholds = self._coerce_thresholds(profile.rep_thresholds, tolerance)
        if rep_thresholds is None:
            rep_thresholds = self._thresholds_from_angle_signature(
                profile.angle_signature,
                dominant_joint,
                tolerance,
            )
        if rep_thresholds is None:
            return None

        movement_pattern = profile.movement_pattern or {}
        contract_source = {**movement_pattern, **(profile.rep_rules or {})}
        oscillating_joints = self._normalize_joint_list(
            movement_pattern.get("oscillating_landmarks")
            or contract_source.get("oscillating_joints")
        )
        secondary_check = self._secondary_check(
            profile.rep_rules or movement_pattern or {}
        )
        return self._enrich_contract(
            PoseMovementContract(
                exercise=profile.canonical_name,
                dominant_joint=dominant_joint,
                rep_thresholds=rep_thresholds,
                secondary_check=secondary_check,
                oscillating_joints=oscillating_joints,
            ),
            contract_source,
        )

    def _build_generated_contract(
        self,
        exercise_name: str,
        payload: PoseAnalyzeRequest,
    ) -> PoseMovementContract:
        assert payload.signals is not None
        dominant_joint = {
            "squat": "knee",
            "push_up": "elbow",
            "pull_up": "elbow",
            "bench_press": "elbow",
            "bicep_curl": "elbow",
            "dip": "elbow",
            "shoulder_press": "shoulder",
            "plank": "hip",
        }.get(exercise_name, "knee")
        angle_ranges = self._angle_ranges(payload)
        average_angles = self._average_angles(payload)
        dominant_average = average_angles.get(dominant_joint, 120.0)
        dominant_range = angle_ranges.get(dominant_joint, 30.0)
        preset_thresholds = {
            "bench_press": {
                "down_angle": 78.0,
                "tolerance": 12.0,
                "up_angle": 166.0,
            },
            "bicep_curl": {
                "down_angle": 136.0,
                "tolerance": 32.0,
                "up_angle": 96.0,
            },
            "dip": {
                "down_angle": 88.0,
                "tolerance": 12.0,
                "up_angle": 154.0,
            },
            "plank": {
                "down_angle": 165.0,
                "tolerance": 8.0,
                "up_angle": 178.0,
            },
            "push_up": {
                "down_angle": 150.0,
                "tolerance": 12.0,
                "up_angle": 154.0,
            },
            "pull_up": {
                "down_angle": 138.0,
                "tolerance": 28.0,
                "up_angle": 105.0,
            },
            "shoulder_press": {
                "down_angle": 74.0,
                "tolerance": 12.0,
                "up_angle": 164.0,
            },
            "squat": {
                "down_angle": 92.0,
                "tolerance": 12.0,
                "up_angle": 168.0,
            },
        }.get(exercise_name)
        if preset_thresholds is not None:
            down_angle = preset_thresholds["down_angle"]
            up_angle = preset_thresholds["up_angle"]
            tolerance = preset_thresholds["tolerance"]
        else:
            tolerance = max(self.fallback_tolerance, round(dominant_range / 3, 3))
            down_angle = max(45.0, round(dominant_average - dominant_range / 2, 3))
            up_angle = min(175.0, round(dominant_average + dominant_range / 2 + 12.0, 3))
        secondary_check = {
            "squat": "hip_depth",
            "push_up": "body_line",
            "pull_up": "vertical_pull",
            "bench_press": "bar_path",
            "bicep_curl": "hip_stability",
            "dip": "vertical_body_travel",
            "shoulder_press": "lockout_control",
            "plank": "core_alignment",
        }.get(exercise_name, "range_of_motion")
        oscillating_joints = (
            payload.signals.temporal.oscillating_joints or [dominant_joint]
        )
        return self._enrich_contract(
            PoseMovementContract(
                exercise=exercise_name,
                dominant_joint=dominant_joint,
                rep_thresholds=PoseRepThresholdPair(
                    down=PoseRepThreshold(angle=down_angle, tolerance=tolerance),
                    up=PoseRepThreshold(angle=up_angle, tolerance=tolerance),
                ),
                secondary_check=secondary_check,
                oscillating_joints=self._normalize_joint_list(oscillating_joints)
                or [dominant_joint],
            ),
        )

    def _build_fallback_legacy_contract(
        self,
        exercise_name: str,
    ) -> PoseMovementContract:
        defaults = {
            "bench_press": {
                "dominant_joint": "elbow",
                "down_angle": 78.0,
                "up_angle": 166.0,
                "tolerance": 12.0,
                "secondary_check": "bar_path",
                "oscillating_joints": ["elbow", "shoulder"],
            },
            "bicep_curl": {
                "dominant_joint": "elbow",
                "down_angle": 136.0,
                "up_angle": 96.0,
                "tolerance": 32.0,
                "secondary_check": "hip_stability",
                "oscillating_joints": ["elbow"],
            },
            "dip": {
                "dominant_joint": "elbow",
                "down_angle": 88.0,
                "up_angle": 154.0,
                "tolerance": 12.0,
                "secondary_check": "vertical_body_travel",
                "oscillating_joints": ["elbow", "shoulder"],
            },
            "plank": {
                "dominant_joint": "hip",
                "down_angle": 165.0,
                "up_angle": 178.0,
                "tolerance": 8.0,
                "secondary_check": "core_alignment",
                "oscillating_joints": ["hip", "shoulder"],
            },
            "push_up": {
                "dominant_joint": "elbow",
                "down_angle": 150.0,
                "up_angle": 154.0,
                "tolerance": 12.0,
                "secondary_check": "body_line",
                "oscillating_joints": ["elbow", "shoulder"],
            },
            "pull_up": {
                "dominant_joint": "elbow",
                "down_angle": 138.0,
                "up_angle": 105.0,
                "tolerance": 28.0,
                "secondary_check": "vertical_pull",
                "oscillating_joints": ["elbow", "shoulder"],
            },
            "shoulder_press": {
                "dominant_joint": "shoulder",
                "down_angle": 74.0,
                "up_angle": 164.0,
                "tolerance": 12.0,
                "secondary_check": "lockout_control",
                "oscillating_joints": ["shoulder", "elbow"],
            },
            "squat": {
                "dominant_joint": "knee",
                "down_angle": 92.0,
                "up_angle": 168.0,
                "tolerance": 12.0,
                "secondary_check": "hip_depth",
                "oscillating_joints": ["hip", "knee"],
            },
        }
        selected = defaults.get(exercise_name, defaults["squat"])
        return self._enrich_contract(
            PoseMovementContract(
                exercise=exercise_name,
                dominant_joint=selected["dominant_joint"],
                rep_thresholds=PoseRepThresholdPair(
                    down=PoseRepThreshold(
                        angle=selected["down_angle"],
                        tolerance=selected["tolerance"],
                    ),
                    up=PoseRepThreshold(
                        angle=selected["up_angle"],
                        tolerance=selected["tolerance"],
                    ),
                ),
                secondary_check=selected["secondary_check"],
                oscillating_joints=list(selected["oscillating_joints"]),
            ),
        )

    def _rep_rules_from_contract(
        self,
        movement_contract: PoseMovementContract,
    ) -> dict[str, object]:
        return {
            "degraded_conditions": movement_contract.degraded_conditions,
            "no_count_conditions": movement_contract.no_count_conditions,
            "phase_order": movement_contract.phase_order,
            "primary_joints": movement_contract.primary_joints,
            "rep_model": movement_contract.rep_model,
            "rep_thresholds": movement_contract.rep_thresholds.model_dump(),
            "required_sides": movement_contract.required_sides,
            "secondary_check": movement_contract.secondary_check,
            "secondary_joints": movement_contract.secondary_joints,
            "oscillating_joints": movement_contract.oscillating_joints,
            "spatial_requirements": movement_contract.spatial_requirements.model_dump()
            if movement_contract.spatial_requirements is not None
            else None,
        }

    def _build_learned_profile(
        self,
        state: PoseSessionState,
        detected_exercise_name: str | None,
        matched_profile_id: str | None,
        movement_contract: PoseMovementContract | None = None,
    ) -> LearnedProfile | None:
        if (
            detected_exercise_name is None
            or matched_profile_id is not None
            or movement_contract is None and state.last_movement_contract is None
        ):
            return None

        active_contract = movement_contract or state.last_movement_contract
        assert active_contract is not None
        return LearnedProfile(
            canonical_name=detected_exercise_name,
            landmark_signature=state.last_landmark_signature,
            angle_signature=state.last_joint_angles,
            orientation_signature=state.last_orientation_signature,
            movement_pattern=state.last_movement_pattern,
            visibility_pattern=state.last_visibility_pattern,
            dominant_joint=active_contract.dominant_joint,
            tolerance=active_contract.rep_thresholds.down.tolerance,
            rep_thresholds=active_contract.rep_thresholds.model_dump(),
            rep_rules={
                "degraded_conditions": active_contract.degraded_conditions,
                "no_count_conditions": active_contract.no_count_conditions,
                "phase_order": active_contract.phase_order,
                "primary_joints": active_contract.primary_joints,
                "rep_model": active_contract.rep_model,
                "required_sides": active_contract.required_sides,
                "secondary_check": active_contract.secondary_check,
                "secondary_joints": active_contract.secondary_joints,
                "oscillating_joints": active_contract.oscillating_joints,
                "spatial_requirements": active_contract.spatial_requirements.model_dump()
                if active_contract.spatial_requirements is not None
                else None,
            },
        )

    def _compute_subject_lock_confidence(
        self,
        payload: PoseAnalyzeRequest,
    ) -> float:
        assert payload.signals is not None
        average_visibility = payload.signals.visibility.average_visibility
        reliable_ratio = min(
            1.0,
            payload.signals.visibility.reliable_frame_count / max(len(payload.frames or []), 1),
        )
        return round(
            min(0.99, 0.45 + average_visibility * 0.35 + reliable_ratio * 0.2),
            3,
        )

    def _latest_joint_angles(self, payload: PoseAnalyzeRequest) -> dict[str, float]:
        assert payload.signals is not None
        if not payload.signals.angles:
            return {}
        latest = payload.signals.angles[-1]
        return {
            name: value
            for name, value in {
                "elbow": latest.elbow,
                "shoulder": latest.shoulder,
                "hip": latest.hip,
                "knee": latest.knee,
                "ankle": latest.ankle,
                "left_elbow": latest.left_elbow,
                "right_elbow": latest.right_elbow,
                "left_shoulder": latest.left_shoulder,
                "right_shoulder": latest.right_shoulder,
                "left_hip": latest.left_hip,
                "right_hip": latest.right_hip,
                "left_knee": latest.left_knee,
                "right_knee": latest.right_knee,
                "left_ankle": latest.left_ankle,
                "right_ankle": latest.right_ankle,
            }.items()
            if value is not None
        }

    def _build_landmark_signature(
        self,
        payload: PoseAnalyzeRequest,
    ) -> dict[str, object]:
        if not payload.frames:
            return {}
        first = payload.frames[0]
        last = payload.frames[-1]
        return {
            "frame_count": len(payload.frames),
            "first_capture_ms": first.captured_at_ms,
            "last_capture_ms": last.captured_at_ms,
            "landmark_schema": payload.landmark_schema,
        }

    def _build_feedback(
        self,
        exercise_name: str | None,
        payload: PoseAnalyzeRequest,
        *,
        subject_locked: bool,
    ) -> list[str]:
        feedback: list[str] = []
        if not subject_locked:
            feedback.append("Keep shoulders, hips, knees, and ankles visible in frame.")
        if payload.signals and not payload.signals.hip.stable:
            feedback.append("Stabilize the hips before expecting reliable rep guidance.")
        exercise_tip = self._exercise_feedback_tip(exercise_name)
        if exercise_tip is not None:
            feedback.append(exercise_tip)
        return self._dedupe_feedback(feedback)

    def _build_legacy_feedback(
        self,
        exercise_name: str | None,
        phase: str,
        rep_event: bool,
        has_movement_contract: bool,
    ) -> list[str]:
        feedback: list[str] = []
        exercise_tip = self._exercise_feedback_tip(exercise_name)
        if exercise_tip is not None:
            feedback.append(exercise_tip)
        if phase == "lowering":
            feedback.append("Lower with control and keep the camera view steady.")
        elif phase == "bottom":
            feedback.append("Pause briefly at the bottom before driving up.")
        elif phase == "rising":
            feedback.append("Drive through the concentric phase with control.")
        elif phase == "top":
            feedback.append("Stabilize at the top before beginning the next rep.")
        if rep_event:
            feedback.append("Rep counted cleanly.")
        feedback.append(
            "Heuristic native rep counting is active while the landmark runtime is still pending."
        )
        if not has_movement_contract:
            feedback.append("Lock the exercise manually if the detected movement drifts.")
        return self._dedupe_feedback(feedback)

    def _average_angles(self, payload: PoseAnalyzeRequest) -> dict[str, float]:
        assert payload.signals is not None
        values: dict[str, list[float]] = {
            "elbow": [],
            "shoulder": [],
            "hip": [],
            "knee": [],
            "ankle": [],
            "left_elbow": [],
            "right_elbow": [],
            "left_shoulder": [],
            "right_shoulder": [],
            "left_hip": [],
            "right_hip": [],
            "left_knee": [],
            "right_knee": [],
            "left_ankle": [],
            "right_ankle": [],
        }
        for entry in payload.signals.angles:
            if entry.elbow is not None:
                values["elbow"].append(entry.elbow)
            if entry.shoulder is not None:
                values["shoulder"].append(entry.shoulder)
            if entry.hip is not None:
                values["hip"].append(entry.hip)
            if entry.knee is not None:
                values["knee"].append(entry.knee)
            if entry.ankle is not None:
                values["ankle"].append(entry.ankle)
            if entry.left_elbow is not None:
                values["left_elbow"].append(entry.left_elbow)
            if entry.right_elbow is not None:
                values["right_elbow"].append(entry.right_elbow)
            if entry.left_shoulder is not None:
                values["left_shoulder"].append(entry.left_shoulder)
            if entry.right_shoulder is not None:
                values["right_shoulder"].append(entry.right_shoulder)
            if entry.left_hip is not None:
                values["left_hip"].append(entry.left_hip)
            if entry.right_hip is not None:
                values["right_hip"].append(entry.right_hip)
            if entry.left_knee is not None:
                values["left_knee"].append(entry.left_knee)
            if entry.right_knee is not None:
                values["right_knee"].append(entry.right_knee)
            if entry.left_ankle is not None:
                values["left_ankle"].append(entry.left_ankle)
            if entry.right_ankle is not None:
                values["right_ankle"].append(entry.right_ankle)
        return {
            name: round(mean(series), 3)
            for name, series in values.items()
            if series
        }

    def _angle_ranges(self, payload: PoseAnalyzeRequest) -> dict[str, float]:
        assert payload.signals is not None
        series = {
            "elbow": [],
            "shoulder": [],
            "hip": [],
            "knee": [],
            "ankle": [],
            "left_elbow": [],
            "right_elbow": [],
            "left_shoulder": [],
            "right_shoulder": [],
            "left_hip": [],
            "right_hip": [],
            "left_knee": [],
            "right_knee": [],
            "left_ankle": [],
            "right_ankle": [],
        }
        for entry in payload.signals.angles:
            if entry.elbow is not None:
                series["elbow"].append(entry.elbow)
            if entry.shoulder is not None:
                series["shoulder"].append(entry.shoulder)
            if entry.hip is not None:
                series["hip"].append(entry.hip)
            if entry.knee is not None:
                series["knee"].append(entry.knee)
            if entry.ankle is not None:
                series["ankle"].append(entry.ankle)
            if entry.left_elbow is not None:
                series["left_elbow"].append(entry.left_elbow)
            if entry.right_elbow is not None:
                series["right_elbow"].append(entry.right_elbow)
            if entry.left_shoulder is not None:
                series["left_shoulder"].append(entry.left_shoulder)
            if entry.right_shoulder is not None:
                series["right_shoulder"].append(entry.right_shoulder)
            if entry.left_hip is not None:
                series["left_hip"].append(entry.left_hip)
            if entry.right_hip is not None:
                series["right_hip"].append(entry.right_hip)
            if entry.left_knee is not None:
                series["left_knee"].append(entry.left_knee)
            if entry.right_knee is not None:
                series["right_knee"].append(entry.right_knee)
            if entry.left_ankle is not None:
                series["left_ankle"].append(entry.left_ankle)
            if entry.right_ankle is not None:
                series["right_ankle"].append(entry.right_ankle)
        return {
            name: round(max(values) - min(values), 3) if values else 0.0
            for name, values in series.items()
        }

    def _candidate_names(self, state: PoseSessionState) -> list[str]:
        candidate_names = [profile.canonical_name for profile in state.candidate_profiles]
        candidate_names.extend(state.starter_catalog)
        normalized = []
        for entry in candidate_names:
            cleaned = self._normalize_name(entry)
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        return normalized or list(KNOWN_EXERCISES)

    def _match_profile(
        self,
        state: PoseSessionState,
        exercise_name: str | None,
    ) -> CandidateProfileInput | None:
        if exercise_name is None:
            return None
        for profile in state.candidate_profiles:
            normalized_profile_name = self._normalize_name(profile.canonical_name)
            if normalized_profile_name == exercise_name:
                return profile
        return None

    def _normalize_name(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = "_".join(value.strip().lower().replace("-", " ").split())
        if not normalized:
            return None
        if "squat" in normalized:
            return "squat"
        if "bench" in normalized:
            return "bench_press"
        if "pull" in normalized or "chin" in normalized:
            return "pull_up"
        if "push" in normalized:
            return "push_up"
        if "curl" in normalized:
            return "bicep_curl"
        if "dip" in normalized:
            return "dip"
        if "shoulder" in normalized or "press" in normalized:
            return "shoulder_press"
        if "plank" in normalized:
            return "plank"
        return normalized

    def _exercise_feedback_tip(self, exercise_name: str | None) -> str | None:
        if exercise_name == "squat":
            return "Drive through your heels and keep the chest tall."
        if exercise_name == "push_up":
            return "Keep the body in one line and lower with control."
        if exercise_name == "pull_up":
            return "Pull until the elbows flex clearly, then lower with control."
        if exercise_name == "bench_press":
            return "Keep the wrists stacked and press through a consistent path."
        if exercise_name == "bicep_curl":
            return "Keep the elbows pinned and avoid swinging through the hips."
        if exercise_name == "dip":
            return "Keep both elbows moving together and press to a tall, controlled top lockout."
        if exercise_name == "shoulder_press":
            return "Brace the core and finish with a stable lockout."
        if exercise_name == "plank":
            return "Maintain a straight line from shoulders to ankles."
        return None

    def _compute_frame_signature(self, frame_b64: str) -> tuple[float, list[int]]:
        normalized = frame_b64.strip()
        if "," in normalized:
            normalized = normalized.split(",", 1)[1]
        try:
            raw_bytes = base64.b64decode(normalized + "=" * (-len(normalized) % 4))
        except Exception:
            raw_bytes = normalized.encode("utf-8", errors="ignore")
        if len(raw_bytes) < 24:
            raw_bytes = normalized.encode("utf-8", errors="ignore")
        if not raw_bytes:
            return 0.0, []
        step = max(len(raw_bytes) // 64, 1)
        samples = [raw_bytes[index] for index in range(0, len(raw_bytes), step)][:64]
        if not samples:
            return 0.0, []
        mean_byte = sum(samples) / (255 * len(samples))
        weighted_total = sum((index + 1) * value for index, value in enumerate(samples))
        weighted_denominator = 255 * max(sum(range(1, len(samples) + 1)), 1)
        weighted_mean = weighted_total / weighted_denominator
        edge_delta = (
            sum(
                abs(samples[index] - samples[index - 1])
                for index in range(1, len(samples))
            )
            / (255 * max(len(samples) - 1, 1))
        )
        signature = round(
            min(
                0.999,
                max(
                    0.0,
                    mean_byte * 0.35 + weighted_mean * 0.4 + edge_delta * 0.25,
                ),
            ),
            3,
        )
        return signature, samples

    def _compute_frame_change_score(
        self,
        current_samples: list[int],
        previous_samples: list[int],
    ) -> float:
        if not current_samples or not previous_samples:
            return 0.0
        size = min(len(current_samples), len(previous_samples))
        if size == 0:
            return 0.0
        return round(
            sum(
                abs(current_samples[index] - previous_samples[index])
                for index in range(size)
            )
            / (255 * size),
            3,
        )

    def _infer_legacy_exercise(
        self,
        state: PoseSessionState,
        payload: PoseAnalyzeRequest,
        frame_signature: float,
        frame_change_score: float,
    ) -> str | None:
        hinted = self._normalize_name(payload.exercise_hint or state.exercise_hint)
        if hinted is not None:
            return hinted
        if state.detected_exercise_name is not None:
            return state.detected_exercise_name
        candidates = self._candidate_names(state)
        if not candidates:
            return None
        scored = sorted(
            (
                (
                    self._score_legacy_candidate(
                        candidate,
                        frame_signature,
                        frame_change_score,
                    ),
                    candidate,
                )
                for candidate in candidates
            ),
            reverse=True,
        )
        return scored[0][1] if scored else None

    def _score_legacy_candidate(
        self,
        exercise_name: str,
        frame_signature: float,
        frame_change_score: float,
    ) -> float:
        anchor = {
            "bench_press": 0.42,
            "bicep_curl": 0.53,
            "dip": 0.47,
            "plank": 0.31,
            "push_up": 0.37,
            "pull_up": 0.44,
            "shoulder_press": 0.59,
            "squat": 0.48,
        }.get(exercise_name, 0.5)
        motion_preference = {
            "bench_press": 0.026,
            "bicep_curl": 0.022,
            "dip": 0.024,
            "plank": 0.008,
            "push_up": 0.03,
            "pull_up": 0.026,
            "shoulder_press": 0.024,
            "squat": 0.028,
        }.get(exercise_name, 0.02)
        anchor_score = max(0.0, 1 - abs(frame_signature - anchor) * 3.2)
        motion_score = max(0.0, 1 - abs(frame_change_score - motion_preference) * 16)
        return round(anchor_score * 0.65 + motion_score * 0.35, 3)

    def _step_legacy_rep_counter(
        self,
        state: PoseSessionState,
        frame_signature: float,
        frame_change_score: float,
        exercise_name: str | None,
        frame_sample_count: int,
    ) -> tuple[str, bool, int]:
        history = [*state.legacy_signature_history, frame_signature][-6:]
        state.legacy_signature_history = history
        previous_phase = state.legacy_phase
        previous_signature = state.last_frame_signature
        if frame_sample_count < 24:
            phase = ("lowering", "bottom", "rising")[state.frames_analyzed % 3]
            rep_event = phase == "rising"
            rep_count_delta = 1 if rep_event else 0
            if rep_event:
                state.rep_count += 1
            state.legacy_phase = phase
            state.legacy_cycle_ready = phase != "rising"
            return phase, rep_event, rep_count_delta
        signature_range = max(history) - min(history) if history else 0.0
        movement_floor = {
            "plank": 0.012,
            "bicep_curl": 0.015,
            "dip": 0.017,
            "pull_up": 0.017,
            "shoulder_press": 0.017,
            "bench_press": 0.018,
            "push_up": 0.018,
            "squat": 0.02,
        }.get(exercise_name or "", 0.016)
        motion_active = frame_change_score >= movement_floor or signature_range >= movement_floor
        if previous_signature is None:
            phase = "lowering"
        elif not motion_active:
            phase = "primed"
        else:
            delta = frame_signature - previous_signature
            lower_bound = min(history) + signature_range * 0.3
            upper_bound = max(history) - signature_range * 0.3
            if signature_range >= movement_floor and frame_signature <= lower_bound:
                phase = "bottom" if delta <= 0 else "lowering"
            elif signature_range >= movement_floor and frame_signature >= upper_bound:
                phase = "top" if delta >= 0 else "rising"
            else:
                phase = "rising" if delta >= 0 else "lowering"

        rep_event = False
        rep_count_delta = 0
        if phase in {"bottom", "lowering"}:
            state.legacy_cycle_ready = True
        elif (
            state.legacy_cycle_ready
            and phase in {"rising", "top"}
            and previous_phase in {"bottom", "lowering"}
            and len(history) >= 3
            and motion_active
        ):
            rep_event = True
            rep_count_delta = 1
            state.rep_count += 1
            state.legacy_cycle_ready = False

        state.legacy_phase = phase
        return phase, rep_event, rep_count_delta

    def _compute_legacy_confidence(
        self,
        movement_contract: PoseMovementContract | None,
        frame_change_score: float,
        frame_signature: float,
        rep_event: bool,
    ) -> float:
        base_confidence = 0.66 + (0.1 if movement_contract is not None else 0.0)
        motion_bonus = min(0.12, frame_change_score * 1.8)
        signature_bonus = min(0.06, max(0.0, abs(frame_signature - 0.5)) * 0.4)
        rep_bonus = 0.04 if rep_event else 0.0
        return round(
            min(0.96, max(0.55, base_confidence + motion_bonus + signature_bonus + rep_bonus)),
            3,
        )

    def _compute_legacy_subject_lock_confidence(
        self,
        payload: PoseAnalyzeRequest,
        frame_change_score: float,
        has_movement_contract: bool,
    ) -> float:
        if not payload.frame_b64:
            return 0.0
        return round(
            min(
                0.95,
                0.68
                + min(0.12, frame_change_score * 1.6)
                + (0.05 if has_movement_contract else 0.0),
            ),
            3,
        )

    def _build_legacy_joint_angles(
        self,
        movement_contract: PoseMovementContract | None,
        phase: str,
        frame_signature: float,
    ) -> dict[str, float]:
        if movement_contract is None:
            return {}
        down_angle = movement_contract.rep_thresholds.down.angle
        up_angle = movement_contract.rep_thresholds.up.angle
        phase_progress = {
            "primed": 0.45,
            "lowering": 0.25,
            "bottom": 0.1,
            "rising": 0.72,
            "top": 0.92,
        }.get(phase, 0.5)
        signature_nudge = (frame_signature - 0.5) * 0.1
        progress = min(0.95, max(0.05, phase_progress + signature_nudge))
        dominant_angle = round(down_angle + (up_angle - down_angle) * progress, 1)
        if movement_contract.dominant_joint == "knee":
            return {
                "hip_knee_ankle": dominant_angle,
                "torso_hip_knee": round(max(45.0, dominant_angle - 18.0), 1),
            }
        if movement_contract.dominant_joint == "elbow":
            return {
                "shoulder_elbow_wrist": dominant_angle,
                "torso_shoulder_elbow": round(max(40.0, dominant_angle - 22.0), 1),
            }
        if movement_contract.dominant_joint == "shoulder":
            return {
                "hip_shoulder_elbow": dominant_angle,
                "shoulder_elbow_wrist": round(max(40.0, dominant_angle - 20.0), 1),
            }
        if movement_contract.dominant_joint == "ankle":
            return {
                "knee_ankle_foot_index": dominant_angle,
                "ankle": dominant_angle,
            }
        return {"torso_hip_knee": dominant_angle}

    def _normalize_joint_list(self, values: object) -> list[str]:
        if not isinstance(values, list):
            return []
        normalized: list[str] = []
        for value in values:
            if not isinstance(value, str):
                continue
            lowered = value.lower()
            if "elbow" in lowered or "wrist" in lowered:
                joint = "elbow"
            elif "shoulder" in lowered:
                joint = "shoulder"
            elif "hip" in lowered:
                joint = "hip"
            elif "ankle" in lowered:
                joint = "ankle"
            elif "knee" in lowered:
                joint = "knee"
            else:
                continue
            if joint not in normalized:
                normalized.append(joint)
        return normalized

    def _infer_joint_from_profile(self, profile: CandidateProfileInput) -> str:
        tracked_joint = profile.movement_pattern.get("tracked_joint")
        normalized = self._normalize_joint_list([tracked_joint] if tracked_joint else [])
        if normalized:
            return normalized[0]
        for candidate in ("knee", "ankle", "hip", "elbow", "shoulder"):
            if candidate in str(profile.angle_signature).lower():
                return candidate
        return "knee"

    def _coerce_thresholds(
        self,
        value: dict[str, object] | None,
        default_tolerance: float,
    ) -> PoseRepThresholdPair | None:
        if not isinstance(value, dict):
            return None
        down = value.get("down")
        up = value.get("up")
        if not isinstance(down, dict) or not isinstance(up, dict):
            return None
        if not isinstance(down.get("angle"), (int, float)) or not isinstance(up.get("angle"), (int, float)):
            return None
        return PoseRepThresholdPair(
            down=PoseRepThreshold(
                angle=float(down["angle"]),
                tolerance=float(down.get("tolerance", default_tolerance)),
            ),
            up=PoseRepThreshold(
                angle=float(up["angle"]),
                tolerance=float(up.get("tolerance", default_tolerance)),
            ),
        )

    def _thresholds_from_angle_signature(
        self,
        angle_signature: dict[str, object],
        dominant_joint: str,
        default_tolerance: float,
    ) -> PoseRepThresholdPair | None:
        bottom = angle_signature.get("bottom")
        top = angle_signature.get("top")
        if not isinstance(bottom, dict) or not isinstance(top, dict):
            return None

        def from_range(value: object) -> tuple[float, float] | None:
            if not isinstance(value, list) or len(value) != 2:
                return None
            start, end = value
            if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
                return None
            tolerance = max(default_tolerance, abs(float(end) - float(start)) / 2)
            angle = (float(start) + float(end)) / 2
            return round(angle, 3), round(tolerance, 3)

        keys = [dominant_joint, "knee", "ankle", "hip", "elbow", "shoulder"]
        down_value = None
        up_value = None
        for key in keys:
            if down_value is None:
                down_value = from_range(bottom.get(key))
            if up_value is None:
                up_value = from_range(top.get(key))
        if down_value is None or up_value is None:
            return None
        return PoseRepThresholdPair(
            down=PoseRepThreshold(angle=down_value[0], tolerance=down_value[1]),
            up=PoseRepThreshold(angle=up_value[0], tolerance=up_value[1]),
        )

    def _secondary_check(self, source: dict[str, object]) -> str:
        if "secondary_check" in source and isinstance(source["secondary_check"], str):
            return source["secondary_check"]
        keys = list(source.keys())
        return keys[0] if keys else "range_of_motion"

    def _dedupe_feedback(self, items: list[str]) -> list[str]:
        seen: list[str] = []
        for item in items:
            if item not in seen:
                seen.append(item)
        return seen

    def _get_session(self, pose_session_id: str) -> PoseSessionState:
        state = self._sessions.get(pose_session_id)
        if state is None:
            raise ServiceError(
                type="NOT_FOUND",
                title="Pose Session Not Found",
                status=404,
                detail=f"Pose session {pose_session_id} was not bootstrapped.",
            )
        return state
