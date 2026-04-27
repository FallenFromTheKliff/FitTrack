from __future__ import annotations

import base64
import io
import logging
import os
import re
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from ..errors import ServiceError
from ..models.equipment import (
    EquipmentContext,
    EquipmentDetectRequest,
    EquipmentDetectResponse,
    EquipmentDetectionBox,
)


DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parents[2] / "models" / "gym-equipment" / "best.pt"
)
DEFAULT_CONFIDENCE_THRESHOLD = 0.35
MODEL_UNAVAILABLE_CONFLICT = "equipment_model_unavailable"
MODEL_DEPENDENCY_MISSING_CONFLICT = "equipment_model_dependency_missing"
LOGGER = logging.getLogger(__name__)


def _normalize_label(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("_", " ").replace("-", " ")).strip().lower()


def _to_float(value: Any) -> float | None:
    try:
        if hasattr(value, "item"):
            value = value.item()
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in {float("inf"), float("-inf")} else None


def _to_unit(value: float, size: int) -> float:
    if size <= 0:
        return 0.0
    return round(max(0.0, min(1.0, value / size)), 6)


def _label_to_context(label: str | None) -> EquipmentContext | None:
    normalized = _normalize_label(label)
    if not normalized:
        return None
    if re.search(r"\b(dumbbell|dumbbells|dumbell|dumbells|db|free weight|hand weight)\b", normalized):
        return "dumbbell"
    if re.search(r"\b(barbell|olympic bar|ez bar)\b", normalized):
        return "barbell"
    if re.search(r"\b(cable|lat pulldown|pulldown|row handle|handle attachment)\b", normalized):
        return "cable"
    if re.search(r"\b(machine|chest press|leg press|smith)\b", normalized):
        return "machine"
    if re.search(r"\b(kettlebell|kettlebells)\b", normalized):
        return "kettlebell"
    if re.search(r"\b(resistance band|band)\b", normalized):
        return "band"
    if re.search(r"\b(bench|flat bench|incline bench)\b", normalized):
        return "bench"
    return None


def _model_label(model_names: dict[int, str] | list[str], class_index: int) -> str | None:
    if isinstance(model_names, dict):
        return model_names.get(class_index)
    if 0 <= class_index < len(model_names):
        return model_names[class_index]
    return None


def _resolve_equipment_context(labels: list[str | None]) -> EquipmentContext | None:
    contexts = {
        context for context in (_label_to_context(label) for label in labels) if context
    }
    if not contexts:
        return None
    return "mixed" if len(contexts) > 1 else next(iter(contexts))


class EquipmentDetectionService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_path: Path | None = None
        self._model_load_conflict: str | None = None

    def reset(self) -> None:
        self._model = None
        self._model_path = None
        self._model_load_conflict = None

    def detect(self, payload: EquipmentDetectRequest) -> EquipmentDetectResponse:
        model = self._load_model()
        if model is None:
            return EquipmentDetectResponse(
                equipment_conflicts=[self._model_load_conflict or MODEL_UNAVAILABLE_CONFLICT],
                equipment_family="unknown",
            )

        image = self._decode_image(payload.frame_b64)
        threshold = self._confidence_threshold_from_env()
        model_prefilter_confidence = min(0.05, threshold)
        try:
            result = model(image, conf=model_prefilter_confidence, verbose=False)[0]
        except Exception:
            LOGGER.exception("Equipment model inference failed")
            return EquipmentDetectResponse(
                equipment_conflicts=["equipment_model_inference_failed"],
                equipment_family="unknown",
            )

        image_width, image_height = image.size
        model_names = getattr(model, "names", {})
        detections = self._to_detections(
            result=result,
            model_names=model_names,
            image_width=image_width,
            image_height=image_height,
        )
        labels = [detection.label for detection in detections]
        context = _resolve_equipment_context(labels)
        best_confidence = max(
            (detection.confidence or 0 for detection in detections),
            default=0,
        )
        raw_candidates = self._summarize_raw_candidates(result, model_names)
        LOGGER.info(
            "Equipment detection frame=%sx%s threshold=%.2f raw=%s accepted=%s context=%s",
            image_width,
            image_height,
            threshold,
            raw_candidates,
            [
                f"{detection.label}:{detection.confidence:.2f}"
                for detection in detections
                if detection.confidence is not None
            ],
            context or "unknown",
        )

        return EquipmentDetectResponse(
            equipment_confidence=round(best_confidence, 6) if detections else None,
            equipment_conflicts=[] if context else ["equipment_not_detected"],
            equipment_context=context,
            equipment_detections=detections,
            equipment_family=context or "unknown",
        )

    def _model_path_from_env(self) -> Path:
        configured = os.getenv("EQUIPMENT_DETECTION_MODEL_PATH", "").strip()
        return Path(configured) if configured else DEFAULT_MODEL_PATH

    def _confidence_threshold_from_env(self) -> float:
        raw_value = os.getenv("EQUIPMENT_DETECTION_CONFIDENCE_THRESHOLD", "").strip()
        try:
            value = float(raw_value) if raw_value else DEFAULT_CONFIDENCE_THRESHOLD
        except ValueError:
            return DEFAULT_CONFIDENCE_THRESHOLD
        return min(1.0, max(0.0, value))

    def _load_model(self) -> Any | None:
        model_path = self._model_path_from_env()
        if self._model is not None and self._model_path == model_path:
            return self._model
        if self._model_load_conflict and self._model_path == model_path:
            return None

        self._model_path = model_path
        self._model_load_conflict = None
        if not model_path.exists():
            self._model_load_conflict = MODEL_UNAVAILABLE_CONFLICT
            return None

        try:
            from ultralytics import YOLO
        except ImportError:
            self._model_load_conflict = MODEL_DEPENDENCY_MISSING_CONFLICT
            return None

        try:
            self._model = YOLO(str(model_path))
        except Exception:
            self._model_load_conflict = "equipment_model_load_failed"
            self._model = None
            return None
        return self._model

    def _decode_image(self, frame_b64: str) -> Image.Image:
        encoded = frame_b64.strip()
        if encoded.startswith("data:") and "," in encoded:
            encoded = encoded.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
            return Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except (ValueError, UnidentifiedImageError, OSError) as exc:
            raise ServiceError(
                type="INVALID_REQUEST",
                title="Invalid Equipment Frame",
                status=400,
                detail="frame_b64 must be a valid base64-encoded image.",
            ) from exc

    def _to_detections(
        self,
        *,
        result: Any,
        model_names: dict[int, str] | list[str],
        image_width: int,
        image_height: int,
    ) -> list[EquipmentDetectionBox]:
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return []

        threshold = self._confidence_threshold_from_env()
        detections: list[EquipmentDetectionBox] = []
        for box in boxes:
            class_index = int(_to_float(getattr(box, "cls", None)) or 0)
            label = _model_label(model_names, class_index)
            confidence = _to_float(getattr(box, "conf", None))
            if confidence is None or confidence < threshold:
                continue
            if _label_to_context(label) is None:
                continue

            xyxy_raw = getattr(box, "xyxy", None)
            if xyxy_raw is None:
                continue
            xyxy = xyxy_raw[0].tolist() if hasattr(xyxy_raw[0], "tolist") else xyxy_raw[0]
            if len(xyxy) < 4:
                continue

            x1, y1, x2, y2 = (float(value) for value in xyxy[:4])
            detections.append(
                EquipmentDetectionBox(
                    confidence=round(confidence, 6),
                    height=_to_unit(y2 - y1, image_height),
                    label=label,
                    width=_to_unit(x2 - x1, image_width),
                    x=_to_unit(x1, image_width),
                    y=_to_unit(y1, image_height),
                )
            )

        return detections

    def _summarize_raw_candidates(
        self,
        result: Any,
        model_names: dict[int, str] | list[str],
    ) -> list[str]:
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return []

        summaries: list[tuple[float, str]] = []
        for box in boxes:
            class_index = int(_to_float(getattr(box, "cls", None)) or 0)
            label = _model_label(model_names, class_index) or f"class_{class_index}"
            confidence = _to_float(getattr(box, "conf", None))
            if confidence is None:
                continue
            summaries.append((confidence, f"{label}:{confidence:.2f}"))

        summaries.sort(key=lambda item: item[0], reverse=True)
        return [summary for _, summary in summaries[:8]]
