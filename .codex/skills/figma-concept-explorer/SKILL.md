---
name: figma-concept-explorer
description: "Use internally for premium FitTrack admin surfaces when the approved direction must be explored as three clearly divergent Figma concepts before one concept is selected and turned into the final scaffold."
---

# FitTrack Figma Concept Explorer

Use this skill after approval and before scaffold authoring. This lane prevents safe reskins by forcing real divergence in Figma.

## First pass

- Read the approved review packet first.
- Read the `ui-visual-dna-director` packet second.
- Read the `admin-design-language` packet third.
- Read `references/concept-divergence-template.md`.
- If using `use_figma`, load the `figma:figma-use` skill first.
- Confirm the aesthetic lane is screenshot-backed before drawing concepts.

## What this skill owns

- Pre-scaffold Figma concept exploration
- Three divergent concepts for the same workflow model
- Concept divergence matrix
- Selected concept
- Rejected concept reasons
- Concept-to-reference mapping

## What this skill does not own

- Freeform route architecture changes after approval
- Final scaffold authoring
- Runtime review
- Code implementation

## Workflow

1. Confirm the operator model, approved packet, visual DNA, and anti-reference surfaces.
2. Build `Concept A`, `Concept B`, and `Concept C` in Figma.
3. Force each concept to differ across at least four axes:
   - shell silhouette
   - command-surface form
   - material language
   - hierarchy emphasis
   - contrast profile
   - density posture
   - primitive kit
   - component grammar
4. Keep concept notes and divergence explanations on a board area, not inside the final product frames.
5. Record a `Concept divergence matrix`.
6. Compare each concept against:
   - the anti-reference screenshot
   - the aesthetic contact sheet
   - the primitive-kit and component-grammar rules
   and reject any concept that still reads like the same layout with renamed panels, the same shell with new colors, or the same primitive kit with shuffled containers.
7. Select one concept and record why the others were rejected.
8. Hand the chosen concept to `figma-scaffold-builder`.

## Guardrails

- Do not produce three mild variants of the same composition.
- Do not let convenience or reuse choose the concept over distinctiveness.
- Do not treat this as a mood-board lane. Concepts must still be product-frame quality.
- Do not start concepting from Exa summaries alone.
- If the aesthetic contact sheet is text-led or missing browser screenshot evidence, fail the phase and reopen the reference lane.
- Do not allow a concept to pass if it is only cleaner than the anti-reference.
- Do not allow all three concepts to share one primitive kit with minor silhouette changes.
- Do not allow the chosen concept to ignore the strongest screenshot-backed aesthetic captures.
- If no concept is genuinely distinct, fail the phase and reopen the visual-DNA lane.

## MCP routing

- Figma first:
  - `get_metadata`
  - `get_screenshot`
  - `use_figma`
- Current reference packet second
- No code or browser tools here unless a source needs confirmation

## Output defaults

- Return:
  - `Concept A`
  - `Concept B`
  - `Concept C`
  - `Concept divergence matrix`
  - `Concept primitive-kit deltas`
  - `Selected concept`
  - `Selected concept rationale`
  - `Rejected concept reasons`
  - `Concept-to-reference mapping`
