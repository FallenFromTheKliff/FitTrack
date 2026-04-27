# Bad Outputs

- "Use a helpful model and ask it for JSON somehow."
- Mixing deterministic KPI computation into the prompt instead of leaving it in code.
- No refusal behavior, so the model hallucinates when evidence is thin.
- No confidence semantics, so downstream systems cannot tell weak outputs from strong ones.
- Asking an exercise-creation model to "watch 3 reps and invent the exercise" without a locked subject, side-specific signals, bilateral/unilateral rules, or a strict JSON schema.
