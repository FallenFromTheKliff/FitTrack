# FitTrack AI Contract Patterns

## Required prompt sections

1. Role and bounded responsibility
2. Allowed inputs and their schema
3. Required output schema
4. Refusal and uncertainty rules
5. Confidence semantics
6. Formatting and validation rules
7. Recovery behavior when the first output is malformed

## Core guardrails

- Keep source-of-truth business logic outside the model when deterministic code can own it.
- Prefer structured JSON with explicit enums, arrays, and nullability.
- Define what the model must do when confidence is low instead of letting it improvise.
- If a field must be grounded in supplied evidence, say so explicitly.

## Common anti-patterns

- Asking for "helpful" answers without a schema
- Mixing business logic and phrasing logic in one vague prompt
- Using the model to compute values already available from deterministic services
- Treating malformed JSON as a runtime surprise instead of a contract-design problem
