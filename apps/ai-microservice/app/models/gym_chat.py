from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GymOperatingHoursItem(StrictModel):
    day_of_week: int = Field(ge=0, le=6)
    opens_at: str = Field(min_length=1, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    closes_at: str = Field(min_length=1, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    is_closed: bool
    label: str | None = None


class GymSpecialScheduleItem(StrictModel):
    starts_on: date
    ends_on: date
    opens_at: str | None = Field(
        default=None,
        pattern=r"^\d{2}:\d{2}(:\d{2})?$",
    )
    closes_at: str | None = Field(
        default=None,
        pattern=r"^\d{2}:\d{2}(:\d{2})?$",
    )
    is_closed: bool
    reason: str = Field(min_length=1)
    pricing_note: str | None = None


class GymPromotionItem(StrictModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    promo_code: str | None = None
    starts_at: datetime
    ends_at: datetime
    pricing_note: str | None = None


class GymFaqItem(StrictModel):
    category: str = Field(min_length=1)
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    keywords: list[str] | None = None


class GymMembershipPlanItem(StrictModel):
    name: str = Field(min_length=1)
    price: str = Field(min_length=1)
    duration_days: int = Field(gt=0)
    description: str | None = None


class GymSessionHistoryItem(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class GymUserContext(StrictModel):
    first_name: str | None = None
    role: str = Field(min_length=1)
    active_membership: bool | None = None


class GymChatGroundingPayload(StrictModel):
    operating_hours: list[GymOperatingHoursItem]
    special_schedules: list[GymSpecialScheduleItem]
    promotions: list[GymPromotionItem]
    faqs: list[GymFaqItem]
    membership_plans: list[GymMembershipPlanItem]
    session_history: list[GymSessionHistoryItem]
    user_context: GymUserContext | None = None


class GymChatPolicy(StrictModel):
    gym_only: Literal[True]
    refuse_out_of_scope: Literal[True]


class GymChatRequest(StrictModel):
    session_id: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=2000)
    grounding: GymChatGroundingPayload
    policy: GymChatPolicy


class GymChatResponse(StrictModel):
    reply: str = Field(min_length=1)
    out_of_scope: bool
    sources: list[str]
    follow_up_suggestions: list[str]
    model_used: str | None = None
    token_count: int | None = Field(default=None, ge=0)
