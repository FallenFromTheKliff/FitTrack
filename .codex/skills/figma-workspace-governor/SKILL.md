---
name: figma-workspace-governor
description: "Use internally for premium FitTrack admin UI work when approved scaffolds must land in one organized master Figma workspace with consistent page taxonomy, naming, archive rules, and separation between product frames and annotation boards."
---

# FitTrack Figma Workspace Governor

Use this skill before scaffold authoring so premium admin work stays organized in one active Figma home instead of drifting across route-specific files.

## First pass

- Read the approved route or modal packet first.
- Read `references/workspace-governance-template.md`.
- Inspect the current active admin Figma file when one already exists.

## What this skill owns

- Master-file selection or recommendation
- Page taxonomy selection
- Naming conventions
- Archive policy
- Node-index hygiene
- Separation of annotation boards from final product frames

## What this skill does not own

- Reference discovery
- Route redesign
- Runtime review
- Final art-direction approval

## Workflow

1. Confirm the active master admin scaffold file.
2. Map the current surface to the correct page in that file.
3. Define naming rules for packet frames, product frames, and archive items.
4. Decide which older files or frames become migration sources versus active homes.
5. Package the placement rules for `figma-scaffold-builder`.

## Guardrails

- Do not create a new premium route file unless there is an explicit reason.
- Do not let packet notes, guardrail text, or board commentary live inside final viewport frames.
- Do not let frames overlap as random coordinates when page taxonomy can keep them organized.
- Keep one active master file for premium admin scaffolds by default.

## MCP routing

- Figma metadata and file inspection first
- `use_figma` only when the workspace really needs renaming, movement, or reorganization
- Do not use this skill to redesign components

## Output defaults

- Return:
  - `Workspace target file`
  - `Target page`
  - `Naming plan`
  - `Archive plan`
  - `Scaffold placement rules`
  - `Node-index update`
