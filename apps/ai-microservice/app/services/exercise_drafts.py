from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import ValidationError

from ..errors import ServiceError
from ..models.exercise_drafts import (
    ExerciseDraftProposalRequest,
    ExerciseDraftProposalResponse,
)


@dataclass(slots=True)
class OpenRouterExerciseDraftSettings:
    api_key: str
    app_title: str | None
    base_url: str
    fallback_model: str | None
    http_referer: str | None
    model: str


class ExerciseDraftProposalService:
    _DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    _REQUEST_TIMEOUT_SECONDS = 12.0

    def propose(
        self,
        payload: ExerciseDraftProposalRequest,
    ) -> ExerciseDraftProposalResponse:
        settings = self._get_settings()
        response = self._run_request_variants(
            settings,
            [
                self._build_request(payload, settings),
                self._build_request(payload, settings, response_format_type="json_object"),
                *self._build_fallback_variants(payload, settings),
            ],
        )
        response_payload = self._parse_response_payload(response)
        draft = self._parse_draft(response_payload)
        draft_payload = draft.model_dump(mode="json")
        draft_payload["model_used"] = self._extract_model_used(response_payload) or settings.model
        draft_payload["token_count"] = self._extract_token_count(response_payload)
        return ExerciseDraftProposalResponse(**draft_payload)

    def _build_request(
        self,
        payload: ExerciseDraftProposalRequest,
        settings: OpenRouterExerciseDraftSettings,
        *,
        model_override: str | None = None,
        response_format_type: Literal["json_schema", "json_object"] = "json_schema",
    ) -> dict[str, object]:
        response_format = (
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "fittrack_exercise_draft_proposal",
                    "strict": True,
                    "schema": ExerciseDraftProposalResponse.model_json_schema(),
                },
            }
            if response_format_type == "json_schema"
            else {"type": "json_object"}
        )

        return {
            "model": model_override or settings.model,
            "messages": [
                {
                    "role": "system",
                    "content": self._build_system_prompt(response_format_type),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "draft_contract_version": "exercise_creation_v1",
                            "input": payload.model_dump(mode="json"),
                        },
                        separators=(",", ":"),
                    ),
                },
            ],
            "temperature": 0.15,
            "response_format": response_format,
        }

    def _build_system_prompt(
        self,
        response_format_type: Literal["json_schema", "json_object"],
    ) -> str:
        prompt = (
            "You are FitTrack's exercise authoring assistant. Use only the provided "
            "pose evidence, movement contract, rig keyframes, muscle targets, and "
            "hand-shape rules. Do not invent measurements, equipment detection, or "
            "medical claims. Improve naming, instructions, muscle allocation clarity, "
            "and review warnings, but preserve the submitted movement_profile and "
            "hand_shape_profile unless the input is missing or obviously malformed. "
            "AI is advisory only; humans edit before publishing. Return strict JSON "
            "only with proposal_source set to ai."
        )
        if response_format_type == "json_object":
            prompt += (
                " Required keys: proposal_source, confidence, proposed_name, summary, "
                "category, muscle_group, muscle_targets, movement_profile, "
                "hand_shape_profile, evidence, description, instructions, "
                "review_warnings, model_used, token_count."
            )
        return prompt

    def _post_chat_completion(
        self,
        settings: OpenRouterExerciseDraftSettings,
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
                title="Exercise Draft Provider Timeout",
                status=503,
                detail="Exercise draft proposal timed out while waiting for OpenRouter.",
            ) from exc
        except httpx.HTTPError as exc:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Exercise Draft Provider Unavailable",
                status=503,
                detail="Exercise draft proposal could not reach OpenRouter.",
            ) from exc

    def _run_request_variants(
        self,
        settings: OpenRouterExerciseDraftSettings,
        payloads: list[dict[str, object]],
    ) -> httpx.Response:
        last_response: httpx.Response | None = None
        for request_payload in payloads:
            response = self._post_chat_completion(settings, request_payload)
            if response.status_code < 400:
                return response
            last_response = response

        assert last_response is not None
        raise self._build_upstream_error(last_response)

    def _build_fallback_variants(
        self,
        payload: ExerciseDraftProposalRequest,
        settings: OpenRouterExerciseDraftSettings,
    ) -> list[dict[str, object]]:
        if not settings.fallback_model or settings.fallback_model == settings.model:
            return []
        return [
            self._build_request(payload, settings, model_override=settings.fallback_model),
            self._build_request(
                payload,
                settings,
                model_override=settings.fallback_model,
                response_format_type="json_object",
            ),
        ]

    def _build_upstream_error(self, response: httpx.Response) -> ServiceError:
        if response.status_code in {402, 429}:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Exercise Draft Usage Limited",
                status=503,
                detail="Exercise draft AI capacity is unavailable; use deterministic fallback.",
            )
        if response.status_code in {401, 403}:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Exercise Draft Provider Misconfigured",
                status=503,
                detail="Exercise draft AI provider access is misconfigured.",
            )
        return ServiceError(
            type="BAD_GATEWAY",
            title="Exercise Draft Request Failed",
            status=502,
            detail=self._extract_upstream_error_message(response)
            or "OpenRouter rejected the exercise draft request.",
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

    def _parse_response_payload(self, response: httpx.Response) -> dict[str, object]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned a non-JSON exercise draft payload.",
            ) from exc
        if not isinstance(payload, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned an invalid exercise draft payload.",
            )
        return payload

    def _parse_draft(
        self,
        response_payload: dict[str, object],
    ) -> ExerciseDraftProposalResponse:
        content = self._extract_message_content(response_payload)
        try:
            parsed = self._load_json_content(content)
            return ExerciseDraftProposalResponse.model_validate(parsed)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned an exercise draft that did not match the required schema.",
            ) from exc

    def _extract_message_content(self, response_payload: dict[str, object]) -> str:
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned no exercise draft choices.",
            )
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned an invalid exercise draft choice.",
            )
        message = first_choice.get("message")
        if not isinstance(message, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Exercise Draft Response",
                status=502,
                detail="OpenRouter returned an invalid exercise draft message.",
            )
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content
        if isinstance(content, list):
            parts = [
                item["text"]
                for item in content
                if isinstance(item, dict)
                and item.get("type") == "text"
                and isinstance(item.get("text"), str)
            ]
            if parts:
                return "".join(parts)
        raise ServiceError(
            type="BAD_GATEWAY",
            title="Invalid Exercise Draft Response",
            status=502,
            detail="OpenRouter returned an unsupported exercise draft content shape.",
        )

    def _load_json_content(self, content: str) -> object:
        cleaned = self._strip_code_fences(content)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            object_start = cleaned.find("{")
            object_end = cleaned.rfind("}")
            if object_start != -1 and object_end > object_start:
                return json.loads(cleaned[object_start : object_end + 1])
            raise

    def _strip_code_fences(self, content: str) -> str:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    def _extract_model_used(self, response_payload: dict[str, object]) -> str | None:
        model_used = response_payload.get("model")
        return model_used.strip() if isinstance(model_used, str) and model_used.strip() else None

    def _extract_token_count(self, response_payload: dict[str, object]) -> int | None:
        usage = response_payload.get("usage")
        if not isinstance(usage, dict):
            return None
        total_tokens = usage.get("total_tokens")
        return total_tokens if isinstance(total_tokens, int) and total_tokens >= 0 else None

    def _get_settings(self) -> OpenRouterExerciseDraftSettings:
        api_key = os.getenv("OPENROUTER_API_KEY")
        model = self._first_configured_env(
            "OPENROUTER_EXERCISE_DRAFT_MODEL",
            "OPENROUTER_ASSISTANT_PLAN_MODEL",
            "OPENROUTER_ASSISTANT_CHAT_MODEL",
            "OPENROUTER_INSIGHT_MODEL",
        )
        fallback_model = (
            os.getenv("OPENROUTER_EXERCISE_DRAFT_FALLBACK_MODEL")
            or os.getenv("OPENROUTER_FREE_MODEL_FALLBACK")
        )
        if not api_key or not model:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Exercise Draft Provider Unavailable",
                status=503,
                detail="Exercise draft AI generation is not configured.",
            )
        return OpenRouterExerciseDraftSettings(
            api_key=api_key,
            app_title=os.getenv("OPENROUTER_APP_TITLE"),
            base_url=os.getenv("OPENROUTER_BASE_URL", self._DEFAULT_BASE_URL),
            fallback_model=fallback_model.strip()
            if fallback_model and fallback_model.strip()
            else None,
            http_referer=os.getenv("OPENROUTER_HTTP_REFERER"),
            model=model,
        )

    def _first_configured_env(self, *keys: str) -> str | None:
        for key in keys:
            value = os.getenv(key)
            if value and value.strip():
                return value.strip()
        return None

    def _build_headers(
        self,
        settings: OpenRouterExerciseDraftSettings,
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
