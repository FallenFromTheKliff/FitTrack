from __future__ import annotations

from dataclasses import dataclass, field

from app.errors import ServiceError
from app.models.pose import (
    CandidateProfileInput,
    LearnedProfile,
    PoseAnalysisSummary,
    PoseAnalyzeRequest,
    PoseAnalyzeResponse,
    PoseBootstrapRequest,
    PoseBootstrapResponse,
    PoseFinalizeRequest,
    PoseFinalizeResponse,
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
    feedback_history: list[str] = field(default_factory=list)
    matched_profile_id: str | None = None
    detected_exercise_name: str | None = None
    last_phase: str | None = None
    last_joint_angles: dict[str, float] = field(default_factory=dict)


class PoseSessionService:
    accepted_fps = 15
    rep_interval_frames = 3

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
        state = self._get_session(payload.pose_session_id)
        state.frames_analyzed += 1

        frame_length = len(payload.frame_b64.strip())
        exercise_name = self._resolve_live_exercise_name(state)
        matched_profile_id = self._match_profile_id(state, exercise_name)
        rep_event = (
            exercise_name not in {"plank", "unknown"}
            and state.frames_analyzed % self.rep_interval_frames == 0
        )
        rep_delta = 1 if rep_event else 0
        confidence = round(
            min(0.99, 0.84 + ((frame_length + state.frames_analyzed) % 5) * 0.03),
            3,
        )
        subject_lock_confidence = round(
            min(0.99, 0.8 + ((frame_length + state.frames_analyzed) % 4) * 0.04),
            3,
        )
        phase = self._determine_phase(exercise_name, state.frames_analyzed)
        feedback = self._build_feedback(
            exercise_name,
            phase,
            state.frames_analyzed,
            rep_event,
        )

        state.rep_count += rep_delta
        state.confidence_total += confidence
        state.subject_lock_total += subject_lock_confidence
        state.matched_profile_id = matched_profile_id
        state.detected_exercise_name = None if exercise_name == "unknown" else exercise_name
        state.last_phase = phase
        state.last_joint_angles = self._build_joint_angles(
            exercise_name,
            state.frames_analyzed,
        )
        state.feedback_history.extend(feedback)

        return PoseAnalyzeResponse(
            rep_event=rep_event,
            rep_count_delta=rep_delta,
            confidence=confidence,
            exercise_class=exercise_name,
            matched_profile_id=matched_profile_id,
            subject_locked=True,
            subject_lock_confidence=subject_lock_confidence,
            phase=phase,
            form_feedback=feedback,
        )

    def finalize_session(
        self,
        payload: PoseFinalizeRequest,
    ) -> PoseFinalizeResponse:
        state = self._get_session(payload.pose_session_id)
        detected_exercise_name = self._resolve_finalize_exercise_name(state)
        matched_profile_id = state.matched_profile_id or self._match_profile_id(
            state,
            detected_exercise_name,
        )
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
            dominant_joint_angles=state.last_joint_angles
            or self._build_joint_angles(
                detected_exercise_name or "unknown",
                max(state.frames_analyzed, 1),
            ),
        )
        learned_profile = self._build_learned_profile(
            state,
            detected_exercise_name,
            matched_profile_id,
        )

        del self._sessions[payload.pose_session_id]

        return PoseFinalizeResponse(
            detected_exercise_name=detected_exercise_name,
            matched_profile_id=matched_profile_id,
            classification_confidence=average_confidence,
            subject_lock_confidence=subject_lock_confidence,
            analysis_summary=summary,
            learned_profile=learned_profile,
        )

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

    def _resolve_live_exercise_name(self, state: PoseSessionState) -> str:
        if state.detected_exercise_name is not None:
            return state.detected_exercise_name

        normalized_hint = self._normalize_hint(state.exercise_hint)
        if normalized_hint is not None:
            return normalized_hint

        if state.candidate_profiles:
            return state.candidate_profiles[0].canonical_name

        return "unknown"

    def _resolve_finalize_exercise_name(
        self,
        state: PoseSessionState,
    ) -> str | None:
        if state.detected_exercise_name is not None:
            return state.detected_exercise_name

        normalized_hint = self._normalize_hint(state.exercise_hint)
        if normalized_hint is not None:
            return normalized_hint

        if state.candidate_profiles:
            return state.candidate_profiles[0].canonical_name

        if state.starter_catalog:
            return state.starter_catalog[0]

        return None

    def _normalize_hint(self, exercise_hint: str | None) -> str | None:
        if exercise_hint is None:
            return None

        normalized = "_".join(exercise_hint.strip().lower().split())
        if not normalized:
            return None

        known_catalog = {
            "push_up": ("push_up", "pushup"),
            "squat": ("squat",),
            "bicep_curl": ("bicep_curl", "curl"),
            "shoulder_press": ("shoulder_press", "press"),
            "plank": ("plank",),
        }
        for canonical_name, aliases in known_catalog.items():
            if any(alias in normalized for alias in aliases):
                return canonical_name
        return normalized

    def _match_profile_id(
        self,
        state: PoseSessionState,
        exercise_name: str | None,
    ) -> str | None:
        if exercise_name is None:
            return None

        for candidate_profile in state.candidate_profiles:
            if candidate_profile.canonical_name == exercise_name:
                return candidate_profile.id
        return None

    def _determine_phase(self, exercise_name: str, frames_analyzed: int) -> str | None:
        if exercise_name == "plank":
            return "hold"
        if exercise_name == "unknown":
            return None

        cycle = frames_analyzed % self.rep_interval_frames
        if cycle == 1:
            return "lowering"
        if cycle == 2:
            return "bottom"
        return "rising"

    def _build_feedback(
        self,
        exercise_name: str,
        phase: str | None,
        frames_analyzed: int,
        rep_event: bool,
    ) -> list[str]:
        feedback: list[str] = []
        if exercise_name == "squat":
            feedback.append("Keep your chest up.")
            if phase == "bottom":
                feedback.append("Drive through your heels.")
        elif exercise_name == "push_up":
            feedback.append("Keep your core braced.")
        elif exercise_name == "bicep_curl":
            feedback.append("Keep your elbows tucked.")
        elif exercise_name == "shoulder_press":
            feedback.append("Stack wrists over elbows.")
        elif exercise_name == "plank":
            feedback.append("Maintain a straight line from shoulders to heels.")
        else:
            feedback.append("Center the athlete in frame.")

        if frames_analyzed % 2 == 0 and exercise_name != "unknown":
            feedback.append("Maintain a controlled tempo.")
        if rep_event:
            feedback.append("Rep counted cleanly.")
        return feedback

    def _build_joint_angles(
        self,
        exercise_name: str,
        frames_analyzed: int,
    ) -> dict[str, float]:
        if exercise_name == "squat":
            return {
                "hip_knee_ankle": round(92.0 + frames_analyzed * 0.4, 1),
                "torso_hip_knee": round(74.0 + frames_analyzed * 0.3, 1),
            }
        if exercise_name == "push_up":
            return {
                "shoulder_elbow_wrist": round(88.0 + frames_analyzed * 0.5, 1),
            }
        if exercise_name == "bicep_curl":
            return {
                "shoulder_elbow_wrist": round(52.0 + frames_analyzed * 0.6, 1),
            }
        if exercise_name == "shoulder_press":
            return {
                "hip_shoulder_elbow": round(101.0 + frames_analyzed * 0.5, 1),
            }
        if exercise_name == "plank":
            return {
                "shoulder_hip_ankle": round(176.0 - frames_analyzed * 0.2, 1),
            }
        return {
            "primary_chain": round(90.0 + frames_analyzed * 0.2, 1),
        }

    def _build_learned_profile(
        self,
        state: PoseSessionState,
        detected_exercise_name: str | None,
        matched_profile_id: str | None,
    ) -> LearnedProfile | None:
        if (
            detected_exercise_name is None
            or matched_profile_id is not None
            or state.frames_analyzed == 0
        ):
            return None

        return LearnedProfile(
            canonical_name=detected_exercise_name,
            landmark_signature={
                "left_shoulder": [
                    round(0.1 + state.frames_analyzed * 0.01, 3),
                    round(0.2 + state.rep_count * 0.01, 3),
                ],
                "right_hip": [
                    round(0.3 + state.frames_analyzed * 0.01, 3),
                    round(0.4 + state.rep_count * 0.01, 3),
                ],
            },
            angle_signature={
                key: value for key, value in state.last_joint_angles.items()
            },
            rep_rules={
                "rep_interval_frames": self.rep_interval_frames,
                "phase_hint": state.last_phase or "steady",
            },
        )

    def _dedupe_feedback(self, feedback_history: list[str]) -> list[str]:
        deduped: list[str] = []
        for item in feedback_history:
            if item not in deduped:
                deduped.append(item)
        return deduped
