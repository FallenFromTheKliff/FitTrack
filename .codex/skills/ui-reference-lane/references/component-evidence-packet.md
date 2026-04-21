# Component Evidence Packet

Use this output shape for every major premium component.

## Required fields

- `component_name`
- `reference_lane_type`
- `current_problem`
- `source_type`
- `source_url_or_node`
- `evidence_method`
- `source_ceiling`
- `aesthetic_role`
- `reference_axes`
- `visual_trait_extraction`
- `must_show_in_screenshot`
- `extracted_anatomy`
- `interaction_notes`
- `motion_notes`
- `fittrack_adaptation_note`
- `disallowed_drift`
- `design_language_seed`
- `signature_element`
- `banned_generic_pattern`

## Evidence method values

- `figma_context`
- `figma_screenshot`
- `devtools_snapshot`
- `devtools_screenshot`

## Approval rule

A premium component is not approved if it only has:

- Exa highlights
- memory of a reference
- a vague screenshot with no anatomy notes
- screenshots with no declared axis contribution
- a `support_only` source being treated like the whole aesthetic answer
- no statement of what visual trait must survive into the concept or scaffold
