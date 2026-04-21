---
name: business-analytics-ai
description: "Use for FitTrack AI-assisted business analytics when the task touches narrative insight generation, anomaly flags, risks, opportunities, recommended actions, or strict output schemas for admin analytics. Use with `ai-contract-core` when the insight workflow needs stronger prompt contracts or lower-model robustness."
---

# FitTrack Business Analytics AI

Use this skill for the insight-generation layer on top of FitTrack's deterministic analytics payloads.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `context/python/s17-business-analytics.md`
  - `context/python/00-python-microservice-contracts.md`
  - `references/insight-contract.md`
  - the touched Nest analytics and Python insight files
- Confirm the ownership split:
  - Nest computes KPI payloads
  - Python narrates insights

## Scope boundaries

- Own narrative summary behavior, anomaly explanation, risk and opportunity framing, and recommended action contract design.
- Do not move raw KPI computation, SQL aggregation, or BI-style metric retrieval into prompts.
- Keep the insight layer grounded in supplied analytics payloads.

## MCP routing

- Serena is required.
- Prisma Local is required when persisted insight runs, analytics history, or DB-backed filters affect truth.
- Swagger is allowed only after direct API or contract verification.
- Playwright is allowed only when the admin analytics UI changed and browser verification is genuinely required.

## Workflow

1. Confirm the KPI ownership boundary.
2. Define or repair the strict insight output schema.
3. Tune summary, highlight, risk, opportunity, anomaly, and action behavior.
4. Verify neutral periods, mixed-signal periods, and obviously anomalous periods.
5. Keep confidence and uncertainty visible when the grounding payload is thin.

## Insight rules

- Insights must explain the supplied numbers, not invent missing ones.
- Risks and opportunities should be specific to the payload and the selected focus window.
- Recommended actions should remain actionable and bounded.
- Weak evidence should produce cautious language instead of overclaiming.

## Output defaults

- Return the grounding boundary, strict schema, anomaly policy, recommended-action rules, and verification set.
- State clearly that KPI computation remains outside the model.
