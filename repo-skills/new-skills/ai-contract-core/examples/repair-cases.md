# Repair Cases

Use these as golden malformed-output retries for exercise-creation workflows.

## Case 1: Markdown fenced JSON

- Failure: the model wraps valid JSON in ```json fences.
- Retry rule: tell it the response must be one raw JSON object only, with no fences or prose.

## Case 2: Missing `movement_contract.rep_model`

- Failure: the model returns a contract but omits `rep_model`.
- Retry rule: send the exact failing path and restate the enum domain `bilateral | unilateral_left | unilateral_right | alternating | static_hold | unknown`.

## Case 3: Weighted curl without equipment grounding

- Failure: the model proposes `bicep_curl` with `equipment.required=true` but `equipment.context="unknown"` and empty labels.
- Retry rule: instruct it to downgrade to `needs_more_evidence` or change the proposal so the equipment block is grounded.

## Case 4: One-arm push-up mislabeled as bilateral

- Failure: the model proposes `push_up` with `rep_model="bilateral"` while the evidence shows unilateral arm motion and asymmetry.
- Retry rule: force a unilateral rep model or return `needs_more_evidence`; never preserve the bilateral label.

## Case 5: Invalid confidence values

- Failure: any confidence field falls outside 0..1 or is returned as a string.
- Retry rule: restate that all confidence fields must be numeric and bounded to the inclusive 0..1 range.
