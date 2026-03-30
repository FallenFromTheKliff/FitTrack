from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Protocol

import httpx
from pydantic import ValidationError

from app.errors import ServiceError
from app.models.business_insights import (
    BusinessAnalyticsGroundingPayload,
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
    GeneratedBusinessInsight,
)


class BusinessInsightProvider(Protocol):
    def generate_business_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse: ...


@dataclass(slots=True)
class OpenRouterInsightSettings:
    api_key: str
    base_url: str
    insight_model: str
    http_referer: str | None
    app_title: str | None


class OpenRouterBusinessInsightProvider:
    _DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    _REQUEST_TIMEOUT_SECONDS = 10.0

    def generate_business_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        settings = self._get_settings()
        request_payload = self.build_openrouter_insight_request(payload)

        try:
            response = httpx.post(
                f"{settings.base_url.rstrip('/')}/chat/completions",
                json=request_payload,
                headers=self._build_headers(settings),
                timeout=self._REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Unavailable",
                status=503,
                detail="OpenRouter business insight generation is unavailable.",
            ) from exc

        if response.status_code >= 400:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Business Insight Generation Failed",
                status=502,
                detail="OpenRouter rejected the business insight request.",
            )

        try:
            response_payload = response.json()
        except ValueError as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned a non-JSON business insight payload.",
            ) from exc

        insight = self._parse_generated_insight(response_payload)
        anomaly_flags = self._merge_unique_strings(
            insight.anomaly_flags,
            BusinessInsightService.detect_anomalies(payload.grounding),
        )

        return BusinessAnalyticsInsightResponse(
            summary=insight.summary,
            highlights=insight.highlights,
            risks=insight.risks,
            opportunities=insight.opportunities,
            anomaly_flags=anomaly_flags,
            recommended_actions=insight.recommended_actions,
            model_used=self._extract_model_used(response_payload),
            token_count=self._extract_token_count(response_payload),
        )

    def build_openrouter_insight_request(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> dict[str, object]:
        settings = self._get_settings()
        anomaly_flags = BusinessInsightService.detect_anomalies(payload.grounding)

        return {
            "model": settings.insight_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a grounded gym business analyst. Use only the "
                        "provided analytics grounding. Return strict JSON only, "
                        "with no markdown, no prose outside the JSON object, and "
                        "no extra keys."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "grounding": payload.grounding.model_dump(mode="json"),
                            "detected_anomaly_flags": anomaly_flags,
                        },
                        separators=(",", ":"),
                    ),
                },
            ],
            "temperature": 0.2,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "business_analytics_insight",
                    "strict": True,
                    "schema": GeneratedBusinessInsight.model_json_schema(),
                },
            },
        }

    def _get_settings(self) -> OpenRouterInsightSettings:
        api_key = os.getenv("OPENROUTER_API_KEY")
        insight_model = os.getenv("OPENROUTER_INSIGHT_MODEL")

        if not api_key or not insight_model:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Unavailable",
                status=503,
                detail=(
                    "OpenRouter business insight generation is not configured."
                ),
            )

        return OpenRouterInsightSettings(
            api_key=api_key,
            base_url=os.getenv("OPENROUTER_BASE_URL", self._DEFAULT_BASE_URL),
            insight_model=insight_model,
            http_referer=os.getenv("OPENROUTER_HTTP_REFERER"),
            app_title=os.getenv("OPENROUTER_APP_TITLE"),
        )

    def _build_headers(
        self,
        settings: OpenRouterInsightSettings,
    ) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {settings.api_key}",
            "Content-Type": "application/json",
        }

        if settings.http_referer:
            headers["HTTP-Referer"] = settings.http_referer
        if settings.app_title:
            headers["X-Title"] = settings.app_title

        return headers

    def _parse_generated_insight(
        self,
        response_payload: object,
    ) -> GeneratedBusinessInsight:
        if not isinstance(response_payload, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned an invalid business insight envelope.",
            )

        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned no business insight choices.",
            )

        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned an invalid business insight choice.",
            )

        message = first_choice.get("message")
        if not isinstance(message, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned an invalid business insight message.",
            )

        content = self._normalize_message_content(message.get("content"))
        try:
            parsed_content = json.loads(content)
            return GeneratedBusinessInsight.model_validate(parsed_content)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail=(
                    "OpenRouter returned a business insight payload that did not "
                    "match the required schema."
                ),
            ) from exc

    def _normalize_message_content(self, content: object) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            text_parts: list[str] = []
            for item in content:
                if (
                    isinstance(item, dict)
                    and item.get("type") == "text"
                    and isinstance(item.get("text"), str)
                ):
                    text_parts.append(item["text"])

            if text_parts:
                return "".join(text_parts)

        raise ServiceError(
            type="BAD_GATEWAY",
            title="Invalid Business Insight Response",
            status=502,
            detail="OpenRouter returned an unsupported business insight content shape.",
        )

    def _extract_model_used(self, response_payload: object) -> str | None:
        if isinstance(response_payload, dict):
            model_used = response_payload.get("model")
            if isinstance(model_used, str) and model_used.strip():
                return model_used
        return None

    def _extract_token_count(self, response_payload: object) -> int | None:
        if not isinstance(response_payload, dict):
            return None

        usage = response_payload.get("usage")
        if not isinstance(usage, dict):
            return None

        total_tokens = usage.get("total_tokens")
        if isinstance(total_tokens, int) and total_tokens >= 0:
            return total_tokens

        return None

    def _merge_unique_strings(
        self,
        primary: list[str],
        secondary: list[str],
    ) -> list[str]:
        merged: list[str] = []
        for value in [*primary, *secondary]:
            if value not in merged:
                merged.append(value)
        return merged


class BusinessInsightService:
    def __init__(self, provider: BusinessInsightProvider | None = None) -> None:
        self._provider = provider or OpenRouterBusinessInsightProvider()

    def generate_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        return self._provider.generate_business_insight(payload)

    @staticmethod
    def detect_anomalies(
        grounding: BusinessAnalyticsGroundingPayload,
    ) -> list[str]:
        anomalies: list[str] = []
        total_revenue = BusinessInsightService._parse_money(
            grounding.overview.total_revenue,
        )

        if grounding.overview.total_check_ins == 0:
            anomalies.append("No attendance was recorded for the selected window.")

        if total_revenue == 0 and grounding.membership.active_members > 0:
            anomalies.append(
                "Revenue is zero even though active members exist in the selected window."
            )

        if (
            grounding.attendance.peak_hours
            and grounding.attendance.peak_hours[0].check_ins == 0
        ):
            anomalies.append("Peak attendance hours were computed without recorded check-ins.")

        if (
            grounding.inventory is not None
            and grounding.inventory.top_products
            and grounding.inventory.top_products[0].quantity_sold == 0
        ):
            anomalies.append(
                "Inventory sales data is present, but the top product has zero quantity sold."
            )

        return anomalies

    @staticmethod
    def _parse_money(value: str) -> float:
        try:
            return float(value)
        except ValueError:
            return 0.0
