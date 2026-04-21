---
name: figma-scaffold-builder
description: "Use internally for premium FitTrack UI work when an approved direction must be turned into an implement-ready Figma scaffold with named frames, state coverage, node ids, overlay ownership, scroll ownership, and allowed implementation deviations."
---

# FitTrack Figma Scaffold Builder

Use this skill after the direction is approved. This skill is for scaffold authoring, not for deciding the design.

## First pass

- Read the approved review packet first.
- Read the `figma-workspace-governor` packet before placing frames.
- Read `references/scaffold-packet-template.md`.
- If using `use_figma`, load the `figma:figma-use` skill first.
- Check existing file libraries before creating new component structures.

## What this skill owns

- Implement-ready macro scaffold authoring
- Frame naming and state coverage
- Node-map packaging
- Overlay placement and scroll ownership encoding
- Allowed-deviation packaging for implementation
- Chosen-concept preservation from the concept phase

## What this skill does not own

- Freeform redesign after approval
- Component reference discovery
- Final component iconography, evidence objects, or micro-decoration authorship
- Motion-system design after implementation
- Runtime browser review
- Pre-scaffold concept divergence itself

## Workflow

1. Confirm the approved direction, chosen concept, workspace target file, and target page.
2. Preserve the chosen concept's silhouette, material language, and hierarchy before reusing existing design-system components.
3. Reuse existing design-system components when possible.
4. Create or update named frames for:
   - default landing
   - selected or inspected
   - create or edit
   - confirm or destructive
   - empty, loading, and error states when they matter
5. Keep packet boards, critique notes, and guardrail material on a separate board area or page from the final viewport frames.
6. Encode:
   - section order
   - container proportions
   - shell silhouette
   - material language
   - hierarchy emphasis
   - row or card anatomy
   - overlay ownership
   - scroll ownership
   - what shows, hides, replaces, or slides
7. If the macro scaffold is stable but the components are still flat, hand the frame to `component-decorator` before art-direction review.
8. Package the scaffold for 1:1 implementation.

## Guardrails

- Do not turn the scaffold into a vibe board.
- Do not scaffold directly from the route packet alone when the chosen concept is missing.
- Do not create or keep route-specific premium scaffold files when the workspace-governor packet already chose the master file.
- Do not overlap frames as random coordinates.
- Do not place packet notes or annotation text inside final product frames.
- Do not flatten three divergent concepts into one safe compromise before the scaffold phase.
- Do not treat scaffold completion as component completion.
- Do not invent icon systems, badge gadgets, or pseudo-evidence objects here when the component-authorship lane should own them.
- If the macro layout is right but the page still reads as organized containers, stop and hand off to `component-decorator`.
- Keep one primary overlay owner at a time unless the approved design explicitly allows a confirm overlay.
- Desktop sidebars and inspectors should not scroll independently unless the design explicitly approves it.
- If a needed state is missing, stop and ask for a design update before code continues.

## MCP routing

- `get_libraries`
- `search_design_system`
- `get_design_context`
- `use_figma`
- `get_screenshot`

## Output defaults

- Return:
  - `Wireframe frame list`
  - `Chosen concept`
  - `Preserved concept traits`
  - `Workspace target file`
  - `Target page`
  - `Figma scaffold source`
  - `Scaffold node map`
  - `Micro-decoration handoff`
  - `Overlay ownership matrix`
  - `Scroll ownership plan`
  - `Allowed implementation deviations`
  - `Frames still missing`
