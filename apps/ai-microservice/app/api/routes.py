from __future__ import annotations

from fastapi import APIRouter

from ..models.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantPlanRequest,
    AssistantPlanResponse,
)
from ..models.business_insights import (
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
)
from ..models.equipment import EquipmentDetectRequest, EquipmentDetectResponse
from ..models.exercise_drafts import (
    ExerciseDraftProposalRequest,
    ExerciseDraftProposalResponse,
)
from ..models.gym_chat import GymChatRequest, GymChatResponse
from ..models.nutrition import CalculateTdeeRequest, CalculateTdeeResponse
from ..models.pose import (
    HealthResponse,
    PoseAnalyzeRequest,
    PoseAnalyzeResponse,
    PoseBootstrapRequest,
    PoseBootstrapResponse,
    PoseFinalizeRequest,
    PoseFinalizeResponse,
)
from ..services.assistant import AssistantService
from ..services.business_insights import BusinessInsightService
from ..services.equipment_detection import EquipmentDetectionService
from ..services.exercise_drafts import ExerciseDraftProposalService
from ..services.gym_chat import GymChatService
from ..services.nutrition import NutritionService
from ..services.pose_sessions import PoseSessionService

router = APIRouter()
assistant_service = AssistantService()
business_insight_service = BusinessInsightService()
equipment_detection_service = EquipmentDetectionService()
exercise_draft_proposal_service = ExerciseDraftProposalService()
gym_chat_service = GymChatService()
nutrition_service = NutritionService()
pose_session_service = PoseSessionService()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


# Assistant endpoints intentionally stay explicit here so the mounted
# FitTrack API and the raw microservice expose the same contract surface.
@router.post("/chat", response_model=AssistantChatResponse)
def chat(payload: AssistantChatRequest) -> AssistantChatResponse:
    return assistant_service.reply_to_message(payload)


@router.post("/chat/gym", response_model=GymChatResponse)
def chat_gym(payload: GymChatRequest) -> GymChatResponse:
    return gym_chat_service.reply_to_message(payload)


@router.post("/generate-plan", response_model=AssistantPlanResponse)
def generate_plan(payload: AssistantPlanRequest) -> AssistantPlanResponse:
    return assistant_service.generate_plan(payload)


@router.post(
    "/analytics/insights",
    response_model=BusinessAnalyticsInsightResponse,
)
def generate_business_insight(
    payload: BusinessAnalyticsInsightRequest,
) -> BusinessAnalyticsInsightResponse:
    return business_insight_service.generate_insight(payload)


@router.post("/calculate-tdee", response_model=CalculateTdeeResponse)
def calculate_tdee(payload: CalculateTdeeRequest) -> CalculateTdeeResponse:
    return nutrition_service.calculate_tdee(payload)


@router.post("/equipment/detect", response_model=EquipmentDetectResponse)
def detect_equipment(payload: EquipmentDetectRequest) -> EquipmentDetectResponse:
    return equipment_detection_service.detect(payload)


@router.post("/exercise-drafts/propose", response_model=ExerciseDraftProposalResponse)
def propose_exercise_draft(
    payload: ExerciseDraftProposalRequest,
) -> ExerciseDraftProposalResponse:
    return exercise_draft_proposal_service.propose(payload)


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
