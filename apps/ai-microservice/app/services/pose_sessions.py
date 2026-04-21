from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean

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
    PoseMovementContract,
    PoseRepThreshold,
    PoseRepThresholdPair,
)


KNOWN_EXERCISES = (
    "push_up",
    "bench_press",
    "squat",
    "bicep_curl",
    "shoulder_press",
    "plank",
)


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


class PoseSessionService:
    accepted_fps = 15
    confirmation_threshold = 0.80
    min_reliable_frames = 6
    fallback_tolerance = 12.0

    def __init__(self) -> None:
        self._sessions: dict[str, PoseSessionState] = {}

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
            state.last_rep_rules = {
                "secondary_check": classification["movement_contract"].secondary_check,
                "rep_thresholds": classification["movement_contract"].rep_thresholds.model_dump(),
            }

        return PoseAnalyzeResponse(
            confidence=classification["confidence"],
            exercise_class=classification["exercise_class"],
            matched_profile_id=classification["matched_profile_id"],
            movement_contract=classification["movement_contract"],
            subject_locked=subject_locked,
            subject_lock_confidence=subject_lock_confidence,
            classification_source=classification["classification_source"],
            needs_confirmation=classification["needs_confirmation"],
            candidate_exercises=classification["candidate_exercises"],
            form_feedback=self._dedupe_feedback(classification["form_feedback"]),
            learned_profile=classification["learned_profile"],
        )

    def _analyze_legacy_frame(self, payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
        state = self._get_session(payload.pose_session_id)
        exercise_name = self._normalize_name(payload.exercise_hint or state.exercise_hint)
        profile = self._match_profile(state, exercise_name)
        movement_contract = self._build_contract_from_profile(profile) if profile else None
        confidence = 0.72 if movement_contract else 0.55
        subject_lock_confidence = 0.7 if payload.frame_b64 else 0.0
        state.frames_analyzed += 1
        state.confidence_total += confidence
        state.subject_lock_total += subject_lock_confidence
        if exercise_name:
            state.detected_exercise_name = exercise_name
        if profile:
            state.matched_profile_id = profile.id
            state.last_movement_contract = movement_contract

        return PoseAnalyzeResponse(
            confidence=confidence,
            exercise_class=exercise_name,
            matched_profile_id=profile.id if profile else None,
            movement_contract=movement_contract,
            subject_locked=bool(payload.frame_b64),
            subject_lock_confidence=subject_lock_confidence,
            classification_source="preset" if profile else "classifier",
            needs_confirmation=movement_contract is None,
            candidate_exercises=self._candidate_names(state),
            form_feedback=[
                "Legacy frame mode stays available for compatibility.",
                "Local rep counting is only enabled on the keypoint-sequence path.",
            ],
            learned_profile=None,
        )

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
        stable_hips = payload.signals.hip.stable
        wrist_visibility = payload.signals.visibility.wrist_visibility
        feet_visibility = payload.signals.visibility.feet_visibility
        oscillating = set(payload.signals.temporal.oscillating_joints)
        amplitudes = payload.signals.temporal.amplitudes
        total_motion = sum(amplitudes.values())

        scores = {name: 0.25 for name in KNOWN_EXERCISES}
        if "horizontal" in body_orientation or "prone" in body_orientation:
            scores["push_up"] += 0.25
            scores["bench_press"] += 0.18
            scores["plank"] += 0.12
        if "supine" in body_orientation:
            scores["bench_press"] += 0.3
        if "upright" in body_orientation or "inclined" in body_orientation:
            scores["squat"] += 0.18
            scores["bicep_curl"] += 0.16
            scores["shoulder_press"] += 0.16

        if angle_ranges["knee"] >= 28 or hip_range >= 0.04:
            scores["squat"] += 0.3
        if angle_ranges["elbow"] >= 24:
            scores["push_up"] += 0.18
            scores["bench_press"] += 0.14
            scores["bicep_curl"] += 0.12
        if angle_ranges["shoulder"] >= 20:
            scores["shoulder_press"] += 0.2
        if stable_hips:
            scores["bicep_curl"] += 0.08
            scores["bench_press"] += 0.05
        if not stable_hips and hip_range >= 0.05:
            scores["push_up"] += 0.06
            scores["squat"] += 0.08
        if "knee" in oscillating or "hip" in oscillating:
            scores["squat"] += 0.12
        if "elbow" in oscillating:
            scores["push_up"] += 0.1
            scores["bicep_curl"] += 0.08
            scores["bench_press"] += 0.06
        if "shoulder" in oscillating:
            scores["shoulder_press"] += 0.1
        if total_motion <= 0.05 and stable_hips:
            scores["plank"] += 0.3
        if feet_visibility < 0.4:
            scores["bench_press"] += 0.08
        if wrist_visibility >= 0.6:
            scores["push_up"] += 0.05
            scores["shoulder_press"] += 0.05

        if normalized_hint and normalized_hint in scores:
            scores[normalized_hint] += 0.08

        return {name: round(min(score, 0.99), 3) for name, score in scores.items()}

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
        oscillating_joints = self._normalize_joint_list(
            movement_pattern.get("oscillating_landmarks")
        )
        secondary_check = self._secondary_check(
            profile.rep_rules or movement_pattern or {}
        )
        return PoseMovementContract(
            exercise=profile.canonical_name,
            dominant_joint=dominant_joint,
            rep_thresholds=rep_thresholds,
            secondary_check=secondary_check,
            oscillating_joints=oscillating_joints,
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
            "bench_press": "elbow",
            "bicep_curl": "elbow",
            "shoulder_press": "shoulder",
            "plank": "hip",
        }.get(exercise_name, "knee")
        angle_ranges = self._angle_ranges(payload)
        average_angles = self._average_angles(payload)
        dominant_average = average_angles.get(dominant_joint, 120.0)
        dominant_range = angle_ranges.get(dominant_joint, 30.0)
        tolerance = max(self.fallback_tolerance, round(dominant_range / 3, 3))
        down_angle = max(45.0, round(dominant_average - dominant_range / 2, 3))
        up_angle = min(175.0, round(dominant_average + dominant_range / 2 + 12.0, 3))
        secondary_check = {
            "squat": "hip_depth",
            "push_up": "body_line",
            "bench_press": "bar_path",
            "bicep_curl": "hip_stability",
            "shoulder_press": "lockout_control",
            "plank": "core_alignment",
        }.get(exercise_name, "range_of_motion")
        oscillating_joints = (
            payload.signals.temporal.oscillating_joints or [dominant_joint]
        )
        return PoseMovementContract(
            exercise=exercise_name,
            dominant_joint=dominant_joint,
            rep_thresholds=PoseRepThresholdPair(
                down=PoseRepThreshold(angle=down_angle, tolerance=tolerance),
                up=PoseRepThreshold(angle=up_angle, tolerance=tolerance),
            ),
            secondary_check=secondary_check,
            oscillating_joints=self._normalize_joint_list(oscillating_joints)
            or [dominant_joint],
        )

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
                "secondary_check": active_contract.secondary_check,
                "oscillating_joints": active_contract.oscillating_joints,
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
        if exercise_name == "squat":
            feedback.append("Drive through your heels and keep the chest tall.")
        elif exercise_name == "push_up":
            feedback.append("Keep the body in one line and lower with control.")
        elif exercise_name == "bench_press":
            feedback.append("Keep the wrists stacked and press through a consistent path.")
        elif exercise_name == "bicep_curl":
            feedback.append("Keep the elbows pinned and avoid swinging through the hips.")
        elif exercise_name == "shoulder_press":
            feedback.append("Brace the core and finish with a stable lockout.")
        elif exercise_name == "plank":
            feedback.append("Maintain a straight line from shoulders to ankles.")
        return self._dedupe_feedback(feedback)

    def _average_angles(self, payload: PoseAnalyzeRequest) -> dict[str, float]:
        assert payload.signals is not None
        values: dict[str, list[float]] = {"elbow": [], "shoulder": [], "hip": [], "knee": []}
        for entry in payload.signals.angles:
            if entry.elbow is not None:
                values["elbow"].append(entry.elbow)
            if entry.shoulder is not None:
                values["shoulder"].append(entry.shoulder)
            if entry.hip is not None:
                values["hip"].append(entry.hip)
            if entry.knee is not None:
                values["knee"].append(entry.knee)
        return {
            name: round(mean(series), 3)
            for name, series in values.items()
            if series
        }

    def _angle_ranges(self, payload: PoseAnalyzeRequest) -> dict[str, float]:
        assert payload.signals is not None
        series = {"elbow": [], "shoulder": [], "hip": [], "knee": []}
        for entry in payload.signals.angles:
            if entry.elbow is not None:
                series["elbow"].append(entry.elbow)
            if entry.shoulder is not None:
                series["shoulder"].append(entry.shoulder)
            if entry.hip is not None:
                series["hip"].append(entry.hip)
            if entry.knee is not None:
                series["knee"].append(entry.knee)
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
        if "push" in normalized:
            return "push_up"
        if "curl" in normalized:
            return "bicep_curl"
        if "shoulder" in normalized or "press" in normalized:
            return "shoulder_press"
        if "plank" in normalized:
            return "plank"
        return normalized

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
            elif "knee" in lowered or "ankle" in lowered:
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
        for candidate in ("knee", "hip", "elbow", "shoulder"):
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

        keys = [dominant_joint, "knee", "hip", "elbow", "shoulder"]
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
