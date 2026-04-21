---
name: brainstorm
description: "Use for FitTrack product and feature ideation when the request is still vague, module-shaped, or under-scoped. Use it to expose holes, constraints, MVP cuts, and practical system-fit options without exploding scope. Hand premium UI consultation to `professional-ui-brainstorm`."
---

# FitTrack Brainstorm

Use this skill when the ask is still fuzzy, product-shaped, or likely to bloat. This is not the premium UI consultation lane.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/output-shape.md`
  - the nearest touched route, screen, or domain summary when the request names a real surface
  - the `integration` skill when the idea is likely to move directly into implementation
- If the real blocker is page quality, design ambition, or reference-backed UX direction, hand that consultation to `professional-ui-brainstorm`.

## What this skill owns

- Product framing
- Hidden holes and missing assumptions
- Constraints and tradeoffs
- MVP cuts and implementation-safe scoping
- Practical option generation
- FitTrack system-fit direction before implementation

## What this skill does not own

- Premium UI consultation or art direction
- Figma authoring
- Notion review-page authoring
- Backend repair by itself
- Big speculative roadmaps

## Workflow

1. Restate the real product goal.
2. Identify the operator, member, coach, or business user job underneath the request.
3. State the hidden holes in the ask.
4. Name the most important constraints and couplings.
5. Generate two or three practical options.
6. Recommend the strongest MVP path.
7. Separate immediate scope from later ideas.
8. Call out the risks that would make the feature bloated, generic, or disconnected from FitTrack.

## Guardrails

- Prefer two or three strong options over a giant idea dump.
- Keep the MVP recommendation practical enough to hand to `system-adapt` or `integration`.
- Do not turn every feature into a suite.
- Do not confuse "more features" with "better product direction."
- If the real issue is premium UI quality, component replacement, or page-level visual ambition, hand to `professional-ui-brainstorm`.

## MCP routing

- Serena is required for local discovery.
- Exa is allowed when outside product or workflow references would materially improve the answer.
- Figma is optional and only useful when the request is explicitly about a current surface and its design intent.

## Output defaults

- Return:
  - `Goal`
  - `Hidden holes`
  - `Constraints`
  - `Options`
  - `Recommended MVP`
  - `Later ideas`
  - `System-fit guardrails`
  - `Risks to avoid`
