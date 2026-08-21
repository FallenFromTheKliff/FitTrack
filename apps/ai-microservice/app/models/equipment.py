from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


EquipmentContext = Literal[
    "bodyweight",
    "dumbbell",
    "barbell",
    "cable",
    "machine",
    "kettlebell",
    "band",
    "bench",
    "mixed",
    "unknown",
]


class EquipmentDetectRequest(StrictModel):
    frame_b64: str = Field(min_length=1)
    camera_facing_mode: Literal["user", "environment"] | None = None
    exercise_hint: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_frame(self) -> "EquipmentDetectRequest":
        if not self.frame_b64.strip():
            raise ValueError("frame_b64 must not be blank")
        return self


class EquipmentDetectionBox(StrictModel):
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    height: float | None = Field(default=None, ge=0.0)
    label: str | None = None
    width: float | None = Field(default=None, ge=0.0)
    x: float | None = Field(default=None, ge=0.0)
    y: float | None = Field(default=None, ge=0.0)


class EquipmentDetectResponse(StrictModel):
    equipment_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    equipment_conflicts: list[str] = Field(default_factory=list)
    equipment_context: EquipmentContext | None = None
    equipment_detections: list[EquipmentDetectionBox] = Field(default_factory=list)
    equipment_family: EquipmentContext | None = None
