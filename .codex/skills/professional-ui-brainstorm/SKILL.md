---
name: professional-ui-brainstorm
description: "Use internally for premium FitTrack admin UI consultation when a page or modal is visually weak, generic, vague, or underpowered and needs a reference-backed direction before rebuild, scaffold, or implementation starts."
---

# FitTrack Professional UI Brainstorm

Use this skill as the premium UI consultation lane before route rebuilds, modal rebuilds, or scaffold work. This lane sets ambition and anti-generic direction. It does not write Figma, Notion, or code.

## First pass

- Start from the current surface, packet, or blocker list rather than from general taste.
- Use Serena before broad repo scans.
- Read `references/consultation-rubric.md`.
- If a route or modal packet already exists, treat it as the structural source of truth and focus this skill on quality, component replacement pressure, and premium ambition.

## What this skill owns

- Premium UI consultation
- Ambition target and target tier pressure
- Component replacement ideas
- Fixes versus enhancements by component
- Operator-first UX options
- Anti-generic warnings
- Reference targets by component
- Purpose-driven reference keyword stacks
- Adaptation-candidate screening for current surfaces and nearby scaffolds
- Design-thesis and visual-identity direction setting
- Emotional-keyword and signature-opportunity framing

## What this skill does not own

- Figma authoring
- Notion page writing
- Code implementation
- Backend or contract repair
- Runtime review

## Workflow

1. Restate the surface job in operator language.
2. Classify the current tier and the target tier.
3. Identify the professional blockers and weakest major components first.
4. Classify the current live surface, the current scaffold, and the nearest sibling premium surface as one of:
   - `adaptation_candidate`
   - `family_cue_only`
   - `anti_reference`
   Surfaces that still read as generic, vibe-coded, annotation-leaking, polished-wireframe-like, or structurally mismatched to the page purpose should default to `anti_reference`.
5. For each major component, separate:
   - `Fixes`
   - `Enhancements`
6. Separate:
   - `Workflow fix`
   - `Visual identity opportunity`
   so the run does not hide a bland art direction behind a stronger information architecture.
7. State which generic or overused patterns are banned for this surface.
8. Build a `Reference keyword stack` from:
   - domain keywords such as `gym`, `fitness`, `front desk`, `operations`, `facility`, `class`, `coach`, `booking`, `schedule`, or other route-specific domain terms
   - admin-management keywords such as `workspace`, `operations console`, `management`, `planner`, `staffing`, `queue`, or `availability`
   - page-purpose keywords that describe the exact job of the surface
   - component keywords for the major UI parts that must be benchmarked
   - quality keywords such as `premium`, `professional`, `high density`, `operations`, `workspace`, `production`, or `polished`
   - negative keywords for patterns the run should avoid
9. State:
   - `Design thesis`
   - `Emotional keywords`
   - `Signature opportunity`
   - `Aesthetic ambition pressure`
   for the surface before Figma concepting begins.
10. Point each major component at the strongest likely benchmark targets.
11. Name which aesthetic sources are allowed to lead versus support:
   - high-ceiling aesthetic leads
   - support-only product references
12. State a `Sibling inheritance rule`:
   - what the nearest sibling surface may contribute to shared family language
   - what it must not dictate structurally
13. Recommend one premium direction that is bold, practical, and implementable.
14. Hand the result to `premium-route-rebuild`, `premium-modal-rebuild`, `ui-visual-dna-director`, or `integration`.

## Guardrails

- Do not confuse premium feel with extra panels, louder decoration, or feature creep.
- Do not return vibe-level inspiration dumps with no component logic.
- Do not reopen settled route architecture unless the surface is still structurally weak.
- Prefer a stronger replacement pattern over polishing an obviously weak component out of habit.
- Keep the guidance decision-complete enough that downstream skills do not have to guess the ambition bar.
- Do not let the nearest sibling page become the primary benchmark just because it already exists.
- Use sibling pages only for shared family cues such as shell language, rhythm, or token discipline after the purpose-driven benchmark lane is already chosen.
- Do not let a surface marked `anti_reference` contribute structure, hierarchy, or workflow anatomy to the next design pass.
- Do not confuse visual identity with a palette swap on top of a safe SaaS shell.
- If the workflow direction improved but the visual identity is still generic, treat the consultation as incomplete.
- Do not let polished utility products become the default aesthetic lead when the user is explicitly asking for stronger authored UI.

## MCP routing

- Serena is required for local discovery.
- Exa is the default external research lane for benchmark hunting.
- Figma is optional and useful when an existing frame or node already reveals why the current surface undershoots.
- Chrome DevTools is optional when the live page state is needed to judge scanability, density, or current polish gaps.
- Awwwards is last and only for ambition pressure after the component family is already chosen.

## Output defaults

- Return:
  - `Review verdict`
  - `Current tier`
  - `Target tier`
  - `Professional blockers`
  - `Fixes by component`
  - `Enhancements by component`
  - `Workflow fixes`
  - `Visual identity opportunities`
  - `Adaptation candidate verdict`
  - `Anti-reference surfaces`
  - `Design thesis`
  - `Emotional keywords`
  - `Signature opportunity`
  - `Aesthetic ambition pressure`
  - `Reference keyword stack`
  - `Reference targets by component`
  - `Lead aesthetic targets`
  - `Support-only references`
  - `Sibling inheritance rule`
  - `Banned generic patterns`
  - `Anti-reference verdict`
  - `Recommended direction`
