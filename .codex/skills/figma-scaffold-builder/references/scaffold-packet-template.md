# Scaffold Packet Template

Every scaffold handoff should include:

- `workspace_target_file`
- `target_page`
- `chosen_concept`
- `frame_name`
- `purpose`
- `node_id`
- `state_type`
- `shell_silhouette`
- `material_language`
- `hierarchy_emphasis`
- `primary_command_surface`
- `row_or_card_anatomy`
- `overlay_owner`
- `scroll_owner`
- `what_changes_on_interaction`
- `concept_traits_preserved`
- `allowed_implementation_deviations`
- `board_or_product_surface`

## Separation rule

- final viewport UI belongs to `product_surface`
- packets, notes, guardrails, and critique material belong to `board_surface`
- do not mix them in the same viewport frame

## Required state types

- `landing`
- `selected_or_inspected`
- `create_or_edit`
- `confirm_or_destructive`
- `empty`
- `loading`
- `error`

Only omit a state when it truly does not exist for the surface.
