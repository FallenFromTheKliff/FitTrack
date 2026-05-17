---
name: component-decorator
description: "Use for FitTrack component-level UI quality after macro layout is approved: generic or weak cards, tables, lists, filters, toolbars, pagination, modals, drawers, destructive confirms, empty/loading/error states, component anatomy, visual density, copy restraint, hover/focus/selected states, accessibility names, and microinteractions. Use when integration, frontend UI, Figma scaffold, route rebuild, or reference-lane skills say to run component-decorator. Do not use for page architecture, major relayout, route hierarchy, or unapproved scaffold decisions."
---

# FitTrack Component Decorator

Turn an approved FitTrack macro layout or scaffold into professional component anatomy. This lane works at the component surface: rows, cards, controls, states, copy density, affordances, and restrained microinteractions.

## Scope

Own:

- Cards, stats, panels, list items, table rows, and record summaries
- Tables, lists, grouped lists, filters, toolbars, bulk bars, search, sort, view switches, and pagination
- Empty, loading, error, permission, success, selected, hover, focus, active, disabled, and destructive states
- Modals, drawers, inspectors, confirmation dialogs, sticky footers, and toast-adjacent component feedback
- Component anatomy, evidence objects, icon usage, badges, control morphology, density, product copy, and accessibility names

Do not own:

- Page architecture, section order, route hierarchy, shell replacement, or major relayout
- Backend contracts, query ownership, auth semantics, migrations, or shared data-flow repair
- Final motion-system selection once static component anatomy is strong
- New design-system foundations unless the owning frontend or design-language lane asks for them

If the macro structure is not approved, stop and hand back to `layout-wireframe-gate`, `figma-scaffold-builder`, or `premium-route-rebuild`. If the missing input is component provenance, hand to `ui-reference-lane`. If the component is structurally strong but needs stronger animation language, hand to `ui-animator`.

## Required Inputs

Start from one approved source of truth:

- a `layout-wireframe-gate` approval packet
- a Figma scaffold packet with node map and allowed deviations
- a `premium-route-rebuild` packet
- a route or modal scaffold explicitly approved by the user

Also read `references/component-anatomy-checklist.md` when producing a contact sheet, auditing multiple components, or implementing a component-polish pass.

## Workflow

1. Confirm structural readiness.
   - Name the macro source and approval status.
   - Confirm state coverage: default, selected, empty, loading, error, create/edit, confirm, destructive, and responsive variants when relevant.
   - Confirm overlay and scroll ownership from the macro packet.
   - Stop if the requested work would change page hierarchy or composition.

2. Identify major components.
   - Inventory the visible component classes and weak zones.
   - Group repeated instances into one component family.
   - Mark which components are `primary_job`, `supporting_context`, `secondary_action`, or `state_surface`.

3. Create a component anatomy contact sheet.
   - Use the schema in `references/component-anatomy-checklist.md`.
   - One row per component family or weak zone.
   - Include source provenance: approved scaffold node, current FitTrack component, reference-lane capture, or local sibling primitive.
   - Record what the component must not copy when using external inspiration.

4. Compare against FitTrack and references.
   - Inspect nearby FitTrack primitives, tokens, class patterns, and sibling components before inventing variants.
   - Prefer current FitTrack grammar and approved Figma frames over external examples.
   - Use Exa only for narrow component reference gaps. Prefer official or direct component sources such as shadcn/ui for implementable anatomy and Radix for interaction and accessibility behavior.
   - Use Magic UI only for component or motion inspiration after structure and anatomy are approved. Never let Magic UI drive page hierarchy, route layout, or information architecture.

5. Decide fix versus enhancement.
   - `Fix`: required to repair clarity, density, scanability, state coverage, accessibility, token fit, or control weakness.
   - `Enhancement`: optional polish after fixes are correct, such as stronger hover language, selected-state response, skeleton rhythm, progressive disclosure, or restrained panel transitions.
   - Label enhancements `implement_now`, `optional_if_time`, or `reject_for_this_surface`.

6. Implement only when asked.
   - Patch the smallest owning components or style helpers.
   - Preserve data contracts and existing interaction ownership.
   - Reuse existing primitives before creating new component variants.
   - Keep copy short and product-facing; remove annotation or critique-board language.
   - Add only restrained microinteractions that clarify state. Hand larger motion choices to `ui-animator`.

7. Verify the component pass.
   - Check desktop and mobile density when the component appears in both.
   - Exercise hover, focus, selected, disabled, loading, empty, error, pagination, and modal or drawer paths that were touched.
   - Confirm accessibility names for icon-only actions and destructive controls.

## Component Standards

- Cards: clear title/value/supporting metadata hierarchy, one obvious action region, no nested card stacks, no decorative chrome that lowers scan speed.
- Tables/lists: high-signal columns or row fields first, visible selected and hover states, stable row height, clear empty and loading states, no repetitive badges.
- Filters/toolbars: compact search and filters, visible active-filter chips, clear reset path, one primary command cluster, responsive wrapping without overlap.
- Pagination: obvious current page or load-more state, disabled boundaries, predictable spacing, and feedback when content changes.
- Modals/drawers: one owner, clear title, compact body, decisive footer, safe close behavior, focus management expectations, and no giant stacked forms when a task surface is needed.
- Destructive confirms: explicit object name, irreversible consequence, safe cancel, distinct destructive action, no vague "Are you sure?" alone.
- Interactive states: hover, focus-visible, selected, active, pressed, disabled, skeleton, and error states must be intentionally designed.
- Density and copy: labels beat paragraphs, remove duplicate metadata, keep helper text only when it changes user confidence or action speed.
- Accessibility: icon-only controls need names, fields need labels, dialogs need titles, destructive actions need clear accessible text.

## Output Defaults

Return:

- `Structural readiness verdict`
- `Macro source`
- `Component inventory`
- `Component anatomy contact sheet`
- `Fixes by component`
- `Enhancements by component`
- `Rejected patterns`
- `FitTrack token and primitive alignment`
- `Magic UI or motion boundary verdict`
- `Implementation notes` or `Patch summary`
- `Handoffs`
- `Verification notes`

Be explicit when a component still feels generic, over-dense, under-specified, or structurally blocked. Do not claim component completion when the remaining issue belongs to macro layout, reference provenance, data wiring, or final motion.
