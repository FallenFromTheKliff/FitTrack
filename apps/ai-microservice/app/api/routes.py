from __future__ import annotations

from fastapi import APIRouter

from app.models.business_insights import (
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
)
from app.models.gym_chat import GymChatRequest, GymChatResponse
from app.models.pose import (
    HealthResponse,
    PoseAnalyzeRequest,
    PoseAnalyzeResponse,
    PoseBootstrapRequest,
    PoseBootstrapResponse,
    PoseFinalizeRequest,
    PoseFinalizeResponse,
)
from app.services.business_insights import BusinessInsightService
from app.services.gym_chat import GymChatService
from app.services.pose_sessions import PoseSessionService

router = APIRouter()
business_insight_service = BusinessInsightService()
gym_chat_service = GymChatService()
pose_session_service = PoseSessionService()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.post("/chat/gym", response_model=GymChatResponse)
def chat_gym(payload: GymChatRequest) -> GymChatResponse:
    return gym_chat_service.reply_to_message(payload)


@router.post(
    "/analytics/insights",
    response_model=BusinessAnalyticsInsightResponse,
)
def generate_business_insight(
    payload: BusinessAnalyticsInsightRequest,
) -> BusinessAnalyticsInsightResponse:
    return business_insight_service.generate_insight(payload)


@router.post("/pose/session/bootstrap", response_model=PoseBootstrapResponse)
def bootstrap_pose_session(
    payload: PoseBootstrapRequest,
) -> PoseBootstrapResponse:
    return pose_session_service.bootstrap_session(payload)


@router.post("/pose/analyze", response_model=PoseAnalyzeResponse)
def analyze_pose_frame(payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
    return pose_session_service.analyze_frame(payload)


@router.post("/pose/session/finalize", response_model=PoseFinalizeResponse)
def finalize_pose_session(
    payload: PoseFinalizeRequest,
) -> PoseFinalizeResponse:
    return pose_session_service.finalize_session(payload)
