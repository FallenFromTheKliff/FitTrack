from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..errors import ServiceError
from ..models.assistant import (
    AllowedExerciseItem,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantPlanDay,
    AssistantPlanExercise,
    AssistantPlanRequest,
    AssistantPlanResponse,
    AssistantPlanWeek,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OpenRouterAssistantChatDraft(StrictModel):
    content: str = Field(min_length=1)
    action: Literal["ADJUST_TDEE", "GENERATE_PLAN", "LOG_NUTRITION", "NONE"]
    params: dict[str, Any] | None = None


class OpenRouterAssistantPlanDraft(StrictModel):
    weeks: list[AssistantPlanWeek] = Field(min_length=1)


@dataclass(slots=True)
class OpenRouterAssistantSettings:
    api_key: str
    base_url: str
    assistant_model: str
    assistant_plan_model: str
    fallback_model: str | None
    http_referer: str | None
    app_title: str | None


class AssistantProvider(Protocol):
    def reply_to_message(self, payload: AssistantChatRequest) -> AssistantChatResponse: ...

    def generate_plan(self, payload: AssistantPlanRequest) -> AssistantPlanResponse: ...


class OpenRouterAssistantProvider:
    _DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    _REQUEST_TIMEOUT_SECONDS = 10.0

    def reply_to_message(self, payload: AssistantChatRequest) -> AssistantChatResponse:
        settings = self._get_settings()
        response = self._run_request_variants(
            settings,
            [
                self._build_chat_request(payload, settings),
                self._build_chat_request(
                    payload,
                    settings,
                    response_format_type="json_object",
                ),
                *self._build_fallback_chat_variants(payload, settings),
            ],
            request_label="assistant chat",
        )

        response_payload = self._parse_response_payload(response)
        draft = self._parse_chat_draft(response_payload)

        return AssistantChatResponse(
            content=draft.content.strip(),
            action=draft.action,
            params=draft.params,
            model_used=self._extract_model_used(response_payload)
            or settings.assistant_model,
            token_count=self._extract_token_count(response_payload),
        )

    def generate_plan(self, payload: AssistantPlanRequest) -> AssistantPlanResponse:
        settings = self._get_settings()
        response = self._run_request_variants(
            settings,
            [
                self._build_plan_request(payload, settings),
                self._build_plan_request(
                    payload,
                    settings,
                    response_format_type="json_object",
                ),
                *self._build_fallback_plan_variants(payload, settings),
            ],
            request_label="assistant plan",
        )

        response_payload = self._parse_response_payload(response)
        draft = self._parse_plan_draft(response_payload)

        return AssistantPlanResponse(
            weeks=draft.weeks,
            model_used=self._extract_model_used(response_payload)
            or settings.assistant_plan_model,
            token_count=self._extract_token_count(response_payload),
        )

    def _build_chat_request(
        self,
        payload: AssistantChatRequest,
        settings: OpenRouterAssistantSettings,
        *,
        model_override: str | None = None,
        response_format_type: Literal["json_schema", "json_object"] = "json_schema",
    ) -> dict[str, object]:
        response_format = self._build_response_format(
            "fittrack_assistant_chat",
            OpenRouterAssistantChatDraft.model_json_schema(),
            response_format_type=response_format_type,
        )

        return {
            "model": model_override or settings.assistant_model,
            "messages": [
                {
                    "role": "system",
                    "content": self._build_chat_system_prompt(payload),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "messages": [
                                {
                                    "role": message.role,
                                    "content": message.content,
                                }
                                for message in payload.messages
                            ],
                            "user_context": payload.user_context.model_dump(mode="json"),
                            "session_context": payload.session_context.model_dump(mode="json"),
                        },
                        separators=(",", ":"),
                    ),
                },
            ],
            "temperature": 0.3,
            "response_format": response_format,
        }

    def _build_plan_request(
        self,
        payload: AssistantPlanRequest,
        settings: OpenRouterAssistantSettings,
        *,
        model_override: str | None = None,
        response_format_type: Literal["json_schema", "json_object"] = "json_schema",
    ) -> dict[str, object]:
        response_format = self._build_response_format(
            "fittrack_assistant_plan",
            OpenRouterAssistantPlanDraft.model_json_schema(),
            response_format_type=response_format_type,
        )

        return {
            "model": model_override or settings.assistant_plan_model,
            "messages": [
                {
                    "role": "system",
                    "content": self._build_plan_system_prompt(payload),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "user_context": payload.user_context.model_dump(mode="json"),
                            "plan_input": payload.plan_input.model_dump(mode="json"),
                            "allowed_exercises": [
                                exercise.model_dump(mode="json")
                                for exercise in payload.allowed_exercises
                            ],
                        },
                        separators=(",", ":"),
                    ),
                },
            ],
            "temperature": 0.2,
            "response_format": response_format,
        }

    def _build_response_format(
        self,
        schema_name: str,
        schema: dict[str, object],
        *,
        response_format_type: Literal["json_schema", "json_object"],
    ) -> dict[str, object]:
        if response_format_type == "json_object":
            return {"type": "json_object"}

        return {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        }

    def _build_chat_system_prompt(self, payload: AssistantChatRequest) -> str:
        context_hint = self._context_hint(payload.session_context.context_type)
        return (
            "You are FitTrack's in-app fitness and nutrition assistant.\n"
            "Follow these guardrails:\n"
            "- Be concise, calm, and supportive. Prefer plain language.\n"
            "- Use only the provided messages, user context, and session context. Do not invent profile facts.\n"
            "- Do not claim to have executed actions. Only describe the next step or the answer.\n"
            "- Never provide medical diagnosis or emergency care instructions beyond a brief safety-first redirection.\n"
            "- If the user describes chest pain, fainting, severe injury, self-harm, or another emergency, keep the reply brief and urge immediate local emergency help.\n"
            "- If the user asks for a training plan, set action to GENERATE_PLAN and include duration_weeks, days_per_week, and preferences when they can be inferred.\n"
            "- If the user asks to adjust calories or macros, set action to ADJUST_TDEE and include only known non-null profile fields.\n"
            "- If the user wants to log food or a meal, set action to LOG_NUTRITION only when that intent is clear.\n"
            "- Otherwise set action to NONE and params to null.\n"
            "- Keep the reply short and helpful.\n"
            f"- Context guidance: {context_hint}\n"
            "Return strict JSON only."
        )

    def _build_plan_system_prompt(self, payload: AssistantPlanRequest) -> str:
        allowed_names = ", ".join(
            exercise.name for exercise in payload.allowed_exercises[:12]
        )
        return (
            "You are FitTrack's training-plan planner.\n"
            "Follow these guardrails:\n"
            "- Use only the provided user context, plan input, and allowed exercise catalog.\n"
            "- Do not invent exercises, muscle groups, or training constraints.\n"
            "- Keep each day realistic, concise, and aligned with the user's preferences.\n"
            "- Prefer up to four exercises per day when possible.\n"
            "- Favor strength exercises when available, then rotate the catalog across days.\n"
            "- Preserve the provided day structure and keep notes short.\n"
            "- If there is a clear preference, reflect it in notes without adding new facts.\n"
            f"- Allowed exercise examples: {allowed_names or 'none'}.\n"
            "Return strict JSON only."
        )

    def _post_chat_completion(
        self,
        settings: OpenRouterAssistantSettings,
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
                title="Assistant Provider Timeout",
                status=503,
                detail=(
                    "BrodigyAI timed out while waiting for OpenRouter. "
                    "Try again shortly."
                ),
            ) from exc
        except httpx.HTTPError as exc:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Provider Unavailable",
                status=503,
                detail=(
                    "BrodigyAI could not reach OpenRouter. "
                    "Check the network or try again shortly."
                ),
            ) from exc

    def _run_request_variants(
        self,
        settings: OpenRouterAssistantSettings,
        payloads: list[dict[str, object]],
        *,
        request_label: str,
    ) -> httpx.Response:
        last_response: httpx.Response | None = None
        for request_payload in payloads:
            response = self._post_chat_completion(settings, request_payload)
            if response.status_code < 400:
                return response
            last_response = response

        assert last_response is not None
        raise self._build_upstream_error(last_response, request_label=request_label)

    def _build_fallback_chat_variants(
        self,
        payload: AssistantChatRequest,
        settings: OpenRouterAssistantSettings,
    ) -> list[dict[str, object]]:
        if (
            not settings.fallback_model
            or settings.fallback_model == settings.assistant_model
        ):
            return []

        return [
            self._build_chat_request(
                payload,
                settings,
                model_override=settings.fallback_model,
            ),
            self._build_chat_request(
                payload,
                settings,
                model_override=settings.fallback_model,
                response_format_type="json_object",
            ),
        ]

    def _build_fallback_plan_variants(
        self,
        payload: AssistantPlanRequest,
        settings: OpenRouterAssistantSettings,
    ) -> list[dict[str, object]]:
        if (
            not settings.fallback_model
            or settings.fallback_model == settings.assistant_plan_model
        ):
            return []

        return [
            self._build_plan_request(
                payload,
                settings,
                model_override=settings.fallback_model,
            ),
            self._build_plan_request(
                payload,
                settings,
                model_override=settings.fallback_model,
                response_format_type="json_object",
            ),
        ]

    def _build_upstream_error(
        self,
        response: httpx.Response,
        *,
        request_label: str,
    ) -> ServiceError:
        status = response.status_code
        if status == 429:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Usage Limited",
                status=503,
                detail=(
                    "BrodigyAI is temporarily out of OpenRouter free-model capacity. "
                    "Try again in a few minutes."
                ),
            )

        if status == 402:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Credits Unavailable",
                status=503,
                detail=(
                    "BrodigyAI has exhausted the available OpenRouter credits or free usage "
                    "for the selected models."
                ),
            )

        if status in {408, 504}:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Provider Timeout",
                status=503,
                detail=(
                    "BrodigyAI timed out while waiting for OpenRouter. "
                    "Try again shortly."
                ),
            )

        if status in {401, 403}:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Provider Misconfigured",
                status=503,
                detail=(
                    "BrodigyAI is temporarily misconfigured for the current OpenRouter "
                    "provider access."
                ),
            )

        if status in {500, 502, 503}:
            return ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Provider Unavailable",
                status=503,
                detail=(
                    "BrodigyAI is temporarily unavailable while contacting "
                    "OpenRouter. Try again shortly."
                ),
            )

        upstream_message = self._extract_upstream_error_message(response)
        return ServiceError(
            type="BAD_GATEWAY",
            title="Assistant Request Failed",
            status=502,
            detail=upstream_message or f"OpenRouter rejected the {request_label} request.",
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

    def _get_settings(self) -> OpenRouterAssistantSettings:
        api_key = os.getenv("OPENROUTER_API_KEY")
        assistant_model = self._first_configured_env(
            "OPENROUTER_ASSISTANT_CHAT_MODEL",
            "OPENROUTER_ASSISTANT_MODEL",
            "OPENROUTER_INSIGHT_MODEL",
        )
        assistant_plan_model = self._first_configured_env(
            "OPENROUTER_ASSISTANT_PLAN_MODEL",
            "OPENROUTER_ASSISTANT_MODEL",
            "OPENROUTER_ASSISTANT_CHAT_MODEL",
            "OPENROUTER_INSIGHT_MODEL",
        )
        fallback_model = (
            os.getenv("OPENROUTER_ASSISTANT_FALLBACK_MODEL")
            or os.getenv("OPENROUTER_FREE_MODEL_FALLBACK")
        )

        if not api_key or not assistant_model or not assistant_plan_model:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Assistant Provider Unavailable",
                status=503,
                detail="OpenRouter assistant generation is not configured.",
            )

        return OpenRouterAssistantSettings(
            api_key=api_key,
            base_url=os.getenv("OPENROUTER_BASE_URL", self._DEFAULT_BASE_URL),
            assistant_model=assistant_model,
            assistant_plan_model=assistant_plan_model,
            fallback_model=fallback_model.strip() if fallback_model and fallback_model.strip() else None,
            http_referer=os.getenv("OPENROUTER_HTTP_REFERER"),
            app_title=os.getenv("OPENROUTER_APP_TITLE"),
        )

    def _first_configured_env(self, *keys: str) -> str | None:
        for key in keys:
            value = os.getenv(key)
            if value and value.strip():
                return value.strip()
        return None

    def _build_headers(
        self,
        settings: OpenRouterAssistantSettings,
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

    def _parse_response_payload(self, response: httpx.Response) -> dict[str, object]:
        try:
            response_payload = response.json()
        except ValueError as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned a non-JSON assistant payload.",
            ) from exc

        if not isinstance(response_payload, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned an invalid assistant payload.",
            )

        return response_payload

    def _parse_chat_draft(
        self,
        response_payload: dict[str, object],
    ) -> OpenRouterAssistantChatDraft:
        content = self._extract_message_content(response_payload)
        try:
            parsed_content = self._load_json_content(content)
        except json.JSONDecodeError:
            return self._coerce_chat_draft_from_text(content)

        normalized_content = self._normalize_chat_payload(parsed_content)
        try:
            return OpenRouterAssistantChatDraft.model_validate(normalized_content)
        except ValidationError as exc:
            fallback_draft = self._coerce_chat_draft_from_payload(
                normalized_content,
                raw_content=content,
            )
            if fallback_draft is not None:
                return fallback_draft
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail=(
                    "OpenRouter returned a chat payload that did not match the required schema."
                ),
            ) from exc

    def _parse_plan_draft(
        self,
        response_payload: dict[str, object],
    ) -> OpenRouterAssistantPlanDraft:
        content = self._extract_message_content(response_payload)
        try:
            return OpenRouterAssistantPlanDraft.model_validate(
                self._load_json_content(content),
            )
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail=(
                    "OpenRouter returned a plan payload that did not match the required schema."
                ),
            ) from exc

    def _extract_message_content(self, response_payload: dict[str, object]) -> str:
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned no assistant choices.",
            )

        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned an invalid assistant choice.",
            )

        message = first_choice.get("message")
        if not isinstance(message, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned an invalid assistant message.",
            )

        content = self._normalize_message_content(message.get("content"))
        if not content.strip():
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail="OpenRouter returned an empty assistant message.",
            )

        return content

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
            title="Invalid Assistant Response",
            status=502,
            detail="OpenRouter returned an unsupported assistant content shape.",
        )

    def _load_json_content(self, content: str) -> object:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            cleaned = self._strip_code_fences(content)
            if cleaned != content.strip():
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass

            object_start = cleaned.find("{")
            object_end = cleaned.rfind("}")
            if object_start != -1 and object_end > object_start:
                return json.loads(cleaned[object_start : object_end + 1])

            raise

    def _normalize_chat_payload(self, payload: object) -> object:
        if not isinstance(payload, dict):
            return payload

        normalized = dict(payload)
        reply = normalized.get("reply")
        if "content" not in normalized and isinstance(reply, str):
            normalized["content"] = reply

        if "action" not in normalized:
            action_triggered = normalized.get("action_triggered")
            normalized["action"] = (
                action_triggered
                if isinstance(action_triggered, str) and action_triggered.strip()
                else "NONE"
            )

        if "params" not in normalized:
            action_result = normalized.get("action_result")
            normalized["params"] = action_result if isinstance(action_result, dict) else None

        return normalized

    def _coerce_chat_draft_from_payload(
        self,
        payload: object,
        *,
        raw_content: str,
    ) -> OpenRouterAssistantChatDraft | None:
        if isinstance(payload, str):
            return self._coerce_chat_draft_from_text(payload)

        if not isinstance(payload, dict):
            return self._coerce_chat_draft_from_text(raw_content)

        content = payload.get("content")
        if isinstance(content, str) and content.strip():
            return OpenRouterAssistantChatDraft(
                content=content.strip(),
                action="NONE",
                params=None,
            )

        return self._coerce_chat_draft_from_text(raw_content)

    def _coerce_chat_draft_from_text(self, content: str) -> OpenRouterAssistantChatDraft:
        text = self._strip_code_fences(content).strip()
        if not text:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Assistant Response",
                status=502,
                detail=(
                    "OpenRouter returned a chat payload that did not match the required schema."
                ),
            )

        return OpenRouterAssistantChatDraft(
            content=text,
            action="NONE",
            params=None,
        )

    def _strip_code_fences(self, content: str) -> str:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned

    def _extract_model_used(self, response_payload: dict[str, object]) -> str | None:
        model_used = response_payload.get("model")
        if isinstance(model_used, str) and model_used.strip():
            return model_used
        return None

    def _extract_token_count(self, response_payload: dict[str, object]) -> int | None:
        usage = response_payload.get("usage")
        if not isinstance(usage, dict):
            return None

        total_tokens = usage.get("total_tokens")
        if isinstance(total_tokens, int) and total_tokens >= 0:
            return total_tokens

        return None

    def _context_hint(self, context_type: str) -> str:
        hints = {
            "training_plan": (
                "Help the user clarify training preferences and constraints before a plan is generated."
            ),
            "nutrition": (
                "Help the user interpret calorie targets, meal logging, and nutrition tradeoffs."
            ),
            "tdee_adjustment": (
                "Help the user reason about activity level and goal changes before a TDEE recalculation."
            ),
        }
        return hints.get(
            context_type,
            "Help with training, nutrition, and general fitness guidance inside the FitTrack workflow.",
        )


class GroundedFallbackAssistantProvider:
    _DAY_SEQUENCE = (1, 3, 5, 0, 2, 4, 6)
    _STRENGTH_REPS = {
        "bulking": 8,
        "cutting": 10,
        "maintenance": 10,
        "sport_specific": 6,
    }
    _MODEL_NAME = "grounded-fallback"

    def reply_to_message(self, payload: AssistantChatRequest) -> AssistantChatResponse:
        latest_message = self._latest_message(payload)
        action = self._infer_chat_action(
            latest_message,
            payload.session_context.context_type,
        )
        context_hint = self._context_hint(payload.session_context.context_type)
        user_hint = self._user_hint(payload)
        opening_line = self._opening_line(latest_message, action)
        params = self._chat_action_params(action, latest_message, payload)

        return AssistantChatResponse(
            content=(f"{opening_line}{user_hint}{context_hint}").strip(),
            action=action,
            params=params,
            model_used=self._MODEL_NAME,
            token_count=0,
        )

    def generate_plan(self, payload: AssistantPlanRequest) -> AssistantPlanResponse:
        weeks = [
            AssistantPlanWeek(
                week_number=week_number,
                days=self._build_week_days(payload, week_number),
            )
            for week_number in range(1, payload.plan_input.duration_weeks + 1)
        ]

        return AssistantPlanResponse(
            weeks=weeks,
            model_used=self._MODEL_NAME,
            token_count=0,
        )

    def _build_week_days(
        self,
        payload: AssistantPlanRequest,
        week_number: int,
    ) -> list[AssistantPlanDay]:
        return [
            AssistantPlanDay(
                day_of_week=self._DAY_SEQUENCE[index],
                focus_label=self._focus_label(payload.allowed_exercises, index),
                notes=self._build_day_note(payload, week_number),
                exercises=self._build_day_exercises(payload.allowed_exercises, index),
            )
            for index in range(payload.plan_input.days_per_week)
        ]

    def _build_day_exercises(
        self,
        allowed_exercises: list[AllowedExerciseItem],
        day_index: int,
    ) -> list[AssistantPlanExercise]:
        ordered_choices = self._ordered_unique_selection(allowed_exercises, day_index)
        selected = ordered_choices[: min(4, len(ordered_choices))]

        return [
            AssistantPlanExercise(
                name=exercise.name,
                sets=self._sets_for(exercise.category),
                reps=self._reps_for(exercise.category),
                duration_seconds=self._duration_for(exercise.category),
                rest_seconds=self._rest_for(exercise.category),
                weight_kg_target=None,
                order_index=index,
                notes=self._exercise_note(exercise),
            )
            for index, exercise in enumerate(selected)
        ]

    def _ordered_unique_selection(
        self,
        allowed_exercises: list[AllowedExerciseItem],
        day_index: int,
    ) -> list[AllowedExerciseItem]:
        size = len(allowed_exercises)
        indices = [(day_index + offset) % size for offset in range(size)]
        ordered = [allowed_exercises[index] for index in indices]

        primary = [item for item in ordered if item.category == "strength"]
        secondary = [
            item
            for item in ordered
            if item.category in {"cardio", "balance", "flexibility"}
        ]
        return primary + secondary if primary else ordered

    def _focus_label(
        self,
        allowed_exercises: list[AllowedExerciseItem],
        day_index: int,
    ) -> str:
        primary = self._ordered_unique_selection(allowed_exercises, day_index)[0]
        return f"{primary.muscle_group.replace('_', ' ').title()} focus"

    def _build_day_note(self, payload: AssistantPlanRequest, week_number: int) -> str:
        preference_text = (
            payload.plan_input.preferences.strip()
            if payload.plan_input.preferences
            else "Keep sessions sustainable and technically clean."
        )
        return f"Week {week_number}: {preference_text}"

    def _latest_message(self, payload: AssistantChatRequest) -> str:
        for message in reversed(payload.messages):
            if message.role == "user":
                return message.content.strip()
        return payload.messages[-1].content.strip()

    def _context_hint(self, context_type: str) -> str:
        hints = {
            "training_plan": "I can help you narrow preferences and training constraints before you generate a full workout plan.",
            "nutrition": "I can help you interpret calorie targets, meal logging, and nutrition tradeoffs.",
            "tdee_adjustment": "I can help you reason about activity level and goal changes before you recalculate TDEE.",
        }
        return hints.get(
            context_type,
            "I can help with training, nutrition, and general fitness guidance inside the FitTrack workflow.",
        )

    def _user_hint(self, payload: AssistantChatRequest) -> str:
        goal = payload.user_context.fitness_goal
        activity_level = payload.user_context.activity_level

        if goal and activity_level:
            return (
                f"Your current goal is {goal.replace('_', ' ')} and your activity level is {activity_level.replace('_', ' ')}. "
            )

        return ""

    def _opening_line(self, latest_message: str, action: str) -> str:
        if action == "GENERATE_PLAN":
            return "I can build that training plan from your saved profile. "
        if action == "ADJUST_TDEE":
            return "I can recalculate your calorie and macro targets from your saved profile. "

        normalized = latest_message.lower()
        if "stay on track" in normalized:
            return "I can help you stay on track this week. "
        if "nutrition" in normalized:
            return "I can help with nutrition and meal planning. "
        if "workout" in normalized or "training" in normalized:
            return "I can help with training decisions and programming. "
        return ""

    def _infer_chat_action(self, latest_message: str, context_type: str) -> str:
        normalized = latest_message.lower()
        action_verb_match = r"\b(build|create|generate|make|design|write|set up|adjust|recalculate|recalc|update|change|revise|set)\b"
        wants_plan = bool(
            re.search(r"\b(plan|program|routine|split|workout plan|training plan)\b", normalized)
            and (
                context_type == "training_plan"
                or re.search(action_verb_match, normalized) is not None
            )
        )
        wants_tdee = bool(
            re.search(r"\b(tdee|calorie|calories|macro|macros|nutrition)\b", normalized)
            and (
                context_type == "tdee_adjustment"
                or re.search(action_verb_match, normalized) is not None
            )
        )

        if wants_plan:
            return "GENERATE_PLAN"
        if wants_tdee:
            return "ADJUST_TDEE"
        return "NONE"

    def _chat_action_params(
        self,
        action: str,
        latest_message: str,
        payload: AssistantChatRequest,
    ) -> dict[str, object] | None:
        if action == "GENERATE_PLAN":
            return {
                "duration_weeks": self._extract_number(
                    latest_message,
                    r"(\d+)\s*(?:week|weeks)",
                )
                or 4,
                "days_per_week": self._extract_number(
                    latest_message,
                    r"(\d+)\s*(?:day|days)",
                )
                or 3,
                "preferences": latest_message,
            }

        if action == "ADJUST_TDEE":
            params: dict[str, object] = {}
            if payload.user_context.activity_level:
                params["activity_level"] = payload.user_context.activity_level
            if payload.user_context.fitness_goal:
                params["fitness_goal"] = payload.user_context.fitness_goal
            if payload.user_context.weight_kg is not None:
                params["weight_kg"] = payload.user_context.weight_kg
            if payload.user_context.gender:
                params["gender"] = payload.user_context.gender
            return params or None

        return None

    def _extract_number(self, value: str, pattern: str) -> int | None:
        match = re.search(pattern, value, flags=re.IGNORECASE)
        if match is None:
            return None
        try:
            return int(match.group(1))
        except (TypeError, ValueError):
            return None

    def _sets_for(self, category: str) -> int:
        return 4 if category == "strength" else 2 if category == "flexibility" else 1

    def _reps_for(self, category: str) -> int | None:
        if category == "strength":
            return self._STRENGTH_REPS["maintenance"]
        if category == "balance":
            return 12
        return None

    def _duration_for(self, category: str) -> int | None:
        if category == "cardio":
            return 900
        if category == "flexibility":
            return 300
        return None

    def _rest_for(self, category: str) -> int:
        if category == "strength":
            return 90
        if category == "cardio":
            return 60
        return 45

    def _exercise_note(self, exercise: AllowedExerciseItem) -> str:
        return f"Prioritize controlled form for {exercise.muscle_group.replace('_', ' ')} work."


class AssistantService:
    _FITTRACK_SCOPE_KEYWORDS = (
        "fittrack",
        "sertfit",
        "gym",
        "member",
        "membership",
        "booking",
        "schedule",
        "workout",
        "training",
        "exercise",
        "coach",
        "nutrition",
        "calorie",
        "macro",
        "meal",
        "protein",
        "cardio",
        "strength",
        "recovery",
        "tdee",
        "facility",
        "facilities",
    )

    def __init__(
        self,
        provider: AssistantProvider | None = None,
        fallback_provider: GroundedFallbackAssistantProvider | None = None,
    ) -> None:
        self._provider = provider or OpenRouterAssistantProvider()
        self._fallback_provider = fallback_provider or GroundedFallbackAssistantProvider()

    def reply_to_message(self, payload: AssistantChatRequest) -> AssistantChatResponse:
        if self._is_out_of_scope(payload):
            return AssistantChatResponse(
                content=(
                    "I can only help with FitTrack and SertFit topics like workouts, "
                    "nutrition, memberships, schedules, and gym support."
                ),
                action="NONE",
                params=None,
                model_used="scope-guard",
                token_count=None,
            )

        try:
            return self._provider.reply_to_message(payload)
        except ServiceError as exc:
            return AssistantChatResponse(
                content=exc.detail,
                action="NONE",
                params=None,
                model_used="provider-status",
                token_count=None,
            )

    def generate_plan(self, payload: AssistantPlanRequest) -> AssistantPlanResponse:
        try:
            return self._provider.generate_plan(payload)
        except ServiceError as exc:
            if exc.status not in {502, 503}:
                raise
            return self._fallback_provider.generate_plan(payload)

    def _is_out_of_scope(self, payload: AssistantChatRequest) -> bool:
        latest_message = next(
            (
                message.content.strip().lower()
                for message in reversed(payload.messages)
                if message.role == "user" and message.content.strip()
            ),
            "",
        )

        if not latest_message:
            return False

        if len(re.findall(r"\w+", latest_message)) <= 2:
            return False

        if any(
            phrase in latest_message
            for phrase in (
                "stay on track",
                "keep me on track",
                "progress this week",
                "fitness goal",
                "training goal",
                "workout routine",
            )
        ):
            return False

        return not any(keyword in latest_message for keyword in self._FITTRACK_SCOPE_KEYWORDS)
