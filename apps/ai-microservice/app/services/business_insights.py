from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from pydantic import ValidationError

from ..errors import ServiceError
from ..models.business_insights import (
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
    fallback_model: str | None
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
        insight, response_payload = self._run_generation_variants(
            settings,
            [
                self.build_openrouter_insight_request(
                    payload,
                    response_format_type="json_schema",
                    require_parameters=True,
                ),
                self.build_openrouter_insight_request(
                    payload,
                    response_format_type="json_object",
                ),
                self.build_openrouter_insight_request(
                    payload,
                    response_format_type="prompt_json",
                ),
                *self._build_fallback_variants(payload),
            ],
        )
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
        *,
        model_override: str | None = None,
        response_format_type: Literal[
            "json_object",
            "json_schema",
            "prompt_json",
        ] = "json_schema",
        require_parameters: bool = False,
    ) -> dict[str, object]:
        settings = self._get_settings()
        anomaly_flags = BusinessInsightService.detect_anomalies(payload.grounding)
        system_prompt = (
            "You are a grounded gym business analyst. Use only the provided "
            "analytics grounding. Return strict JSON only, with no markdown, no "
            "prose outside the JSON object, and no extra keys. If the data is "
            "thin or mixed, write cautious business analysis from the supplied "
            "metrics instead of refusing."
        )
        if response_format_type in {"json_object", "prompt_json"}:
            system_prompt += (
                " Return a single JSON object with exactly these keys: "
                "summary, highlights, risks, opportunities, anomaly_flags, "
                "recommended_actions."
            )

        request_payload: dict[str, object] = {
            "model": model_override or settings.insight_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
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
        }

        if response_format_type == "json_schema":
            request_payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "business_analytics_insight",
                    "strict": True,
                    "schema": GeneratedBusinessInsight.model_json_schema(),
                },
            }
            if require_parameters:
                request_payload["provider"] = {"require_parameters": True}
        elif response_format_type == "json_object":
            request_payload["response_format"] = {"type": "json_object"}

        return request_payload

    def _post_chat_completion(
        self,
        settings: OpenRouterInsightSettings,
        request_payload: dict[str, object],
    ) -> httpx.Response:
        try:
            return httpx.post(
                f"{settings.base_url.rstrip('/')}/chat/completions",
                json=request_payload,
                headers=self._build_headers(settings),
                timeout=self._REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Timeout",
                status=503,
                detail=(
                    "The business insight analysis timed out while waiting for "
                    "OpenRouter."
                ),
            ) from exc
        except httpx.HTTPError as exc:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Provider Unavailable",
                status=503,
                detail="OpenRouter business insight generation is unavailable.",
            ) from exc

    def _run_generation_variants(
        self,
        settings: OpenRouterInsightSettings,
        payloads: list[dict[str, object]],
    ) -> tuple[GeneratedBusinessInsight, dict[str, object]]:
        last_response: httpx.Response | None = None
        last_error: ServiceError | None = None
        for request_payload in payloads:
            try:
                response = self._post_chat_completion(settings, request_payload)
            except ServiceError as exc:
                last_error = exc
                continue

            if response.status_code < 400:
                try:
                    response_payload = response.json()
                except ValueError as exc:
                    last_error = ServiceError(
                        type="BAD_GATEWAY",
                        title="Invalid Business Insight Response",
                        status=502,
                        detail=(
                            "OpenRouter returned a non-JSON business insight "
                            "payload."
                        ),
                    )
                    last_error.__cause__ = exc
                    continue

                try:
                    return (
                        self._parse_generated_insight(response_payload),
                        response_payload,
                    )
                except ServiceError as exc:
                    last_error = exc
                    continue

            last_response = response
            last_error = self._build_upstream_error(response)

        if last_error is not None:
            raise last_error
        if last_response is not None:
            raise self._build_upstream_error(last_response)

        raise ServiceError(
            type="SERVICE_UNAVAILABLE",
            title="Business Insight Provider Unavailable",
            status=503,
            detail="OpenRouter business insight generation is unavailable.",
        )

    def _build_fallback_variants(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> list[dict[str, object]]:
        settings = self._get_settings()
        if (
            not settings.fallback_model
            or settings.fallback_model == settings.insight_model
        ):
            return []

        return [
            self.build_openrouter_insight_request(
                payload,
                model_override=settings.fallback_model,
                response_format_type="json_schema",
                require_parameters=True,
            ),
            self.build_openrouter_insight_request(
                payload,
                model_override=settings.fallback_model,
                response_format_type="json_object",
            ),
            self.build_openrouter_insight_request(
                payload,
                model_override=settings.fallback_model,
                response_format_type="prompt_json",
            ),
        ]

    def _build_upstream_error(
        self,
        response: httpx.Response,
    ) -> ServiceError:
        status = response.status_code
        if status == 429:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Usage Limited",
                status=503,
                detail=(
                    "The business insight service is temporarily out of OpenRouter "
                    "free-model capacity. Try again shortly."
                ),
            )

        if status == 402:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Credits Unavailable",
                status=503,
                detail=(
                    "The business insight service has exhausted the available "
                    "OpenRouter credits or free usage for the selected models."
                ),
            )

        upstream_message = self._extract_upstream_error_message(response)
        return ServiceError(
            type="BAD_GATEWAY",
            title="Business Insight Generation Failed",
            status=502,
            detail=upstream_message or "OpenRouter rejected the business insight request.",
        )

    def _extract_upstream_error_message(self, response: httpx.Response) -> str | None:
        try:
            payload = response.json()
        except ValueError:
            return None

        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()
            detail = payload.get("detail")
            if isinstance(detail, str) and detail.strip():
                return detail.strip()
        return None

    def _get_settings(self) -> OpenRouterInsightSettings:
        api_key = os.getenv("OPENROUTER_API_KEY")
        insight_model = (
            os.getenv("OPENROUTER_BUSINESS_INSIGHT_MODEL")
            or os.getenv("OPENROUTER_INSIGHT_MODEL")
        )
        fallback_model = (
            os.getenv("OPENROUTER_INSIGHT_FALLBACK_MODEL")
            or os.getenv("OPENROUTER_FREE_MODEL_FALLBACK")
        )

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
            fallback_model=fallback_model.strip() if fallback_model and fallback_model.strip() else None,
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
        if not content.strip():
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned an empty business insight message.",
            )
        if self._is_refusal_like(content):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter refused a grounded business insight request.",
            )

        try:
            parsed_content = self._load_json_content(content)
            insight = GeneratedBusinessInsight.model_validate(parsed_content)
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

        if self._is_refusal_like(insight.summary):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Response",
                status=502,
                detail="OpenRouter returned a refusal instead of a business insight.",
            )

        return insight

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

    def _load_json_content(self, content: str) -> object:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.removeprefix("```json").removeprefix("```JSON")
                cleaned = cleaned.removeprefix("```").removesuffix("```").strip()
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass

            object_start = cleaned.find("{")
            object_end = cleaned.rfind("}")
            if object_start != -1 and object_end > object_start:
                return json.loads(cleaned[object_start : object_end + 1])

            raise

    def _is_refusal_like(self, content: str) -> bool:
        normalized = content.strip().lower().replace("\u2019", "'")
        if not normalized:
            return True

        refusal_markers = (
            "i can't",
            "i cannot",
            "i'm unable",
            "i am unable",
            "cannot assist",
            "can't assist",
            "not able to",
            "outside my scope",
            "not allowed",
            "do not have access",
            "don't have access",
            "as an ai",
        )
        return any(marker in normalized for marker in refusal_markers)

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
        try:
            return self._provider.generate_business_insight(payload)
        except ServiceError as exc:
            if exc.status not in {502, 503}:
                raise
            return self.build_grounded_fallback(payload.grounding)

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

        if (
            grounding.inventory is not None
            and grounding.inventory.retail_items > 0
            and BusinessInsightService._parse_money(
                grounding.inventory.retail_inventory_value
            )
            == 0
        ):
            anomalies.append(
                "Inventory items exist, but the recorded retail inventory value is zero."
            )

        return anomalies

    @staticmethod
    def _parse_money(value: str) -> float:
        try:
            return float(value)
        except ValueError:
            return 0.0

    @staticmethod
    def build_grounded_fallback(
        grounding: BusinessAnalyticsGroundingPayload,
    ) -> BusinessAnalyticsInsightResponse:
        total_revenue = BusinessInsightService._parse_money(
            grounding.overview.total_revenue,
        )
        anomaly_flags = BusinessInsightService.detect_anomalies(grounding)
        top_plan = grounding.membership.top_plans[0] if grounding.membership.top_plans else None
        top_coach = grounding.coaching.coaches[0] if grounding.coaching.coaches else None
        top_product = (
            grounding.inventory.top_products[0]
            if grounding.inventory and grounding.inventory.top_products
            else None
        )
        inventory = grounding.inventory
        peak_hour = grounding.attendance.peak_hours[0] if grounding.attendance.peak_hours else None

        highlights = [
            (
                f"Total revenue for the selected {grounding.window.period} window "
                f"reached {grounding.overview.total_revenue}."
            ),
            (
                f"Attendance recorded {grounding.overview.total_check_ins} check-ins "
                f"with {grounding.membership.active_members} active members."
            ),
        ]
        if top_plan:
            highlights.append(
                f"Top membership plan is {top_plan.name} with {top_plan.subscriber_count} subscribers."
            )
        if top_coach:
            highlights.append(
                f"Top coach performer is {BusinessInsightService._coach_name(top_coach)} "
                f"with {top_coach.completed_sessions} completed sessions."
            )
        if inventory:
            highlights.append(
                f"Inventory currently holds {inventory.retail_items} retail items, "
                f"with {inventory.low_stock_items} low-stock items and "
                f"{inventory.equipment_under_maintenance} equipment type(s) under maintenance."
            )

        risks = (
            anomaly_flags.copy()
            if anomaly_flags
            else ["AI-generated narrative is currently degraded, so this fallback is rule-based."]
        )
        if peak_hour and peak_hour.check_ins > 0:
            risks.append(
                f"Traffic concentrates around {peak_hour.hour_label}, which can strain staffing and equipment."
            )

        opportunities = []
        if top_product:
            opportunities.append(
                f"Promote {top_product.name} during peak hours to lift secondary spend."
            )
        if inventory and inventory.low_stock_items > 0:
            opportunities.append(
                f"Restock the {inventory.low_stock_items} low-stock retail item(s) before peak foot traffic loses add-on sales."
            )
        if top_plan:
            opportunities.append(
                f"Use {top_plan.name} as the lead offer in retention and upgrade campaigns."
            )
        if top_coach:
            opportunities.append(
                f"Replicate the session pattern of {BusinessInsightService._coach_name(top_coach)} across the coaching team."
            )
        if not opportunities:
            opportunities.append(
                "Review the live analytics trends and schedule a manual business review for this window."
            )

        recommended_actions = []
        if total_revenue <= 0:
            recommended_actions.append(
                "Audit the payment pipelines for the selected window before trusting revenue conclusions."
            )
        if grounding.overview.total_check_ins <= 0:
            recommended_actions.append(
                "Validate access-control and check-in capture because attendance is currently zero."
            )
        if peak_hour and peak_hour.check_ins > 0:
            recommended_actions.append(
                f"Align staffing, classes, and retail prompts around the {peak_hour.hour_label} peak."
            )
        if top_product:
            recommended_actions.append(
                f"Bundle {top_product.name} with memberships or coaching packages to improve spend per visit."
            )
        if inventory and inventory.equipment_under_maintenance > 0:
            recommended_actions.append(
                f"Resolve {inventory.equipment_under_maintenance} maintenance queue item(s) so equipment availability stays ahead of attendance demand."
            )
        if not recommended_actions:
            recommended_actions.append(
                "Review this grounded fallback insight and regenerate once the external AI provider stabilizes."
            )

        summary = (
            f"Fallback insight: revenue is {grounding.overview.total_revenue}, "
            f"attendance is {grounding.overview.total_check_ins} check-ins, "
            f"active membership is {grounding.membership.active_members}, and "
            f"inventory value is {inventory.retail_inventory_value if inventory else '0.00'} for the selected window."
        )

        return BusinessAnalyticsInsightResponse(
            summary=summary,
            highlights=highlights,
            risks=BusinessInsightService._unique_strings(risks),
            opportunities=BusinessInsightService._unique_strings(opportunities),
            anomaly_flags=anomaly_flags,
            recommended_actions=BusinessInsightService._unique_strings(
                recommended_actions
            ),
            model_used="grounded-fallback",
            token_count=None,
        )

    @staticmethod
    def _coach_name(coach: object) -> str:
        if not hasattr(coach, "first_name") and not hasattr(coach, "last_name"):
            return "the leading coach"

        first_name = getattr(coach, "first_name", None)
        last_name = getattr(coach, "last_name", None)
        full_name = " ".join(part for part in [first_name, last_name] if part)
        return full_name or "the leading coach"

    @staticmethod
    def _unique_strings(values: list[str]) -> list[str]:
        deduped: list[str] = []
        for value in values:
            if value and value not in deduped:
                deduped.append(value)
        return deduped
