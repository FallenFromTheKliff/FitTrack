from __future__ import annotations

import json
import logging
import os
import re
import ssl
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from pydantic import ValidationError

from ..errors import ServiceError
from ..models.business_insights import (
    BusinessAnalyticsGroundingPayload,
    BusinessAnalyticsInsightRequest,
    BusinessAnalyticsInsightResponse,
    BusinessInsightOutcomeEvaluationRequest,
    BusinessInsightOutcomeEvaluationResponse,
    GeneratedBusinessInsight,
)

LOGGER = logging.getLogger(__name__)


def _safe_error_summary(error: BaseException) -> str:
    if isinstance(error, ServiceError):
        summary = f"status {error.status} {error.type}: {error.title}. {error.detail}"
    else:
        message = str(error).strip() or "no details"
        summary = f"{type(error).__name__}: {message}"

    summary = re.sub(r"Bearer\s+[^\s]+", "Bearer [REDACTED]", summary, flags=re.IGNORECASE)
    summary = re.sub(
        r"(api[_-]?key|token|authorization)\s*[:=]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        summary,
        flags=re.IGNORECASE,
    )
    summary = re.sub(r"\bsk-[A-Za-z0-9_-]{4,}\b", "sk-[REDACTED]", summary, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", summary).strip()[:400]


class BusinessInsightProvider(Protocol):
    def generate_business_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse: ...

    def evaluate_business_insight_outcome(
        self,
        payload: BusinessInsightOutcomeEvaluationRequest,
    ) -> BusinessInsightOutcomeEvaluationResponse: ...


@dataclass(slots=True)
class OpenRouterInsightSettings:
    api_key: str
    base_url: str
    insight_model: str
    fallback_model: str | None
    http_referer: str | None
    app_title: str | None


AnalysisStage = Literal["combined", "batch", "section", "synthesis"]


@dataclass(frozen=True, slots=True)
class _AnalysisTask:
    section_keys: tuple[str, ...]
    stage: Literal["batch", "section"]


@dataclass(slots=True)
class _AnalysisTaskResult:
    section_keys: tuple[str, ...]
    insight: GeneratedBusinessInsight
    response_payload: dict[str, object]


class OpenRouterBusinessInsightProvider:
    _DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
    _DEFAULT_REQUEST_TIMEOUT_SECONDS = 10.0
    _OUTCOME_EVALUATION_TIMEOUT_SECONDS = 30.0
    _DEFAULT_MAX_ATTEMPTS = 4
    _DEFAULT_MAX_CONCURRENCY = 3
    _MIN_MAX_CONCURRENCY = 1
    _MAX_MAX_CONCURRENCY = 8
    _DETAILED_BATCH_TARGET_CHARS = 12_000
    _MAX_RESPONSE_NORMALIZATION_DEPTH = 4

    def generate_business_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        if payload.analysis is not None:
            return self._generate_configured_business_insight(payload)

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
        return self._build_provider_response(
            payload,
            insight,
            response_payload,
        )

    def evaluate_business_insight_outcome(
        self,
        payload: BusinessInsightOutcomeEvaluationRequest,
    ) -> BusinessInsightOutcomeEvaluationResponse:
        settings = self._get_settings()
        request_variants = [
            self.build_openrouter_outcome_evaluation_request(
                payload,
                response_format_type="json_schema",
                require_parameters=True,
            ),
            self.build_openrouter_outcome_evaluation_request(
                payload,
                response_format_type="json_object",
            ),
            self.build_openrouter_outcome_evaluation_request(
                payload,
                response_format_type="prompt_json",
            ),
        ]
        if (
            settings.fallback_model
            and settings.fallback_model != settings.insight_model
        ):
            request_variants.extend(
                [
                    self.build_openrouter_outcome_evaluation_request(
                        payload,
                        model_override=settings.fallback_model,
                        response_format_type="json_schema",
                        require_parameters=True,
                    ),
                    self.build_openrouter_outcome_evaluation_request(
                        payload,
                        model_override=settings.fallback_model,
                        response_format_type="json_object",
                    ),
                    self.build_openrouter_outcome_evaluation_request(
                        payload,
                        model_override=settings.fallback_model,
                        response_format_type="prompt_json",
                    ),
                ]
            )

        return self._run_outcome_evaluation_variants(
            settings,
            request_variants,
        )

    def build_openrouter_outcome_evaluation_request(
        self,
        payload: BusinessInsightOutcomeEvaluationRequest,
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
        system_prompt = (
            "You evaluate whether later saved gym-business results are consistent "
            "with, contrary to, or inconclusive regarding an earlier AI recommendation. "
            "Use only the two saved snapshots and selected sections provided. Do not "
            "claim that management implemented the recommendation and do not claim "
            "causality. The AI must choose the score and verdict. Use effective only "
            "for scores 7 through 10, partially_effective only for scores 4 through 6, "
            "not_effective only for scores 0 through 3, and insufficient_data only "
            "with a null score. If the available sections or values cannot reasonably "
            "support an evaluation, return insufficient_data. The request contains "
            "comparison_context with the saved-insight timestamps, elapsed minutes, "
            "and whether the underlying analytics snapshot changed. Use that context "
            "when deciding whether enough evidence exists to evaluate the previous "
            "recommendation. If analytics_snapshot_changed is false, the later insight "
            "contains no new observed analytics evidence; do not treat unchanged metrics "
            "as proof that the recommendation failed. Consider elapsed_minutes alongside "
            "the recommendation's stated timeframe. If too little time has elapsed or no "
            "meaningful new evidence exists, return insufficient_data with a null score "
            "and briefly explain why it is too early or why there is no new evidence. "
            "Do not invent elapsed time; use comparison_context.elapsed_minutes. Do not "
            "assume that management implemented the recommendation. Keep the explanation "
            "to one to three short sentences. Return strict JSON only with no extra keys."
        )
        if response_format_type == "prompt_json":
            system_prompt += (
                " Return exactly one JSON object with the keys score, verdict, and "
                "explanation. Do not use markdown, surrounding prose, or extra keys."
            )

        request_payload: dict[str, object] = {
            "model": model_override or settings.insight_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        payload.model_dump(mode="json"),
                        separators=(",", ":"),
                    ),
                },
            ],
            "temperature": 0.1,
        }
        if response_format_type == "json_schema":
            request_payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "business_insight_outcome_evaluation",
                    "strict": True,
                    "schema": BusinessInsightOutcomeEvaluationResponse.model_json_schema(),
                },
            }
            if require_parameters:
                request_payload["provider"] = {"require_parameters": True}
        elif response_format_type == "json_object":
            request_payload["response_format"] = {"type": "json_object"}

        return request_payload

    def _generate_configured_business_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        settings = self._get_settings()
        active_contexts = self._active_section_contexts(payload)
        requested_sections = self._requested_section_names(payload)
        missing_sections = [
            name for name in requested_sections if name not in active_contexts
        ]

        if not active_contexts:
            return BusinessInsightService.build_grounded_fallback(
                payload.grounding,
                failed_sections=missing_sections or requested_sections,
            )

        depth = payload.analysis.analysis_depth
        if depth == "brief":
            try:
                insight, response_payload = self._run_stage_request(
                    settings,
                    payload,
                    stage="combined",
                    active_sections=tuple(active_contexts),
                )
            except Exception as exc:
                LOGGER.warning(
                    "Brief business insight analysis failed; returning grounded fallback: %s",
                    _safe_error_summary(exc),
                )
                return BusinessInsightService.build_grounded_fallback(
                    payload.grounding,
                    failed_sections=missing_sections or list(active_contexts),
                )

            return self._build_provider_response(
                payload,
                insight,
                response_payload,
                failed_sections=missing_sections,
            )

        if depth == "detailed":
            batches = self._build_context_batches(active_contexts)
            tasks = [
                _AnalysisTask(section_keys=batch, stage="batch")
                for batch in batches
            ]
        else:
            tasks = [
                _AnalysisTask(section_keys=(section_key,), stage="section")
                for section_key in active_contexts
            ]

        try:
            results, failed_sections = self._run_analysis_pool(
                settings,
                payload,
                tasks,
            )
        except Exception as exc:
            LOGGER.warning(
                "%s business insight analysis pool failed; returning grounded fallback: %s",
                depth.capitalize(),
                _safe_error_summary(exc),
            )
            return BusinessInsightService.build_grounded_fallback(
                payload.grounding,
                failed_sections=missing_sections or list(active_contexts),
            )

        failed_sections = self._merge_unique_strings(
            missing_sections,
            failed_sections,
        )
        if not results:
            return BusinessInsightService.build_grounded_fallback(
                payload.grounding,
                failed_sections=failed_sections or list(active_contexts),
            )

        source_analyses = self._expand_section_analyses(results)
        source_payloads = [result.response_payload for result in results]
        try:
            synthesized, synthesis_payload = self._run_stage_request(
                settings,
                payload,
                stage="synthesis",
                active_sections=tuple(active_contexts),
                source_analyses=source_analyses,
            )
        except Exception as exc:
            LOGGER.warning(
                "%s business insight synthesis failed; deterministically combining successful analyses: %s",
                depth.capitalize(),
                _safe_error_summary(exc),
            )
            combined = self._combine_successful_analyses(results)
            return self._build_provider_response(
                payload,
                combined,
                {},
                model_used="orchestration-combined",
                token_count=self._sum_token_counts(source_payloads),
                section_analyses=source_analyses,
                failed_sections=failed_sections,
            )

        return self._build_provider_response(
            payload,
            synthesized,
            synthesis_payload,
            model_used=self._extract_model_used(synthesis_payload),
            token_count=self._sum_token_counts(
                [*source_payloads, synthesis_payload]
            ),
            section_analyses=source_analyses,
            failed_sections=failed_sections,
        )

    def _run_stage_request(
        self,
        settings: OpenRouterInsightSettings,
        payload: BusinessAnalyticsInsightRequest,
        *,
        stage: AnalysisStage,
        active_sections: tuple[str, ...],
        source_analyses: Mapping[str, GeneratedBusinessInsight] | None = None,
    ) -> tuple[GeneratedBusinessInsight, dict[str, object]]:
        return self._run_generation_variants(
            settings,
            [
                self.build_openrouter_insight_request(
                    payload,
                    stage=stage,
                    active_sections=active_sections,
                    source_analyses=source_analyses,
                    response_format_type="json_schema",
                    require_parameters=True,
                ),
                self.build_openrouter_insight_request(
                    payload,
                    stage=stage,
                    active_sections=active_sections,
                    source_analyses=source_analyses,
                    response_format_type="json_object",
                ),
                self.build_openrouter_insight_request(
                    payload,
                    stage=stage,
                    active_sections=active_sections,
                    source_analyses=source_analyses,
                    response_format_type="prompt_json",
                ),
                *self._build_fallback_variants(
                    payload,
                    stage=stage,
                    active_sections=active_sections,
                    source_analyses=source_analyses,
                ),
            ],
        )

    def _run_analysis_pool(
        self,
        settings: OpenRouterInsightSettings,
        payload: BusinessAnalyticsInsightRequest,
        tasks: list[_AnalysisTask],
    ) -> tuple[list[_AnalysisTaskResult], list[str]]:
        if not tasks:
            return [], []

        results_by_index: dict[int, _AnalysisTaskResult] = {}
        failed_by_index: dict[int, tuple[str, ...]] = {}
        with ThreadPoolExecutor(
            max_workers=self._max_concurrency(),
            thread_name_prefix="business-insight",
        ) as pool:
            future_to_index = {
                pool.submit(
                    self._run_stage_request,
                    settings,
                    payload,
                    stage=task.stage,
                    active_sections=task.section_keys,
                ): index
                for index, task in enumerate(tasks)
            }
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                task = tasks[index]
                try:
                    insight, response_payload = future.result()
                except Exception as exc:
                    failed_by_index[index] = task.section_keys
                    LOGGER.warning(
                        "Business insight %s analysis failed for %s: %s",
                        task.stage,
                        ", ".join(task.section_keys),
                        _safe_error_summary(exc),
                    )
                    continue
                results_by_index[index] = _AnalysisTaskResult(
                    section_keys=task.section_keys,
                    insight=insight,
                    response_payload=response_payload,
                )

        ordered_results = [
            results_by_index[index]
            for index in range(len(tasks))
            if index in results_by_index
        ]
        failed_sections: list[str] = []
        for index in range(len(tasks)):
            for section_key in failed_by_index.get(index, ()):
                if section_key not in failed_sections:
                    failed_sections.append(section_key)
        return ordered_results, failed_sections

    def _build_context_batches(
        self,
        contexts: Mapping[str, object],
    ) -> list[tuple[str, ...]]:
        batches: list[tuple[str, ...]] = []
        current: list[str] = []
        current_weight = 0
        for section_key, context in contexts.items():
            weight = self._context_weight(context)
            if current and current_weight + weight > self._DETAILED_BATCH_TARGET_CHARS:
                batches.append(tuple(current))
                current = []
                current_weight = 0
            current.append(section_key)
            current_weight += weight
        if current:
            batches.append(tuple(current))
        return batches

    @staticmethod
    def _context_weight(context: object) -> int:
        return len(
            json.dumps(
                context,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        )

    def _max_concurrency(self) -> int:
        raw_concurrency = os.getenv("OPENROUTER_BUSINESS_INSIGHT_MAX_CONCURRENCY", "")
        try:
            concurrency = int(raw_concurrency)
        except ValueError:
            return self._DEFAULT_MAX_CONCURRENCY
        return min(
            max(concurrency, self._MIN_MAX_CONCURRENCY),
            self._MAX_MAX_CONCURRENCY,
        )

    def _active_section_contexts(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> dict[str, object]:
        if payload.analysis is None:
            return {}
        contexts = payload.analysis.section_contexts
        selected = self._dedupe_strings(payload.analysis.selected_sections)
        names = selected or list(contexts)
        return {
            section_key: contexts[section_key]
            for section_key in names
            if section_key in contexts
        }

    def _requested_section_names(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> list[str]:
        if payload.analysis is None:
            return []
        selected = self._dedupe_strings(payload.analysis.selected_sections)
        return selected or list(payload.analysis.section_contexts)

    def _expand_section_analyses(
        self,
        results: list[_AnalysisTaskResult],
    ) -> dict[str, GeneratedBusinessInsight]:
        expanded: dict[str, GeneratedBusinessInsight] = {}
        for result in results:
            for section_key in result.section_keys:
                expanded[section_key] = result.insight
        return expanded

    def _combine_successful_analyses(
        self,
        results: list[_AnalysisTaskResult],
    ) -> GeneratedBusinessInsight:
        insights = [result.insight for result in results]
        summaries = self._dedupe_strings([insight.summary for insight in insights])
        summary = self._truncate_text(
            "Cross-section findings: " + " ".join(summaries),
            1200,
        )
        return GeneratedBusinessInsight(
            summary=summary,
            highlights=self._dedupe_strings(
                [item for insight in insights for item in insight.highlights]
            )[:5],
            risks=self._dedupe_strings(
                [item for insight in insights for item in insight.risks]
            )[:5],
            opportunities=self._dedupe_strings(
                [item for insight in insights for item in insight.opportunities]
            )[:5],
            anomaly_flags=self._dedupe_strings(
                [item for insight in insights for item in insight.anomaly_flags]
            )[:8],
            recommended_actions=self._dedupe_strings(
                [
                    item
                    for insight in insights
                    for item in insight.recommended_actions
                ]
            )[:3],
        )

    def _build_provider_response(
        self,
        payload: BusinessAnalyticsInsightRequest,
        insight: GeneratedBusinessInsight,
        response_payload: dict[str, object],
        *,
        model_used: str | None = None,
        token_count: int | None = None,
        section_analyses: Mapping[str, GeneratedBusinessInsight] | None = None,
        failed_sections: list[str] | None = None,
    ) -> BusinessAnalyticsInsightResponse:
        anomaly_flags = self._merge_unique_strings(
            insight.anomaly_flags,
            BusinessInsightService.detect_anomalies(payload.grounding),
        )[:8]
        return BusinessAnalyticsInsightResponse(
            summary=insight.summary,
            highlights=insight.highlights,
            risks=insight.risks,
            opportunities=insight.opportunities,
            anomaly_flags=anomaly_flags,
            recommended_actions=insight.recommended_actions,
            model_used=(
                model_used
                if model_used is not None
                else self._extract_model_used(response_payload)
            ),
            token_count=(
                token_count
                if token_count is not None
                else self._extract_token_count(response_payload)
            ),
            section_analyses=dict(section_analyses) if section_analyses else None,
            failed_sections=self._dedupe_strings(failed_sections or []),
        )

    @staticmethod
    def _sum_token_counts(payloads: list[dict[str, object]]) -> int | None:
        counts: list[int] = []
        for response_payload in payloads:
            usage = response_payload.get("usage")
            if not isinstance(usage, dict):
                continue
            total_tokens = usage.get("total_tokens")
            if isinstance(total_tokens, int) and total_tokens >= 0:
                counts.append(total_tokens)
        return sum(counts) if counts else None

    @staticmethod
    def _truncate_text(value: str, max_length: int) -> str:
        return value[:max_length].rstrip() or "Cross-section analysis was inconclusive."

    @staticmethod
    def _dedupe_strings(values: list[str] | tuple[str, ...]) -> list[str]:
        return list(dict.fromkeys(value for value in values if value))

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
        stage: AnalysisStage = "combined",
        active_sections: tuple[str, ...] | list[str] | None = None,
        source_analyses: Mapping[str, GeneratedBusinessInsight] | None = None,
    ) -> dict[str, object]:
        settings = self._get_settings()
        anomaly_flags = BusinessInsightService.detect_anomalies(payload.grounding)
        if payload.analysis is None:
            system_prompt = (
                "You are a grounded gym business decision analyst. Use only the provided "
                "analytics grounding and its deterministic comparisons and derived_signals. "
            )
        else:
            system_prompt = (
                "You are a grounded gym business decision analyst. Use only the provided "
                "selected analytics section contexts and source analyses. Never infer or "
                "use an unselected domain. "
            )
        system_prompt += (
            "Never restate a dashboard metric by itself: a metric may appear only with "
            "a comparison, anomaly, concentration, tradeoff, or operational implication. "
            "The summary must answer what changed, why it matters, and what should happen "
            "next. Comparative language is forbidden unless comparator evidence exists. "
            "Treat a null percentage_change as an explicit zero-baseline case and never "
            "invent a percentage. Unsupported causes must be labeled as possible drivers "
            "or hypotheses. Every highlight, risk, and opportunity must contain evidence "
            "plus its implication. Return at most three prioritized recommended_actions. "
            "Every action must use exactly this structure: 'Owner · timeframe — action. "
            "Success: measurable outcome.' Never recommend merely reviewing, observing, "
            "or monitoring the dashboard. Return strict JSON only, with no markdown, no "
            "prose outside the JSON object, and no extra keys. If data is thin, state the "
            "evidence limitation and still give a bounded operational decision. Produce "
            "key findings, trends, anomalies or risks, implications, prioritized actions, "
            "and a cross-section conclusion. Do not provide naked stat restatement. "
        )
        stage_instructions = {
            "combined": "Analysis stage: combined. Analyze all active selected sections together.",
            "batch": "Analysis stage: batch. Analyze this context-weighted batch and its internal relationships.",
            "section": "Analysis stage: section. Analyze this selected section deeply and stay within its context.",
            "synthesis": "Analysis stage: synthesis. Reconcile source analyses into one cross-section conclusion; preserve evidence and call out conflicts or gaps.",
        }
        system_prompt += f" {stage_instructions[stage]}"
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
                        self._build_provider_user_content(
                            payload,
                            stage=stage,
                            active_sections=active_sections,
                            source_analyses=source_analyses,
                            anomaly_flags=anomaly_flags,
                        ),
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

    def _build_provider_user_content(
        self,
        payload: BusinessAnalyticsInsightRequest,
        *,
        stage: AnalysisStage,
        active_sections: tuple[str, ...] | list[str] | None,
        source_analyses: Mapping[str, GeneratedBusinessInsight] | None,
        anomaly_flags: list[str],
    ) -> dict[str, object]:
        if payload.analysis is None:
            return {
                "grounding": payload.grounding.model_dump(mode="json"),
                "detected_anomaly_flags": anomaly_flags,
            }

        allowed_contexts = self._active_section_contexts(payload)
        requested_sections = (
            list(active_sections)
            if active_sections is not None
            else list(allowed_contexts)
        )
        active_names = [
            section_key
            for section_key in requested_sections
            if section_key in allowed_contexts
        ]
        content: dict[str, object] = {
            "analysis_depth": payload.analysis.analysis_depth,
            "stage": stage,
            "active_sections": active_names,
            "section_contexts": {
                section_key: allowed_contexts[section_key]
                for section_key in active_names
            },
        }
        if payload.analysis.data_fingerprint:
            content["data_fingerprint"] = payload.analysis.data_fingerprint
        if source_analyses is not None and stage == "synthesis":
            content["source_analyses"] = {
                section_key: source_analyses[section_key].model_dump(mode="json")
                for section_key in active_names
                if section_key in source_analyses
            }
        return content

    def _post_chat_completion(
        self,
        settings: OpenRouterInsightSettings,
        request_payload: dict[str, object],
        *,
        timeout_seconds: float | None = None,
    ) -> httpx.Response:
        try:
            return httpx.post(
                f"{settings.base_url.rstrip('/')}/chat/completions",
                json=request_payload,
                headers=self._build_headers(settings),
                timeout=(
                    timeout_seconds
                    if timeout_seconds is not None
                    else self._request_timeout_seconds()
                ),
                verify=self._build_ssl_context(),
                trust_env=False,
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

    def _build_ssl_context(self) -> ssl.SSLContext:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.load_default_certs()
        return context

    def _run_outcome_evaluation_variants(
        self,
        settings: OpenRouterInsightSettings,
        payloads: list[dict[str, object]],
    ) -> BusinessInsightOutcomeEvaluationResponse:
        last_error: ServiceError | None = None
        for request_payload in payloads:
            try:
                response = self._post_chat_completion(
                    settings,
                    request_payload,
                    timeout_seconds=self._OUTCOME_EVALUATION_TIMEOUT_SECONDS,
                )
            except ServiceError as exc:
                last_error = exc
                continue

            if response.status_code >= 400:
                last_error = self._build_upstream_error(response)
                continue

            try:
                response_payload = response.json()
            except ValueError as exc:
                last_error = ServiceError(
                    type="BAD_GATEWAY",
                    title="Invalid Business Insight Comparison Response",
                    status=502,
                    detail="OpenRouter returned a non-JSON comparison payload.",
                )
                last_error.__cause__ = exc
                continue

            try:
                return self._parse_outcome_evaluation(response_payload)
            except ServiceError as exc:
                last_error = exc

        if last_error is not None:
            raise last_error

        raise ServiceError(
            type="SERVICE_UNAVAILABLE",
            title="Business Insight Provider Unavailable",
            status=503,
            detail="OpenRouter business insight comparison is unavailable.",
        )

    def _run_generation_variants(
        self,
        settings: OpenRouterInsightSettings,
        payloads: list[dict[str, object]],
    ) -> tuple[GeneratedBusinessInsight, dict[str, object]]:
        last_response: httpx.Response | None = None
        last_error: ServiceError | None = None
        for request_payload in payloads[: self._max_attempts()]:
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
        *,
        stage: AnalysisStage = "combined",
        active_sections: tuple[str, ...] | list[str] | None = None,
        source_analyses: Mapping[str, GeneratedBusinessInsight] | None = None,
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
                stage=stage,
                active_sections=active_sections,
                source_analyses=source_analyses,
            ),
            self.build_openrouter_insight_request(
                payload,
                model_override=settings.fallback_model,
                response_format_type="json_object",
                stage=stage,
                active_sections=active_sections,
                source_analyses=source_analyses,
            ),
            self.build_openrouter_insight_request(
                payload,
                model_override=settings.fallback_model,
                response_format_type="prompt_json",
                stage=stage,
                active_sections=active_sections,
                source_analyses=source_analyses,
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

    def _request_timeout_seconds(self) -> float:
        raw_timeout = os.getenv("OPENROUTER_BUSINESS_INSIGHT_TIMEOUT_SECONDS", "")
        try:
            timeout = float(raw_timeout)
        except ValueError:
            return self._DEFAULT_REQUEST_TIMEOUT_SECONDS

        return min(max(timeout, 3.0), 10.0)

    def _max_attempts(self) -> int:
        raw_attempts = os.getenv("OPENROUTER_BUSINESS_INSIGHT_MAX_ATTEMPTS", "")
        try:
            attempts = int(raw_attempts)
        except ValueError:
            return self._DEFAULT_MAX_ATTEMPTS

        return min(max(attempts, 1), 4)

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
            insight = GeneratedBusinessInsight.model_validate(
                self._normalize_insight_payload(parsed_content)
            )
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

    def _parse_outcome_evaluation(
        self,
        response_payload: object,
    ) -> BusinessInsightOutcomeEvaluationResponse:
        if not isinstance(response_payload, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Comparison Response",
                status=502,
                detail="OpenRouter returned an invalid comparison envelope.",
            )
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Comparison Response",
                status=502,
                detail="OpenRouter returned no comparison choices.",
            )
        first_choice = choices[0]
        message = first_choice.get("message") if isinstance(first_choice, dict) else None
        if not isinstance(message, dict):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Comparison Response",
                status=502,
                detail="OpenRouter returned an invalid comparison message.",
            )

        content = self._normalize_message_content(message.get("content"))
        if not content.strip() or self._is_refusal_like(content):
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Comparison Response",
                status=502,
                detail="OpenRouter returned no usable comparison result.",
            )

        try:
            return BusinessInsightOutcomeEvaluationResponse.model_validate(
                self._load_json_content(content)
            )
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ServiceError(
                type="BAD_GATEWAY",
                title="Invalid Business Insight Comparison Response",
                status=502,
                detail=(
                    "OpenRouter returned a comparison payload that did not "
                    "match the required schema."
                ),
            ) from exc

    def _normalize_message_content(self, content: object) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, dict):
            return json.dumps(content, ensure_ascii=False, separators=(",", ":"))

        if isinstance(content, list):
            text_parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    text_parts.append(item)
                elif (
                    isinstance(item, dict)
                    and item.get("type") in {"text", "output_text"}
                    and isinstance(item.get("text"), str)
                ):
                    text_parts.append(item["text"])

            if text_parts:
                return "".join(text_parts)
            if content:
                return json.dumps(content, ensure_ascii=False, separators=(",", ":"))

        raise ServiceError(
            type="BAD_GATEWAY",
            title="Invalid Business Insight Response",
            status=502,
            detail="OpenRouter returned an unsupported business insight content shape.",
        )

    def _load_json_content(self, content: str) -> object:
        cleaned = self._strip_code_fences(content).strip()
        parsed: object = cleaned

        for _ in range(self._MAX_RESPONSE_NORMALIZATION_DEPTH):
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                object_start = cleaned.find("{")
                object_end = cleaned.rfind("}")
                if object_start == -1 or object_end <= object_start:
                    raise
                parsed = json.loads(cleaned[object_start : object_end + 1])

            if not isinstance(parsed, str):
                return parsed

            nested = self._strip_code_fences(parsed).strip()
            if not nested or nested == cleaned or not nested.startswith(("{", "[", '"')):
                return parsed
            cleaned = nested

        return parsed

    @staticmethod
    def _strip_code_fences(content: str) -> str:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```JSON")
            cleaned = cleaned.removeprefix("```").removesuffix("```").strip()
        return cleaned

    def _normalize_insight_payload(
        self,
        payload: object,
        *,
        depth: int = 0,
    ) -> object:
        if depth > self._MAX_RESPONSE_NORMALIZATION_DEPTH:
            return payload

        if isinstance(payload, str):
            try:
                nested = self._load_json_content(payload)
            except json.JSONDecodeError:
                return payload
            if isinstance(nested, str) and nested == payload:
                return payload
            return self._normalize_insight_payload(nested, depth=depth + 1)

        if isinstance(payload, list):
            for item in payload:
                normalized = self._normalize_insight_payload(
                    item,
                    depth=depth + 1,
                )
                if isinstance(normalized, dict) and normalized.get("summary"):
                    return normalized
            return payload

        if not isinstance(payload, dict):
            return payload

        contract_keys = {
            "summary",
            "executive_summary",
            "highlights",
            "risks",
            "opportunities",
            "anomaly_flags",
            "anomalyFlags",
            "recommended_actions",
            "recommendedActions",
            "actions",
        }
        if not any(key in payload for key in contract_keys):
            for wrapper_key in ("data", "result", "insight", "response", "output"):
                if wrapper_key not in payload:
                    continue
                normalized = self._normalize_insight_payload(
                    payload[wrapper_key],
                    depth=depth + 1,
                )
                if isinstance(normalized, dict):
                    return normalized

        normalized_payload: dict[str, object] = {}
        if "summary" in payload or "executive_summary" in payload:
            normalized_payload["summary"] = self._normalize_summary(
                payload.get("summary", payload.get("executive_summary"))
            )
        for field_name in ("highlights", "risks", "opportunities"):
            if field_name in payload:
                normalized_payload[field_name] = self._normalize_string_list(
                    payload[field_name]
                )
        if "anomaly_flags" in payload or "anomalyFlags" in payload:
            normalized_payload["anomaly_flags"] = self._normalize_string_list(
                payload.get("anomaly_flags", payload.get("anomalyFlags"))
            )
        if any(
            key in payload
            for key in ("recommended_actions", "recommendedActions", "actions")
        ):
            normalized_payload["recommended_actions"] = self._normalize_string_list(
                payload.get(
                    "recommended_actions",
                    payload.get("recommendedActions", payload.get("actions")),
                )
            )
        return normalized_payload

    def _normalize_summary(self, value: object) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            for key in ("text", "content", "summary", "description"):
                candidate = value.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    return candidate.strip()
        if isinstance(value, list):
            parts = self._normalize_string_list(value)
            return " ".join(parts)
        return ""

    def _normalize_string_list(self, value: object) -> list[str]:
        values = value if isinstance(value, list) else [value]
        normalized: list[str] = []
        for item in values:
            if isinstance(item, str):
                cleaned = item.strip()
                if not cleaned:
                    continue
                try:
                    nested = self._load_json_content(cleaned)
                except json.JSONDecodeError:
                    nested = cleaned
                if not isinstance(nested, str):
                    normalized.extend(self._normalize_string_list(nested))
                else:
                    normalized.append(nested.strip())
                continue
            if isinstance(item, (int, float)):
                normalized.append(str(item))
                continue
            if isinstance(item, dict):
                for key in ("text", "content", "description", "action", "label"):
                    candidate = item.get(key)
                    if isinstance(candidate, str) and candidate.strip():
                        normalized.append(candidate.strip())
                        break

        return list(dict.fromkeys(normalized))

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
        self._uses_default_provider = provider is None
        self._provider = provider or OpenRouterBusinessInsightProvider()

    def generate_insight(
        self,
        payload: BusinessAnalyticsInsightRequest,
    ) -> BusinessAnalyticsInsightResponse:
        missing_config = (
            self._missing_provider_config() if self._uses_default_provider else []
        )
        if missing_config:
            LOGGER.warning(
                "OpenRouter business insight generation is not configured; "
                "missing %s. Returning grounded fallback.",
                ", ".join(missing_config),
            )
            return self.build_grounded_fallback(payload.grounding)

        try:
            return self._provider.generate_business_insight(payload)
        except ServiceError as exc:
            if exc.status not in {502, 503}:
                raise
            LOGGER.warning(
                "OpenRouter business insight generation failed (%s): %s. "
                "Returning grounded fallback.",
                exc.title,
                _safe_error_summary(exc),
            )
            return self.build_grounded_fallback(payload.grounding)

    def evaluate_outcome(
        self,
        payload: BusinessInsightOutcomeEvaluationRequest,
    ) -> BusinessInsightOutcomeEvaluationResponse:
        missing_config = (
            self._missing_provider_config() if self._uses_default_provider else []
        )
        if missing_config:
            raise ServiceError(
                type="SERVICE_UNAVAILABLE",
                title="Business Insight Comparison Unavailable",
                status=503,
                detail=(
                    "OpenRouter business insight comparison is not configured; "
                    "missing " + ", ".join(missing_config) + "."
                ),
            )

        return self._provider.evaluate_business_insight_outcome(payload)

    @staticmethod
    def _missing_provider_config() -> list[str]:
        missing: list[str] = []

        if not os.getenv("OPENROUTER_API_KEY", "").strip():
            missing.append("OPENROUTER_API_KEY")

        if not (
            os.getenv("OPENROUTER_BUSINESS_INSIGHT_MODEL", "").strip()
            or os.getenv("OPENROUTER_INSIGHT_MODEL", "").strip()
        ):
            missing.append(
                "OPENROUTER_BUSINESS_INSIGHT_MODEL or OPENROUTER_INSIGHT_MODEL"
            )

        return missing

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
        *,
        section_analyses: Mapping[str, GeneratedBusinessInsight] | None = None,
        failed_sections: list[str] | None = None,
    ) -> BusinessAnalyticsInsightResponse:
        anomaly_flags = BusinessInsightService.detect_anomalies(grounding)
        comparisons = grounding.comparisons
        signals = grounding.derived_signals
        inventory = grounding.inventory
        concentration = signals.top_revenue_source_concentration
        peak = signals.peak_hour_attendance_concentration
        revenue_change = BusinessInsightService._comparison_statement(
            "Revenue", comparisons.total_revenue, money=True
        )
        attendance_change = BusinessInsightService._comparison_statement(
            "Check-ins", comparisons.check_ins
        )
        membership_change = BusinessInsightService._comparison_statement(
            "New members", comparisons.new_members
        )
        coaching_change = BusinessInsightService._comparison_statement(
            "Completed coaching sessions", comparisons.completed_coaching_sessions
        )
        revenue_implication = (
            f"{concentration.source_label} supplies {concentration.percentage:.1f}% of revenue, so execution in that lane has an outsized effect"
            if concentration
            else "no revenue source concentration is established, so the next move should restore completed revenue without assuming a leading lane"
        )
        attendance_implication = (
            f"{peak.percentage:.1f}% of check-ins land at {peak.hour_label}, so coverage should match that demand concentration"
            if peak
            else "no reliable peak-hour concentration exists, so staffing changes should remain bounded until demand timing is established"
        )
        inventory_evidence_parts = [
            (
                f"equipment availability is {signals.equipment_availability_percentage:.1f}%"
                if signals.equipment_availability_percentage is not None
                else None
            ),
            (
                f"low-stock exposure is {signals.low_stock_exposure_percentage:.1f}%"
                if signals.low_stock_exposure_percentage is not None
                else None
            ),
            (
                f"out-of-stock exposure is {signals.out_of_stock_exposure_percentage:.1f}%"
                if signals.out_of_stock_exposure_percentage is not None
                else None
            ),
        ]
        inventory_evidence_parts = [value for value in inventory_evidence_parts if value]
        inventory_evidence = (
            f"Inventory exposure shows {', '.join(inventory_evidence_parts)}"
            if inventory_evidence_parts
            else "Inventory availability and stock exposure are unavailable because no reliable equipment or retail denominator exists"
        )
        inventory_implication = (
            "service continuity and retail conversion depend on resolving the measured availability gaps"
            if inventory_evidence_parts
            else "the next inventory decision must restore trustworthy denominators before allocation targets are set"
        )

        finance_action = (
            "Finance · next 3 business days — reconcile the declining revenue lanes and correct confirmed capture gaps. Success: 100% of the absolute revenue change is attributed to a source."
            if comparisons.total_revenue.direction == "decrease"
            else "Revenue lead · next 7 days — execute one source-specific conversion offer while protecting revenue mix. Success: total revenue improves in the next same-length window."
        )
        attendance_action = (
            f"Operations · next 7 days — align front-desk and floor coverage to the {peak.hour_label} demand peak. Success: peak-hour member wait time stays under 3 minutes."
            if peak
            else "Operations · next 7 days — assign coverage across operating hours and restore valid check-in capture. Success: every operating hour has assigned coverage and recorded demand."
        )
        membership_action = "Membership lead · next 7 days — complete a structured onboarding touchpoint for every new member in this window. Success: 100% of the cohort receives the touchpoint."
        coaching_action = "Coaching lead · next 7 days — match coach capacity and follow-on offers to completed-session demand. Success: every completed session receives a documented next-step offer."
        if inventory and inventory.out_of_stock_items > 0:
            inventory_action = f"Inventory lead · next 48 hours — replenish or substitute the {inventory.out_of_stock_items} out-of-stock items. Success: out-of-stock exposure reaches 0%."
        elif (
            signals.equipment_availability_percentage is not None
            and signals.equipment_availability_percentage < 100
        ):
            inventory_action = "Facilities lead · next 7 days — return serviceable equipment to the available pool. Success: equipment availability reaches 100%."
        elif inventory_evidence_parts:
            inventory_action = "Inventory lead · next 7 days — protect current equipment and retail availability through scheduled replenishment. Success: out-of-stock exposure remains at 0%."
        else:
            inventory_action = "Inventory lead · next 3 business days — restore equipment-unit and retail-item denominator capture. Success: availability and stock exposure are calculable."
        overview_action = "General manager · next 7 days — sequence the revenue, attendance, membership, and coaching owners around the largest measured change. Success: one accountable owner and target are recorded for each declining lane."

        focus = grounding.window.focus
        if focus == "revenue":
            primary_evidence = revenue_change
            implication = revenue_implication
            primary_action = finance_action
            highlights = [
                f"{revenue_change}; {revenue_implication}.",
                (
                    f"{concentration.source_label} contributes {concentration.percentage:.1f}% of revenue; source-level execution will materially affect the total."
                    if concentration
                    else f"{revenue_change}; a missing source concentration means recovery should avoid assuming which lane will lead."
                ),
            ]
            risks = [
                (
                    f"{concentration.source_label} represents {concentration.percentage:.1f}% of revenue; the mix is exposed to disruption in one income stream."
                    if concentration and concentration.percentage >= 60
                    else f"{revenue_change}; failure to act on the measured movement would leave operating headroom exposed."
                )
            ]
            opportunities = [f"{revenue_change}; a source-specific conversion action can test whether the measured movement is reversible."]
            secondary_actions: list[str] = []
        elif focus == "attendance":
            primary_evidence = attendance_change
            implication = attendance_implication
            primary_action = attendance_action
            highlights = [
                f"{attendance_change}; {attendance_implication}.",
                (
                    f"{peak.check_ins} check-ins occurred at {peak.hour_label}, or {peak.percentage:.1f}% of the total; concentrating coverage there targets proven demand."
                    if peak
                    else f"{attendance_change}; absent peak evidence limits staffing changes to coverage and capture reliability."
                ),
            ]
            risks = [f"{attendance_change}; a mismatch between demand and floor coverage can weaken service quality."]
            opportunities = [
                (
                    f"{peak.percentage:.1f}% of attendance lands at {peak.hour_label}; aligning service and offers there concentrates effort where demand is proven."
                    if peak
                    else f"{attendance_change}; restoring demand timing can unlock a defensible staffing allocation."
                )
            ]
            secondary_actions = []
        elif focus == "membership":
            primary_evidence = membership_change
            implication = "the measured cohort changes the immediate onboarding and early-retention workload"
            primary_action = membership_action
            highlights = [f"{membership_change}; the cohort size determines how much onboarding capacity is needed now."]
            risks = [f"{membership_change}; unowned onboarding would put the value of this measured cohort at risk."]
            opportunities = [f"{membership_change}; a complete first-week touchpoint can convert the measured acquisition into early engagement."]
            secondary_actions = []
        elif focus == "coaching":
            primary_evidence = coaching_change
            implication = "the session movement changes coach-capacity needs and the available follow-on pipeline"
            primary_action = coaching_action
            highlights = [f"{coaching_change}; capacity and next-step offers should follow completed-session demand."]
            risks = [f"{coaching_change}; an unmatched coach roster can create either service pressure or idle capacity."]
            opportunities = [f"{coaching_change}; documented follow-on offers can turn completed sessions into a measurable continuation pipeline."]
            secondary_actions = []
        elif focus == "inventory":
            primary_evidence = inventory_evidence
            implication = inventory_implication
            primary_action = inventory_action
            highlights = [f"{inventory_evidence}; {inventory_implication}."]
            risks = [f"{inventory_evidence}; unresolved availability or denominator gaps can hide service and retail exposure."]
            opportunities = [f"{inventory_evidence}; targeted replenishment or data repair can make the next allocation decision measurable."]
            secondary_actions = []
        else:
            primary_evidence = f"Cross-domain priority: {revenue_change}, while {attendance_change.lower()}"
            implication = "the operating response must balance financial movement with service demand and cohort workload"
            primary_action = overview_action
            highlights = [
                f"{primary_evidence}; {implication}.",
                f"{membership_change}; onboarding ownership must scale with the measured cohort.",
                f"{coaching_change}; coach capacity and follow-on work should match completed demand.",
            ]
            risks = [
                f"{revenue_change}; continued contraction would reduce operating headroom."
                if comparisons.total_revenue.direction == "decrease"
                else f"{attendance_change}; service capacity must remain aligned with measured demand."
            ]
            opportunities = [f"{membership_change}; focused onboarding can improve the value captured from the measured cohort."]
            secondary_actions = [
                *([finance_action] if comparisons.total_revenue.direction == "decrease" else []),
                *([attendance_action] if peak else []),
            ]

        recommended_actions = BusinessInsightService._unique_strings(
            [primary_action, *secondary_actions]
        )[:3]
        next_action = recommended_actions[0].split(" — ", maxsplit=1)[1]
        summary = f"{primary_evidence}. It matters because {implication}. Next, {next_action}"

        return BusinessAnalyticsInsightResponse(
            summary=summary,
            highlights=BusinessInsightService._unique_strings(highlights)[:5],
            risks=BusinessInsightService._unique_strings(risks),
            opportunities=BusinessInsightService._unique_strings(opportunities),
            anomaly_flags=anomaly_flags,
            recommended_actions=BusinessInsightService._unique_strings(recommended_actions)[:3],
            model_used="grounded-fallback",
            token_count=None,
            section_analyses=dict(section_analyses) if section_analyses else None,
            failed_sections=BusinessInsightService._unique_strings(
                failed_sections or []
            ),
        )

    @staticmethod
    def _comparison_statement(label: str, comparison: object, *, money: bool = False) -> str:
        current = float(comparison.current) if money else int(comparison.current)
        previous = float(comparison.previous) if money else int(comparison.previous)
        absolute = float(comparison.absolute_change) if money else int(comparison.absolute_change)
        formatter = BusinessInsightService._format_money if money else lambda value: f"{int(value):,}"
        if comparison.direction == "new_from_zero":
            return f"{label} established a new baseline at {formatter(current)} after a zero prior period"
        if comparison.direction == "flat":
            return f"{label} held at {formatter(current)} versus {formatter(previous)} in the prior period"
        verb = "increased" if comparison.direction == "increase" else "decreased"
        percentage = (
            f" ({abs(comparison.percentage_change):.1f}%)"
            if comparison.percentage_change is not None
            else ""
        )
        return (
            f"{label} {verb} by {formatter(abs(absolute))}{percentage}, "
            f"from {formatter(previous)} to {formatter(current)}"
        )

    @staticmethod
    def _format_money(value: float) -> str:
        return f"₱{value:,.2f}"

    @staticmethod
    def _unique_strings(values: list[str]) -> list[str]:
        deduped: list[str] = []
        for value in values:
            if value and value not in deduped:
                deduped.append(value)
        return deduped
