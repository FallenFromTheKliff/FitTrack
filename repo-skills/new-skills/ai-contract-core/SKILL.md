---
name: ai-contract-core
description: "Use for FitTrack AI prompt engineering and strict contract design when an AI workflow needs schema-first outputs, strong grounding boundaries, refusal behavior, confidence semantics, and high reliability even on weaker models. Use as the shared core companion for pose, chatbot, and business analytics AI tasks."
---

# FitTrack AI Contract Core

Use this skill to design or repair the contract layer around FitTrack AI features before domain-specific tuning happens.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/contract-patterns.md`
  - `references/pose-exercise-creation-contract.md` when the workflow creates or proposes exercise profiles from rep evidence
  - `references/pose-exercise-creation-prompt.md` when the workflow needs a production-ready system/user prompt pair
  - `examples/repair-cases.md` when malformed-output recovery must be robust on weaker models
  - `context/python/00-python-microservice-contracts.md`
  - the domain contract file for the active feature
- Confirm the real owner boundary before editing prompts:
  - Nest-owned data assembly
  - Python-owned generation or reasoning
  - provider-owned model execution

## Scope boundaries

- Own prompt engineering, strict output contracts, refusal rules, confidence semantics, schema-first generation, and malformed-output recovery strategy.
- Do not own domain-specific business rules that belong in the wrapper skills.
- Do not move business logic from Nest into prompts just because it is easier.

## MCP routing

- Serena is required for code and contract discovery.
- Prisma Local is optional and only needed when persisted AI records or DB-backed contract truth matters.
- Swagger and Playwright are verification MCPs only, not prompt-design MCPs.

## Workflow

1. Define the minimal input contract.
2. Define the exact output schema.
3. Define refusal, uncertainty, and confidence behavior.
4. Preserve system-owned grounding and validation boundaries.
5. Add a repair strategy for malformed or partial outputs.
6. Hand the result to the domain wrapper skill for domain-specific tuning.

## Low-model reliability rules

- Prefer explicit field-by-field schemas over free-form prose requests.
- Require nullability rules, enum domains, and allowed omission behavior.
- Tell the model what to do when evidence is missing, contradictory, or out of scope.
- Separate deterministic preprocessing from probabilistic generation whenever possible.
- Treat retries and schema repair as contract features, not afterthoughts.

## Pose exercise creation contracts

When an AI workflow proposes a new exercise or movement profile from observed reps:

- Require exactly three representative completed reps from one locked subject before allowing `create_candidate`.
- Use derived pose/equipment summaries as input; do not place raw frames in the prompt unless the path is explicitly offline review.
- Require a strict JSON object aligned with the pose movement contract, including bilateral/unilateral semantics, side-specific joints, spatial requirements, confidence, and admin-review flags.
- Treat the model output as a proposal only. Nest/backend validation owns persistence, moderation, EXP mapping, safety gates, and existing-exercise matching.
- Return `needs_more_evidence`, `match_existing`, or `reject` instead of inventing a new exercise when evidence is weak, already known, unsafe, contradictory, or not exercise-like.
- Keep a golden retry path for malformed JSON: echo the validation path, restate the exact schema, and forbid prose or markdown fences in the repair attempt.

## Output defaults

- Return the input contract, output contract, refusal rules, confidence semantics, and repair loop.
- State which logic must remain outside the model.
