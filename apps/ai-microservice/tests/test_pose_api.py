from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes import equipment_detection_service, pose_session_service
from app.main import app
from app.models.pose import PoseAngleSignalEntry, PoseKeypoint, PoseMovementContract
from app.services.pose_sessions import PoseSessionService


@pytest.fixture(autouse=True)
def reset_sessions() -> None:
    pose_session_service.reset()
    equipment_detection_service.reset()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_route_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ankle_contract_and_landmark_angle_are_supported() -> None:
    contract = PoseMovementContract.model_validate(
        {
            "exercise": "calf_raise",
            "dominant_joint": "ankle",
            "rep_thresholds": {
                "down": {"angle": 80, "tolerance": 10},
                "up": {"angle": 115, "tolerance": 10},
            },
            "secondary_check": "calf_raise_vertical_control",
            "oscillating_joints": ["ankle"],
            "rep_model": "bilateral",
            "required_sides": "both",
            "primary_joints": ["left_ankle", "right_ankle"],
        }
    )
    angle_signal = PoseAngleSignalEntry(
        captured_at_ms=0,
        ankle=90,
        left_ankle=90,
        right_ankle=90,
    )
    def point(x: float, y: float) -> PoseKeypoint:
        return PoseKeypoint(x=x, y=y, z=0, visibility=1)
    keypoints = [point(0, 0) for _ in range(33)]
    keypoints[25] = point(0, 1)
    keypoints[27] = point(0, 0)
    keypoints[31] = point(1, 0)
    keypoints[26] = point(0, -1)
    keypoints[28] = point(0, 0)
    keypoints[32] = point(1, 0)

    signals = PoseSessionService()._build_keypoint_angle_signals(keypoints)

    assert contract.dominant_joint == "ankle"
    assert angle_signal.left_ankle == 90
    assert signals == {"left_ankle": 90.0, "right_ankle": 90.0, "ankle": 90.0}


def test_equipment_detect_reports_missing_local_model(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "EQUIPMENT_DETECTION_MODEL_PATH",
        str(Path.cwd() / "missing-equipment-model.pt"),
    )
    equipment_detection_service.reset()

    response = client.post(
        "/equipment/detect",
        json={"frame_b64": "placeholder-frame"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "equipment_confidence": None,
        "equipment_conflicts": ["equipment_model_unavailable"],
        "equipment_context": None,
        "equipment_detections": [],
        "equipment_family": "unknown",
    }


def test_bootstrap_returns_ready_payload(client: TestClient) -> None:
    response = client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-1",
            "exercise_hint": "Barbell Back Squat",
            "starter_catalog": ["squat", "push_up"],
            "candidate_profiles": [
                {
                    "id": "profile-1",
                    "canonical_name": "squat",
                    "profile_kind": "seed",
                    "landmark_signature": {"left_shoulder": [0.1, 0.2]},
                    "angle_signature": {"hip_knee_ankle": 92.4},
                    "rep_rules": {"rep_start_angle": 88},
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "accepted_fps": 20,
        "subject_lock_mode": "single_subject",
    }


def test_bootstrap_returns_422_for_invalid_profile_kind(client: TestClient) -> None:
    response = client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-1",
            "exercise_hint": "Barbell Back Squat",
            "starter_catalog": ["squat", "push_up"],
            "candidate_profiles": [
                {
                    "id": "profile-1",
                    "canonical_name": "squat",
                    "profile_kind": "unsupported",
                    "landmark_signature": {"left_shoulder": [0.1, 0.2]},
                    "angle_signature": {"hip_knee_ankle": 92.4},
                }
            ],
        },
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "body.candidate_profiles.0.profile_kind" in payload["detail"]


def test_analyze_returns_deterministic_pose_payload(client: TestClient) -> None:
    client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-1",
            "exercise_hint": "Barbell Back Squat",
            "starter_catalog": ["squat", "push_up"],
            "candidate_profiles": [
                {
                    "id": "profile-1",
                    "canonical_name": "squat",
                    "profile_kind": "seed",
                    "landmark_signature": {"left_shoulder": [0.1, 0.2]},
                    "angle_signature": {"hip_knee_ankle": 92.4},
                    "rep_rules": {"rep_start_angle": 88},
                }
            ],
        },
    )

    first_response = client.post(
        "/pose/analyze",
        json={"pose_session_id": "pose-1", "frame_b64": "frame-data-001"},
    )
    second_response = client.post(
        "/pose/analyze",
        json={"pose_session_id": "pose-1", "frame_b64": "frame-data-002"},
    )
    third_response = client.post(
        "/pose/analyze",
        json={"pose_session_id": "pose-1", "frame_b64": "frame-data-003"},
    )

    assert first_response.status_code == 200
    first_payload = first_response.json()
    second_payload = second_response.json()
    third_payload = third_response.json()

    assert first_payload["rep_event"] is False
    assert first_payload["rep_count_delta"] == 0
    assert first_payload["rep_count_total"] == 0
    assert first_payload["exercise_class"] == "squat"
    assert first_payload["matched_profile_id"] == "profile-1"
    assert first_payload["subject_locked"] is True
    assert first_payload["phase"] == "lowering"
    assert first_payload["classification_source"] == "preset"
    assert first_payload["needs_confirmation"] is False
    assert first_payload["processing_mode"] == "legacy_frame"
    assert "Heuristic native rep counting is active" in " ".join(
        first_payload["form_feedback"]
    )
    assert second_response.status_code == 200
    assert second_payload["phase"] == "bottom"
    assert second_payload["rep_count_total"] == 0
    assert "Pause briefly at the bottom" in " ".join(second_payload["form_feedback"])
    assert third_response.status_code == 200
    assert third_payload["rep_event"] is True
    assert third_payload["rep_count_delta"] == 1
    assert third_payload["rep_count_total"] == 1
    assert third_payload["phase"] == "rising"
    assert third_payload["classification_source"] == "preset"
    assert "Rep counted cleanly." in third_payload["form_feedback"]


def test_analyze_returns_422_for_empty_frame_payload(client: TestClient) -> None:
    client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-1",
            "exercise_hint": "Barbell Back Squat",
            "starter_catalog": ["squat", "push_up"],
            "candidate_profiles": [],
        },
    )

    response = client.post(
        "/pose/analyze",
        json={"pose_session_id": "pose-1", "frame_b64": ""},
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "either frame_b64 or frames must be provided" in payload["detail"]


def test_finalize_returns_summary_and_no_learned_profile_when_match_exists(
    client: TestClient,
) -> None:
    client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-1",
            "exercise_hint": "Barbell Back Squat",
            "starter_catalog": ["squat", "push_up"],
            "candidate_profiles": [
                {
                    "id": "profile-1",
                    "canonical_name": "squat",
                    "profile_kind": "seed",
                    "landmark_signature": {"left_shoulder": [0.1, 0.2]},
                    "angle_signature": {"hip_knee_ankle": 92.4},
                    "rep_rules": {"rep_start_angle": 88},
                }
            ],
        },
    )
    for frame in ("frame-data-001", "frame-data-002", "frame-data-003"):
        client.post(
            "/pose/analyze",
            json={"pose_session_id": "pose-1", "frame_b64": frame},
        )

    response = client.post(
        "/pose/session/finalize",
        json={"pose_session_id": "pose-1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["detected_exercise_name"] == "squat"
    assert payload["matched_profile_id"] == "profile-1"
    assert payload["classification_confidence"] is not None
    assert payload["subject_lock_confidence"] is not None
    assert payload["analysis_summary"]["reps_detected"] == 1
    assert "Rep counted cleanly." in payload["analysis_summary"]["form_feedback"]
    assert payload["analysis_summary"]["dominant_joint_angles"]["hip_knee_ankle"] > 0
    assert payload["learned_profile"] is None


def test_finalize_can_emit_learned_profile_without_candidate_match(
    client: TestClient,
) -> None:
    client.post(
        "/pose/session/bootstrap",
        json={
            "pose_session_id": "pose-2",
            "exercise_hint": "Push Up",
            "starter_catalog": ["push_up", "squat"],
            "candidate_profiles": [],
        },
    )
    client.post(
        "/pose/analyze",
        json={"pose_session_id": "pose-2", "frame_b64": "frame-data-001"},
    )

    response = client.post(
        "/pose/session/finalize",
        json={"pose_session_id": "pose-2"},
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["detected_exercise_name"] == "push_up"
    assert payload["matched_profile_id"] is None
    assert payload["learned_profile"] is not None
    assert payload["learned_profile"]["canonical_name"] == "push_up"
    assert payload["learned_profile"]["dominant_joint"] == "elbow"
    assert payload["learned_profile"]["rep_thresholds"]["down"]["angle"] > 0
    assert payload["learned_profile"]["movement_pattern"]["phase"] == "lowering"


def test_finalize_returns_422_for_blank_pose_session_id(client: TestClient) -> None:
    response = client.post(
        "/pose/session/finalize",
        json={"pose_session_id": ""},
    )

    payload = response.json()

    assert response.status_code == 422
    assert payload["type"] == "INVALID_REQUEST"
    assert payload["title"] == "Invalid Request"
    assert payload["status"] == 422
    assert "body.pose_session_id" in payload["detail"]


def test_analyze_returns_rfc7807_error_for_unknown_session(client: TestClient) -> None:
    response = client.post(
        "/pose/analyze",
        json={"pose_session_id": "missing-session", "frame_b64": "frame-data-001"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "type": "NOT_FOUND",
        "title": "Pose Session Not Found",
        "status": 404,
        "detail": "Pose session missing-session was not bootstrapped.",
    }


def test_finalize_returns_rfc7807_error_for_unknown_session(
    client: TestClient,
) -> None:
    response = client.post(
        "/pose/session/finalize",
        json={"pose_session_id": "missing-session"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "type": "NOT_FOUND",
        "title": "Pose Session Not Found",
        "status": 404,
        "detail": "Pose session missing-session was not bootstrapped.",
    }
