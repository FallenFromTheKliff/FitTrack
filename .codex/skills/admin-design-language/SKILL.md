---
name: admin-design-language
description: "Use internally for premium FitTrack admin surfaces when captured references and approved scaffolds must be translated into a durable FitTrack admin design grammar instead of staying one-off inspiration."
---

# FitTrack Admin Design Language

Use this skill after references are captured and before scaffold authoring or implementation drifts into a generic admin shell. This lane owns the reusable visual grammar for premium admin pages.

## First pass

- Read the current route or modal packet first.
- Read the current reference packet second.
- Read `references/admin-ui-canon-template.md`.
- If a scaffold already exists, use it to confirm whether the page family and signature elements are still coherent.

## What this skill owns

- Design-language fit assessment
- Page-family classification
- Visual-DNA direction for the admin family
- Material-language rules
- Typography-posture rules
- Contrast-and-lighting rules
- Shape-and-edge policy
- Primitive-kit rules
- Component-grammar rules
- Signature elements for FitTrack admin
- Copy-density rules
- Allowed visual range
- Disallowed patterns
- Shared component expectations
- Family variant rules
- Canon-ready writeback guidance for Notion

## What this skill does not own

- Runtime browser review
- Motion implementation
- Figma writing
- Code changes

## Workflow

1. Classify the surface into a page family.
2. Declare which nearby surfaces are:
   - `adaptation_candidate`
   - `family_cue_only`
   - `anti_reference`
3. Translate the structural and aesthetic reference lanes into FitTrack admin rules:
   - command surface grammar
   - density and hierarchy
   - visual DNA
   - material language
   - typography posture
   - contrast and lighting
   - shape and edge policy
   - primitive kit
   - component grammar
   - section rhythm
   - inspector, drawer, and modal patterns
   - copy restraint
4. Default the global admin identity to `Performance Tech` unless the approved route packet explicitly justifies a family variant.
5. Name the signature elements that should survive across sibling admin pages.
6. Name the patterns that should be disallowed for this family.
7. State explicitly what sibling pages may contribute:
   - family cues
   - shell rhythm
   - token discipline
   - shared component vocabulary
8. State explicitly what sibling pages must not contribute:
   - page composition
   - primary workflow model
   - route-specific anatomy
   - page-purpose hierarchy
9. Package the result for `ui-notion-gate`, `ui-visual-dna-director`, `figma-concept-explorer`, `figma-scaffold-builder`, and implementation lanes.

## Guardrails

- Do not turn every page into the same layout.
- Do not let external references erase FitTrack identity.
- Do not preserve route-specific annotation, debug, or board language as part of the product grammar.
- Keep the output reusable across future pages in the same family.
- A shared family is not permission to make different page families look structurally identical.
- Do not let a route or scaffold marked `anti_reference` define the family grammar for future pages.
- `Performance Tech` is a baseline identity, not an excuse to force every page into the same dark shell or the same contrast profile.
- Do not let support-only references quietly define the primitive kit for the whole admin family.

## MCP routing

- Use the current Figma nodes and reference packet first.
- Use Exa only when the current references are still too weak to define a family rule.
- Do not write Notion directly here; hand canon updates to `ui-notion-gate`.

## Output defaults

- Return:
  - `Design language fit`
  - `Page family`
  - `Adaptation boundary rules`
  - `Visual DNA`
  - `Material language`
  - `Typography posture`
  - `Contrast and lighting model`
  - `Shape and edge policy`
  - `Primitive kit rules`
  - `Component grammar rules`
  - `Signature elements`
  - `Family variant rules`
  - `Sibling contribution rules`
  - `Copy-density rules`
  - `Allowed visual range`
  - `Disallowed patterns`
  - `Shared component expectations`
  - `Canon writeback packet`
