---
name: ui-runtime-review
description: "Use internally for premium FitTrack UI work after implementation when Chrome DevTools should click through hover, selection, pagination, modal, validation, toast, and safe confirm flows to judge whether the live feel actually matches the approved scaffold and motion language."
---

# FitTrack UI Runtime Review

Use this skill after implementation and static polish. This is the live browser feel check before final QA.

## First pass

- Read the current scaffold packet and motion decision packet first.
- Read `references/runtime-review-checklist.md`.
- Use Chrome DevTools on the real page state, not screenshots alone.

## What this skill owns

- Live browser click-through
- UX-gap discovery after implementation
- Modal, drawer, and overlay sanity checks
- Hover, selection, and pagination feel checks
- Validation, toast, and confirm-flow checks
- Professional-feel gap detection after implementation

## What this skill does not own

- Final QA sign-off
- Figma authoring
- Contract repair
- Large redesign decisions

## Workflow

1. Open the touched surface.
2. Trigger the primary row, card, or selection state.
3. Change pagination or a primary content-mode switch.
4. Open and close the main modal, drawer, or inspector.
5. Trigger one safe confirmation path when available.
6. Check validation, error, and toast behavior when the surface owns them.
7. Record whether the live feel matches the scaffold, motion packet, and approved premium ambition.

## Guardrails

- Do not approve nested primary overlays.
- Do not ignore duplicate fields just because the page technically works.
- Do not call the motion good when it is technically present but still feels dead.
- Do not call the surface done when it is structurally correct but still visually conservative or prototype-like.
- If the runtime feel is wrong, hand findings back before QA closes the run.

## MCP routing

- Chrome DevTools only by default
- Use Playwright only if the orchestrator explicitly escalates later

## Output defaults

- Return:
  - `Runtime review verdict`
  - `Overlay ownership verdict`
  - `Scroll ownership verdict`
  - `Motion feel verdict`
  - `Validation and toast verdict`
  - `Professional feel verdict`
  - `Conservative feel findings`
  - `Findings to fix before QA`
