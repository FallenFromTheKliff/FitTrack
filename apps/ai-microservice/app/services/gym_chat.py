from __future__ import annotations

from ..models.gym_chat import (
    GymChatGroundingPayload,
    GymChatRequest,
    GymChatResponse,
    GymFaqItem,
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
        "sertfit",
        "sertfits",
        "book",
        "booking",
        "reservation",
        "appointment",
        "payment",
        "billing",
        "invoice",
        "receipt",
        "downpayment",
        "balance",
        "renew",
        "cancel",
        "freeze",
        "pause",
        "upgrade",
        "downgrade",
        "feedback",
        "rating",
        "camera",
        "rep",
        "exercise",
    )

    _SENSITIVE_BUSINESS_KEYWORDS = (
        "total sales",
        "sales this",
        "revenue",
        "profit",
        "earnings",
        "payroll",
        "salary",
        "attendance this",
        "check-ins",
        "checkins",
        "member emails",
        "member phone",
        "phone numbers",
        "database",
        "all users",
        "staff list",
        "overdue payments",
        "who paid",
        "who owes",
        "private data",
    )

    _OUT_OF_SCOPE_SUGGESTIONS = [
        "Ask about gym hours or holiday schedules.",
        "Ask about membership plans or current promotions.",
    ]

    def reply_to_message(self, payload: GymChatRequest) -> GymChatResponse:
        message = payload.message.strip().lower()

        if self._is_sensitive_member_request(message, payload):
            return GymChatResponse(
                reply=(
                    "I can help with your own gym support questions, but I can't "
                    "share private business analytics, member records, staff data, "
                    "or payment lists in member chat. Admin users can review those "
                    "inside the admin analytics tools."
                ),
                out_of_scope=True,
                sources=[],
                follow_up_suggestions=[
                    "Ask about gym hours, bookings, memberships, or coaching.",
                    "Ask about your own payment or booking next steps.",
                ],
                model_used=None,
                token_count=None,
            )

        if self._is_out_of_scope(message):
            return GymChatResponse(
                reply=(
                    "I can only help with gym support topics like hours, "
                    "bookings, payments, memberships, coaching, training, "
                    "promotions, schedules, and FAQs."
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

    def _is_sensitive_member_request(
        self,
        message: str,
        payload: GymChatRequest,
    ) -> bool:
        role = payload.grounding.user_context.role if payload.grounding.user_context else None
        if role in ("admin", "staff"):
            return False

        return any(keyword in message for keyword in self._SENSITIVE_BUSINESS_KEYWORDS)

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

        if any(
            keyword in message
            for keyword in (
                "faq",
                "rule",
                "coach",
                "class",
                "nutrition",
                "book",
                "booking",
                "reservation",
                "appointment",
                "payment",
                "billing",
                "downpayment",
                "balance",
                "camera",
                "rep",
                "exercise",
                "feedback",
                "rating",
            )
        ):
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
            details.append(self._format_operating_hours(grounding))

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
            faq = self._select_best_faq(message, grounding.faqs)
            details.append(f"FAQ reference: {faq.question} -> {faq.answer}")

        user_prefix = self._build_user_prefix(payload)
        base_reply = " ".join(details).strip()

        if not base_reply:
            base_reply = (
                "I can help with gym support details like schedules, bookings, "
                "payments, memberships, coaching, training, and FAQs using the "
                "provided grounding data."
            )

        if "session history" in message and payload.grounding.session_history:
            base_reply += (
                " I also reviewed the provided session history to keep the answer grounded."
            )

        return f"{user_prefix}{base_reply}".strip()

    def _format_operating_hours(self, grounding: GymChatGroundingPayload) -> str:
        day_names = {
            0: "Sunday",
            1: "Monday",
            2: "Tuesday",
            3: "Wednesday",
            4: "Thursday",
            5: "Friday",
            6: "Saturday",
        }
        hours = sorted(grounding.operating_hours, key=lambda item: item.day_of_week)
        parts = []
        for item in hours:
            day = day_names.get(item.day_of_week, f"Day {item.day_of_week}")
            if item.is_closed:
                parts.append(f"{day}: closed")
            else:
                parts.append(f"{day}: {item.opens_at}-{item.closes_at}")

        return "Current gym hours: " + "; ".join(parts) + "."

    def _select_best_faq(
        self,
        message: str,
        faqs: list[GymFaqItem],
    ) -> GymFaqItem:
        message_tokens = {
            token.strip(".,?!:;()[]{}")
            for token in message.split()
            if len(token.strip(".,?!:;()[]{}")) >= 3
        }

        def score(faq: GymFaqItem) -> int:
            haystack = f"{faq.category} {faq.question} {faq.answer}".lower()
            keywords = faq.keywords or []
            keyword_score = sum(
                4 for keyword in keywords if str(keyword).lower() in message
            )
            token_score = sum(1 for token in message_tokens if token in haystack)
            return keyword_score + token_score

        return max(faqs, key=score)

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
