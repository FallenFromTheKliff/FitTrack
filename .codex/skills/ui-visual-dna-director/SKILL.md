---
name: ui-visual-dna-director
description: "Use internally for premium FitTrack admin surfaces when structural and aesthetic references must be synthesized into a reusable visual DNA before Figma concepting or scaffold authoring starts."
---

# FitTrack UI Visual DNA Director

Use this skill after the reference lanes are approved and before Figma concepting begins. This lane sets the reusable art direction for premium admin surfaces.

## First pass

- Read the approved route or modal packet first.
- Read the structural and aesthetic reference lanes second.
- Read the current `FitTrack Admin UI Canon` packet when it exists.
- Read `references/visual-dna-template.md`.
- Confirm that the aesthetic lane includes a usable contact sheet and source-ceiling verdict before synthesizing.
- Confirm that the contact sheet is screenshot-backed, not just Exa markdown or text summaries.

## What this skill owns

- Design thesis
- Visual DNA
- Material language
- Typography posture
- Contrast and lighting model
- Shape and edge policy
- Primitive kit
- Component grammar
- Signature moves
- Visual proof obligations
- Disallowed generic traits
- Family variant rules
- FitTrack-specific synthesis of structural and aesthetic references

## What this skill does not own

- Route architecture by itself
- Figma scaffold authoring
- Final motion implementation
- Code implementation
- Backend or contract repair

## Workflow

1. Confirm the page family, operator job, and anti-reference surfaces.
2. Separate what the structural lane contributes from what the aesthetic lane contributes.
3. Default the global premium admin identity to `Performance Tech` unless the approved packet explicitly justifies a family variant.
4. Write one `Design thesis` that captures the intended product feel in operator terms.
5. Define:
   - `Visual DNA`
   - `Material language`
   - `Typography posture`
   - `Contrast and lighting model`
   - `Shape and edge policy`
   - `Primitive kit`
   - `Component grammar`
6. Name the `Signature moves` that should make the surface feel recognizably FitTrack.
7. State `Visual proof obligations`:
   - what a reviewer must be able to see from a screenshot alone
   - what visual traits must visibly survive from the captures into concepting
8. Name the `Disallowed generic traits` that would collapse the design back into template SaaS.
9. Record `Family variant rules` so future pages can stay coherent without becoming identical.
10. Hand the packet to `admin-design-language`, `ui-notion-gate`, and `figma-concept-explorer`.

## Guardrails

- Do not turn this into a pure mood-board lane with no reusable rules.
- Do not copy one source screenshot wholesale.
- Do not confuse visual DNA with a palette swap.
- `Performance Tech` is a baseline identity, not a mandate for permanent dark mode.
- If the visual DNA is still generic after synthesis, fail the packet and request stronger aesthetic references.
- If the aesthetic lane is `weak`, fail this packet instead of decorating a safe shell with nicer words.
- If the aesthetic lane is `blocked` because browser screenshot capture was unavailable, fail this packet and do not synthesize from text-only reference summaries.
- If the primitive kit or component grammar could still describe a generic premium dashboard, the packet is incomplete.
- If the signature moves are not visible from screenshots alone, they are too vague.

## MCP routing

- Use the approved reference packet first.
- Use current Figma nodes second when they already expose material, hierarchy, or visual-language gaps.
- Use Exa only when the aesthetic lane is still too weak to define a distinct direction.
- Use Chrome DevTools only when the source needs visual confirmation that the packet does not already contain.

## Output defaults

- Return:
  - `Design thesis`
  - `Visual DNA`
  - `Material language`
  - `Typography posture`
  - `Contrast and lighting model`
  - `Shape and edge policy`
  - `Primitive kit`
  - `Component grammar`
  - `Signature moves`
  - `Visual proof obligations`
  - `Disallowed generic traits`
  - `Family variant rules`
  - `Aesthetic source ceiling verdict`
  - `Aesthetic synthesis notes`
