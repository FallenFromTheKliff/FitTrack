# Motion Decision Packet Template

Use this output shape for every premium surface that goes through `ui-animator`.

## Required fields

- `surface_name`
- `motion_voice`
- `motion_intent_by_component`
- `approved_motion_pattern_by_component`
- `pattern_provenance`
- `timing_and_easing`
- `trigger_and_state_ownership`
- `reduced_motion_fallback`
- `ambient_motion_plan`
- `rejected_motion_options`
- `consistency_notes`
- `implementation_notes`

## Approval rules

- Every approved motion pattern must be traceable to:
  - a Figma node or screenshot
  - or a Chrome DevTools capture of a named source
- If a pattern is not traceable, mark it `rejected`.

