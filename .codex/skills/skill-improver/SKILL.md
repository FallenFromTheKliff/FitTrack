---
name: skill-improver
description: Use explicitly for FitTrack skill maintenance when a custom skill produces weak, incomplete, repeated, or constraint-breaking outputs, when MCP routing is missing or wrong, or when repo conventions change and the skill guidance must be updated surgically instead of rewritten wholesale.
---

# FitTrack Skill Improver

This skill is explicit-only. Do not run it automatically.

> Changelog 2026-04-20: added interaction-scaffold, overlay-ownership, scroll-ownership, underpowered-motion, motion-library-drift, and inconsistent-animation-voice failure coverage for the premium UI lane.

## First pass

- Read the target skill folder under `.codex/skills/<skill-name>/`.
- Use Serena or focused file reads first. Do not broad-scan the whole repo when the issue is isolated to one skill.
- Read only what is needed:
  - target `SKILL.md`
  - target `agents/openai.yaml`
  - target `examples/good-outputs.md`
  - target `examples/bad-outputs.md`
  - only the target references that relate to the failure
- Use `scripts/diff-skill.mjs` to seed a targeted improvement proposal before editing.

## Default workflow

1. Identify the exact failure pattern.
2. Decide whether the failure came from trigger drift, weak workflow guidance, missing MCP routing, or missing examples.
3. Find the narrowest section of the skill that should have prevented it.
4. Patch only the failing section or its closest supporting reference.
5. Update examples when the failure pattern or the better output is now known.

## Common failure families

- multi-agent routing drift
- weak worker packets that force unnecessary broad rescans
- missing or incorrect MCP usage by phase
- sibling-skill overlap that causes trigger confusion
- "verified but uncanny" outputs where the route worked but the result still felt partial
- weak benchmark-lane defaults that push premium UI work toward generic admin template references
- scaffold drift where implementation kept the theme but lost the approved composition
- interaction scaffold omission where the run skipped how states, overlays, and transitions should actually behave before code started
- overlay ownership drift where details, edit, or destructive flows stack dialogs or competing panels instead of following one approved owner
- scroll ownership drift where desktop inspectors, rails, or sidebars become accidental independent scroll traps
- underpowered motion language where the page technically animates but still feels static and low-premium
- motion-library drift where the team starts guessing animations locally instead of using the approved motion catalog or Notion motion bible
- inconsistent animation voice where hover, panels, pagination, and confirmations feel like different products
- novelty animation creep where gradients, ambient effects, or flourish patterns overpower the primary task
- dead-but-technically-animated surfaces where transitions exist but still fail to change the perceived feel
- generic component drift where the run used page-vibe taste instead of real component references, provenance, or scaffold nodes
- design-language drift where sibling admin pages stop sharing one coherent family grammar
- Figma workspace drift where premium scaffolds spread into route-specific files instead of the governed master file
- art-direction underreach where the scaffold is structurally correct but still too conservative, bland, or prototype-like
- visual-DNA omission where the route packet is structurally strong but still has no memorable material language or identity thesis
- concept-divergence collapse where the Figma phase produces multiple variants that share one silhouette
- aesthetic-lane omission where references solve workflow but not visual character
- weak screenshot-evidence lane where sources are named but not captured tightly enough to drive visible art direction
- low-ceiling aesthetic lane where polished utility products or safe component libraries quietly replace higher-ambition reference sourcing
- reference-axis ambiguity where sources are cited but the packet never states what each one contributes
- annotation leakage where packet, guardrail, or board-copy wording escapes into final product frames
- conservative-but-approved scaffold failure where the gate passed a clean scaffold that still reads generic in screenshots
- bad data-shape bias where the frontend was bent around underspecified backend semantics instead of escalating the canonical shape
- AI domain prompts that fail to enforce strict contracts on lower-tier models

## Surgical edit rules

- Do not rewrite the whole skill unless the failure is structural.
- Preserve trigger boundaries and keep descriptions non-overlapping with sibling skills.
- Keep `agents/openai.yaml` aligned with the real trigger behavior.
- Add a new reference file only when missing reference material would have prevented the failure.
- If the failure is benchmark-lane drift, patch the orchestrating skill and the UI polish skill before tightening leaf implementation language.
- If the failure is scaffold drift, patch the orchestrator and the frontend lanes before adding more polish rules.
- If the failure is interaction scaffold omission, patch the orchestrator, route-rebuild, frontend, UI polish, and QA lanes together.
- If the failure is overlay ownership drift or scroll ownership drift, patch the orchestrator and QA lanes before tweaking component recipes.
- If the failure is underpowered motion language, patch the UI polish skill and the QA closure bar together.
- If the failure is motion-library drift, patch `ui-animator`, `ui-notion-gate`, and the orchestrator together so the catalog, motion bible, and routing stay aligned.
- If the failure is inconsistent animation voice or novelty animation creep, patch `ui-animator` and `quality-assurance` together before changing component recipes.
- If the failure is generic component drift, patch the orchestrator, route-rebuild, UI polish, and QA lanes together so provenance is required from planning through closure.
- If the failure is design-language drift, patch `admin-design-language`, `ui-notion-gate`, and the orchestrator together so the canon and route packets stay aligned.
- If the failure is Figma workspace drift, patch `figma-workspace-governor`, `figma-scaffold-builder`, and `quality-assurance` together before changing route recipes.
- If the failure is art-direction underreach or conservative-but-approved scaffold failure, patch `ui-art-direction-review`, the orchestrator, and the scaffold lane together before adding more polish rules.
- If the failure is visual-DNA omission or aesthetic-lane omission, patch `professional-ui-brainstorm`, `ui-reference-lane`, `ui-visual-dna-director`, and `admin-design-language` together before touching scaffold recipes.
- If the failure is weak screenshot-evidence or low-ceiling aesthetic sourcing, patch `ui-reference-lane`, `ui-visual-dna-director`, `figma-concept-explorer`, and `ui-art-direction-review` together before tightening implementation language.
- If the failure is concept-divergence collapse, patch `figma-concept-explorer`, `figma-scaffold-builder`, `ui-art-direction-review`, and `quality-assurance` together so Figma cannot quietly reskin the anti-reference.
- If the failure is annotation leakage, patch `figma-scaffold-builder`, `frontend-uiux-polish`, and `quality-assurance` together so packet language cannot sneak into product UI.
- If the failure is bad data-shape bias, patch `integration`, `frontend`, `backend`, and `quality-assurance` together so ownership is decided once instead of fought in code.
- If the failure spans multiple related skills, patch the orchestrating skill first, then the affected companion skills.

## Escalation rules

- If the same failure pattern still occurs after three targeted updates, flag it as a structural redesign problem.
- If the failure is caused by a stack, workflow, or pipeline change, update the shared orchestrating skill before tightening leaf skills.

## Output defaults

- Prefer a small diff over a full rewrite.
- State the exact failure pattern being addressed.
- Keep the skill lean after each revision.
