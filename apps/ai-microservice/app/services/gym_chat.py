from __future__ import annotations

from ..models.gym_chat import (
    GymChatGroundingPayload,
    GymChatRequest,
    GymChatResponse,
)


class GymChatService:
    _GYM_SCOPE_KEYWORDS = (
        "gym",
        "hours",
        "open",
        "close",
        "schedule",
        "holiday",
        "promo",
        "promotion",
        "discount",
        "membership",
        "rate",
        "price",
        "day pass",
        "coach",
        "coaching",
        "trainer",
        "class",
        "amenities",
        "locker",
        "rules",
        "faq",
        "workout",
        "training",
        "nutrition",
    )

    _OUT_OF_SCOPE_SUGGESTIONS = [
        "Ask about gym hours or holiday schedules.",
        "Ask about membership plans or current promotions.",
    ]

    def reply_to_message(self, payload: GymChatRequest) -> GymChatResponse:
        message = payload.message.strip().lower()

        if self._is_out_of_scope(message):
            return GymChatResponse(
                reply=(
                    "I can only help with gym support topics like hours, "
                    "memberships, promotions, schedules, and FAQs."
                ),
                out_of_scope=True,
                sources=[],
                follow_up_suggestions=list(self._OUT_OF_SCOPE_SUGGESTIONS),
                model_used=None,
                token_count=None,
            )

        sources = self._select_sources(message, payload)
        reply = self._build_reply(message, sources, payload)
        follow_up_suggestions = self._build_follow_up_suggestions(sources)

        return GymChatResponse(
            reply=reply,
            out_of_scope=False,
            sources=sources,
            follow_up_suggestions=follow_up_suggestions,
            model_used=None,
            token_count=None,
        )

    def _is_out_of_scope(self, message: str) -> bool:
        return not any(keyword in message for keyword in self._GYM_SCOPE_KEYWORDS)

    def _select_sources(self, message: str, payload: GymChatRequest) -> list[str]:
        sources: list[str] = []
        grounding = payload.grounding

        if self._needs_hours_source(message, grounding):
            sources.append("operating_hours")

        if "holiday" in message and grounding.special_schedules:
            sources.append("special_schedules")

        if any(keyword in message for keyword in ("promo", "promotion", "discount")):
            if grounding.promotions:
                sources.append("promotions")

        if any(keyword in message for keyword in ("membership", "price", "rate", "day pass")):
            if grounding.membership_plans:
                sources.append("membership_plans")

        if any(keyword in message for keyword in ("faq", "rule", "coach", "class", "nutrition")):
            if grounding.faqs:
                sources.append("faqs")

        if not sources:
            if grounding.membership_plans:
                sources.append("membership_plans")
            elif grounding.faqs:
                sources.append("faqs")
            elif grounding.operating_hours:
                sources.append("operating_hours")

        return sources

    def _needs_hours_source(
        self,
        message: str,
        grounding: GymChatGroundingPayload,
    ) -> bool:
        if not grounding.operating_hours:
            return False

        hour_keywords = ("hour", "open", "close", "schedule", "today", "weekday", "weekend")
        return any(keyword in message for keyword in hour_keywords)

    def _build_reply(
        self,
        message: str,
        sources: list[str],
        payload: GymChatRequest,
    ) -> str:
        details: list[str] = []
        grounding = payload.grounding

        if "operating_hours" in sources and grounding.operating_hours:
            first_hours = grounding.operating_hours[0]
            details.append(
                "Current hours include day "
                f"{first_hours.day_of_week}: {first_hours.opens_at}-{first_hours.closes_at}."
            )

        if "special_schedules" in sources and grounding.special_schedules:
            special_schedule = grounding.special_schedules[0]
            details.append(
                "Special schedule noted for "
                f"{special_schedule.starts_on.isoformat()} to {special_schedule.ends_on.isoformat()}: "
                f"{special_schedule.reason}."
            )

        if "promotions" in sources and grounding.promotions:
            promotion = grounding.promotions[0]
            promo_label = (
                f"{promotion.title} ({promotion.promo_code})"
                if promotion.promo_code
                else promotion.title
            )
            details.append(f"Current promotion: {promo_label}.")

        if "membership_plans" in sources and grounding.membership_plans:
            plan = grounding.membership_plans[0]
            details.append(
                "Membership option: "
                f"{plan.name} at {plan.price} for {plan.duration_days} days."
            )

        if "faqs" in sources and grounding.faqs:
            faq = grounding.faqs[0]
            details.append(f"FAQ reference: {faq.question} -> {faq.answer}")

        user_prefix = self._build_user_prefix(payload)
        base_reply = " ".join(details).strip()

        if not base_reply:
            base_reply = (
                "I can help with gym support details like schedules, promotions, "
                "memberships, and FAQs using the provided grounding data."
            )

        if "session history" in message and payload.grounding.session_history:
            base_reply += (
                " I also reviewed the provided session history to keep the answer grounded."
            )

        return f"{user_prefix}{base_reply}".strip()

    def _build_user_prefix(self, payload: GymChatRequest) -> str:
        user_context = payload.grounding.user_context
        if user_context is None or user_context.first_name is None:
            return ""

        return f"{user_context.first_name}, "

    def _build_follow_up_suggestions(self, sources: list[str]) -> list[str]:
        suggestions: list[str] = []

        if "operating_hours" in sources or "special_schedules" in sources:
            suggestions.append("Ask if there are special holiday schedules this week.")

        if "membership_plans" in sources:
            suggestions.append("Ask which membership plan fits your visit frequency.")

        if "promotions" in sources:
            suggestions.append("Ask whether the current promotion applies to new members.")

        if "faqs" in sources:
            suggestions.append("Ask about another gym policy or amenity.")

        if not suggestions:
            suggestions.extend(self._OUT_OF_SCOPE_SUGGESTIONS)

        return suggestions[:2]
