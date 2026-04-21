---
name: ui-animator
description: "Use internally for premium FitTrack UI work after scaffold fidelity and static polish are strong, when the surface needs bold-but-appropriate component motion, animation consistency, reduced-motion fallbacks, real provenance, and Notion motion-bible writeback."
---

# FitTrack UI Animator

Use this skill after the page or modal is structurally strong. This is the premium motion lane, not a layout or architecture lane.

## First pass

- Read the current scaffold packet first.
- Read `references/animation-pattern-catalog.md`.
- Check whether `FitTrack UI Motion Bible` already exists in Notion.
- Read the current route or modal review page before changing the motion direction.

## What this skill owns

- Component-level motion selection
- Motion strength and consistency across the surface
- Hover, selection, reveal, pagination, modal, toast, validation, and ambient motion choices
- Reduced-motion fallbacks
- Motion-bible writeback in Notion
- Motion decision packet append behavior

## What this skill does not own

- Information architecture
- Backend or contract repair
- Scaffold design
- Structural composition changes unless motion exposes a structural problem

## Trigger rules

- The premium surface already has an approved scaffold or is clearly structurally stable.
- The user asks for stronger, bolder, or more alive interactions.
- The current motion is too soft, generic, inconsistent, or absent.
- A component needs a named motion pattern from references.

## Workflow

1. Confirm the surface is structurally ready.
2. Map motion needs by component.
3. Use the catalog first before searching for new motion references.
4. If the catalog is insufficient, use this reference order:
   1. current Figma scaffold and node context
   2. Magic UI direct MCP
   3. Aceternity UI via Exa plus Chrome DevTools
   4. Hover.dev via Exa plus Chrome DevTools
   5. Cult UI via Exa plus Chrome DevTools
   6. Awwwards only after the component type is already chosen
5. Approve one motion voice for the whole surface.
6. Write the motion decision packet.
7. Update the current review page and `FitTrack UI Motion Bible`.

## Hard rules

- No animation recommendation is premium-approved unless the source was actually captured through Figma or Chrome DevTools.
- Exa-only summaries are not enough.
- Reject novelty-heavy motion unless it clearly improves hierarchy, clarity, or delight without hurting professionalism.
- Motion must stay consistent across hover, panels, pagination, and confirmations.
- Ambient or background motion should never outrank the operator job.
- Reduced-motion fallbacks are mandatory for non-trivial motion.

## Output defaults

- Return:
  - `Motion intent by component`
  - `Approved motion pattern by component`
  - `Pattern provenance`
  - `Timing and easing`
  - `Trigger and state ownership`
  - `Reduced-motion fallback`
  - `Ambient motion plan`
  - `Rejected motion options`
  - `Consistency notes`
  - `Implementation notes`

