---
name: premium-modal-rebuild
description: "Use internally for high-visibility FitTrack modals, drawers, and inspectors that need the same scaffold-first premium treatment as full pages: state audit, evidence-backed references, approval gating, implement-ready scaffolds, and strict overlay ownership."
---

# FitTrack Premium Modal Rebuild

Use this skill when a modal, drawer, or inspector is a first-class surface, not a tiny supporting popup.

## First pass

- Start from the live overlay, not from memory.
- Read `references/modal-surface-template.md`.
- Inspect the nearest route so the modal is judged in context.

## What this skill owns

- Modal-surface audit
- State inventory for the overlay
- Overlay ownership decisions
- Scroll ownership decisions
- Reference-backed redesign direction
- Visual-DNA direction for the modal family
- Concept divergence gating before scaffold
- Hand-off packet for design language, Notion, workspace governance, Figma, art direction, motion, and runtime review

## What this skill does not own

- Browser evidence capture by itself
- Notion page authoring by itself
- Figma scaffold authoring by itself
- Final motion-system selection

## Workflow

1. Restate the modal's real job.
2. Inventory states:
   - closed trigger state
   - open default state
   - edit state
   - confirm state
   - error or success state when relevant
3. Decide whether the surface should stay a modal, become a drawer, become an inspector, or become a first-class task surface.
4. Hand reference capture to `ui-reference-lane`.
5. Hand visual-DNA synthesis to `ui-visual-dna-director`.
6. Hand design-language translation to `admin-design-language`.
7. Hand review-page authoring to `ui-notion-gate`.
8. Hand workspace governance to `figma-workspace-governor`.
9. Hand concept divergence to `figma-concept-explorer`.
10. Hand scaffold authoring to `figma-scaffold-builder`.
11. Hand the scaffold to `ui-art-direction-review` before code starts.
12. After implementation, hand motion to `ui-animator` and live click-through to `ui-runtime-review`.

## Guardrails

- One primary overlay owner at a time.
- No nested modal-on-modal stacks except an explicitly approved confirm overlay.
- No accidental inner scroll traps unless the design explicitly approves them.
- Large edit flows should not stay giant dialogs by inertia.
- Do not start code until the scaffold passes `ui-art-direction-review`.
- Do not skip the concept phase for high-visibility modal surfaces that still feel generic.

## Output defaults

- Return:
  - `Modal verdict`
  - `Surface type`
  - `State map`
  - `Keep / Replace / Remove / Add matrix`
  - `Professional blockers`
  - `Fixes by component`
  - `Enhancements by component`
  - `Design thesis`
  - `Visual DNA`
  - `Design language fit`
  - `Signature elements`
  - `Interaction scaffold`
  - `Overlay ownership matrix`
  - `Scroll ownership plan`
  - `Reference lane`
  - `Concept divergence matrix`
  - `Selected concept rationale`
  - `Scaffold node map`
  - `Workspace target file`
  - `Target page`
  - `Art direction verdict`
  - `Scaffold-ready verdict`
  - `Implementation slices`
