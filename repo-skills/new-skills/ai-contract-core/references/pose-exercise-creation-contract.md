# Pose Exercise Creation Contract

Use this reference when FitTrack asks an AI model to propose an exercise profile from observed reps.

## Owner boundaries

- Nest owns auth, session lifecycle, persistence, moderation state, existing-exercise lookup, EXP policy, and final validation.
- Python or the AI provider may propose classification, movement profile, confidence, and review reasons.
- The live rep loop must stay vision/local-first. Do not introduce LLM calls into per-frame counting.
- The model never creates final truth. It returns a candidate JSON body that must pass deterministic validation.

## Minimum input contract

The prompt may only request `create_candidate` when all of these are true:

- Exactly three representative completed rep windows are supplied.
- All three reps belong to the same locked subject.
- Subject-lock confidence is acceptable for the product threshold.
- The input contains derived pose features, not raw stored frames:
  - side-specific joint angles such as `left_elbow`, `right_elbow`, `left_shoulder`, `right_shoulder`
  - body center x/y travel
  - body-line and alignment features
  - phase timing and rep windows
  - visibility and confidence by landmark or side
  - equipment summary from catalog/provider/manual context
  - existing candidate exercise hints

If any requirement is missing, the model must return `needs_more_evidence` or `reject`.

## Required JSON output

The model must return one JSON object and no prose:

```json
{
  "schema_version": "exercise_creation_v1",
  "decision": "create_candidate | match_existing | needs_more_evidence | reject",
  "canonical_name": "string_or_null",
  "display_name": "string_or_null",
  "matched_existing_exercise_id": "string_or_null",
  "movement_contract": {
    "exercise": "string",
    "rep_model": "bilateral | unilateral_left | unilateral_right | alternating | static_hold | unknown",
    "primary_joints": ["left_elbow", "right_elbow"],
    "secondary_joints": ["left_shoulder", "right_shoulder", "hip", "knee"],
    "required_sides": "both | left | right | either | alternating",
    "phase_order": ["setup", "down", "up"],
    "rep_thresholds": {
      "down": { "angle": 0, "tolerance": 0 },
      "up": { "angle": 0, "tolerance": 0 }
    },
    "spatial_requirements": {
      "body_y_travel_min": 0,
      "body_x_drift_max": 0,
      "body_line_tolerance": 0,
      "left_right_symmetry_tolerance": 0,
      "phase_sync_tolerance_ms": 0
    },
    "no_count_conditions": ["string"],
    "degraded_conditions": ["string"]
  },
  "difficulty": {
    "tier": "beginner | intermediate | advanced | elite | unknown",
    "unilateral_multiplier": 1,
    "suggested_exp_multiplier": 1,
    "rationale": "string"
  },
  "equipment": {
    "context": "bodyweight | dumbbell | barbell | machine | cable | kettlebell | band | bench | mixed | unknown",
    "required": false,
    "labels": ["string"],
    "confidence": 0
  },
  "confidence": {
    "classification": 0,
    "movement_contract": 0,
    "safety": 0
  },
  "review": {
    "requires_admin_review": true,
    "reason_codes": ["string"],
    "notes": "string"
  }
}
```

## Decision rules

- `create_candidate`: only when three clean reps support a distinct movement not matched to known exercises.
- `match_existing`: when the motion aligns with a known exercise or variant.
- `needs_more_evidence`: when there are fewer than three clean reps, weak subject lock, occlusion, insufficient visibility, or ambiguous equipment.
- `reject`: when the motion is unsafe, contradictory, non-exercise-like, or impossible to validate.

## Bilateral versus unilateral rules

- Normal push-up, dip, bench press, and shoulder press should usually require bilateral evidence.
- If only one arm is visible or active, do not label it as a clean normal bilateral exercise.
- If one-sided mechanics are intentional and body movement supports the rep, classify as a unilateral candidate and require admin review.
- Unilateral variants may propose higher difficulty/EXP multipliers, but backend policy owns final multiplier approval.

## Repair loop

If output is malformed, retry once with:

1. The validation error path.
2. The required schema.
3. The instruction to return only corrected JSON.

If the repaired output still fails, reject the candidate and surface a deterministic review reason.
