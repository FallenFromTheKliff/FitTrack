# Good Outputs

## Example: strict AI contract summary

- Input contract is explicitly listed.
- Output schema is field-by-field and uses enums and nullability.
- Refusal rule is explicit for out-of-scope or under-grounded requests.
- Confidence semantics explain what low confidence should produce.
- Repair loop states how malformed JSON is retried or rejected.

## Example: pose exercise creation contract

- Requires exactly three representative reps from one locked subject before `create_candidate`.
- Uses derived pose features, side-specific joints, spatial requirements, equipment summaries, and visibility/confidence metadata.
- Distinguishes `bilateral` push-up evidence from `unilateral_left` or `unilateral_right` evidence.
- Returns `match_existing`, `needs_more_evidence`, or `reject` instead of creating a new exercise when evidence is weak or already known.
- Leaves persistence, moderation, safety policy, and EXP multiplier approval outside the model.
