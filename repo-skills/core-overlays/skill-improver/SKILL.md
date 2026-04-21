---
name: skill-improver
description: Use explicitly for FitTrack skill maintenance when a custom skill produces weak, incomplete, repeated, or constraint-breaking outputs, when MCP routing is missing or wrong, or when repo conventions change and the skill guidance must be updated surgically instead of rewritten wholesale.
---

# FitTrack Skill Improver

This skill is explicit-only. Do not run it automatically.

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
- AI domain prompts that fail to enforce strict contracts on lower-tier models

## Surgical edit rules

- Do not rewrite the whole skill unless the failure is structural.
- Preserve trigger boundaries and keep descriptions non-overlapping with sibling skills.
- Keep `agents/openai.yaml` aligned with the real trigger behavior.
- Add a new reference file only when missing reference material would have prevented the failure.
- If the failure is benchmark-lane drift, patch the orchestrating skill and the UI polish skill before tightening leaf implementation language.
- If the failure is scaffold drift, patch the orchestrator and the frontend lanes before adding more polish rules.
- If the failure spans multiple related skills, patch the orchestrating skill first, then the affected companion skills.

## Escalation rules

- If the same failure pattern still occurs after three targeted updates, flag it as a structural redesign problem.
- If the failure is caused by a stack, workflow, or pipeline change, update the shared orchestrating skill before tightening leaf skills.

## Output defaults

- Prefer a small diff over a full rewrite.
- State the exact failure pattern being addressed.
- Keep the skill lean after each revision.
