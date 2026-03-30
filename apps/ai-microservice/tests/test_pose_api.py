from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.routes import pose_session_service
from app.main import app


@pytest.fixture(autouse=True)
def reset_sessions() -> None:
    pose_session_service.reset()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_route_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


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
        "accepted_fps": 15,
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
    assert first_response.json() == {
        "rep_event": False,
        "rep_count_delta": 0,
        "confidence": 0.84,
        "exercise_class": "squat",
        "matched_profile_id": "profile-1",
        "subject_locked": True,
        "subject_lock_confidence": 0.92,
        "phase": "lowering",
        "form_feedback": ["Keep your chest up."],
    }
    assert second_response.status_code == 200
    assert second_response.json()["phase"] == "bottom"
    assert second_response.json()["form_feedback"] == [
        "Keep your chest up.",
        "Drive through your heels.",
        "Maintain a controlled tempo.",
    ]
    assert third_response.status_code == 200
    assert third_response.json() == {
        "rep_event": True,
        "rep_count_delta": 1,
        "confidence": 0.9,
        "exercise_class": "squat",
        "matched_profile_id": "profile-1",
        "subject_locked": True,
        "subject_lock_confidence": 0.84,
        "phase": "rising",
        "form_feedback": ["Keep your chest up.", "Rep counted cleanly."],
    }


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
    assert "body.frame_b64" in payload["detail"]


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
    assert response.json() == {
        "detected_exercise_name": "squat",
        "matched_profile_id": "profile-1",
        "classification_confidence": 0.87,
        "subject_lock_confidence": 0.853,
        "analysis_summary": {
            "reps_detected": 1,
            "form_feedback": [
                "Keep your chest up.",
                "Drive through your heels.",
                "Maintain a controlled tempo.",
                "Rep counted cleanly.",
            ],
            "average_confidence": 0.87,
            "dominant_joint_angles": {
                "hip_knee_ankle": 93.2,
                "torso_hip_knee": 74.9,
            },
        },
        "learned_profile": None,
    }


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
    assert payload["learned_profile"] == {
        "canonical_name": "push_up",
        "landmark_signature": {
            "left_shoulder": [0.11, 0.2],
            "right_hip": [0.31, 0.4],
        },
        "angle_signature": {"shoulder_elbow_wrist": 88.5},
        "rep_rules": {"rep_interval_frames": 3, "phase_hint": "lowering"},
    }


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
