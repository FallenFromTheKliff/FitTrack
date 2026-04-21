# FitTrack Chat Contract

## Preserve these boundaries

- Nest owns session history, grounding payload assembly, FAQ and schedule retrieval, and policy flags.
- Python owns answer generation and schema shaping.
- The model should phrase and connect supplied facts, not invent business data.

## Required reply fields

- `reply`
- `out_of_scope`
- `sources`
- `follow_up_suggestions`
- `model_used`
- `token_count`

## Behavioral rules

- Refuse clearly when the request is not gym-related.
- Keep follow-up suggestions helpful but grounded.
- If the grounding data is insufficient, admit the limitation instead of improvising.
