---
name: ui-art-direction-review
description: "Use internally for premium FitTrack UI work after scaffold authoring and before code when the team needs a hard pre-code critique to reject clean-but-generic, annotation-leaking, or conservative scaffolds that still undershoot the desired professional bar."
---

# FitTrack UI Art Direction Review

Use this skill after the scaffold exists and before implementation starts. This is the pre-code quality gate for visual ambition and product feel.

## First pass

- Read the approved reference packet.
- Read the current design-language packet.
- Read `references/art-direction-rubric.md`.
- Review the scaffold screenshots and node map, not just the packet prose.
- Confirm whether the aesthetic lane had enough screenshot-backed high-ceiling evidence to justify a premium pass.
- Confirm whether browser screenshot capture was truly available during the reference lane.
- If a `component-decorator` packet exists, read it before issuing the verdict.
- If a `Component anatomy contact sheet` exists, read it before issuing the verdict.

## What this skill owns

- Pre-code scaffold critique
- Art-direction verdict
- Annotation leakage detection
- Conservative-layout rejection
- Page-family consistency checks
- Reference fidelity checks
- Distinctiveness and silhouette-delta checks
- Material-language checks
- Anti-reference distance checks

## What this skill does not own

- Code changes
- Backend changes
- Final QA
- Motion implementation
- Figma authoring

## Workflow

1. Compare the scaffold against the approved references, the chosen concept, the page-family grammar, and any surfaces explicitly marked `anti_reference`.
2. Identify what still feels generic, timid, annotation-like, too inherited from a rejected prior composition, or too dependent on support-only references.
3. Decide whether the scaffold is ready for code.
4. If not ready, state exactly what must be stronger before implementation.
5. Hand back a clear pass or fail verdict.

## Guardrails

- Do not approve a scaffold just because it is cleaner than before.
- Reject packet or board language leaking into product frames.
- Reject conservative compositions that still read like polished wireframes rather than product UI.
- Reject scaffolds that do not clearly belong to the same FitTrack admin family as sibling premium pages.
- Reject scaffolds that still inherit their dominant composition from a surface or scaffold that was already classified as `anti_reference`.
- Reject scaffolds that can be described as the same layout with renamed panels, the same shell with different nouns, or the same scaffold with new colors.
- Reject scaffolds whose primitive kit still reads as generic premium SaaS even when the silhouette changed.
- Reject scaffolds when the macro layout improved but the component pass never happened.
- Reject scaffolds when the micro pass still relies on placeholder circles, anonymous pseudo-icons, or repeated icon tiles with no screenshot-backed provenance.
- Reject scaffolds when control morphology, evidence objects, or component-specific iconography were improvised without the micro reference lane.
- Reject scaffolds when the strongest aesthetic captures are not visibly traceable in the screenshot.
- Reject scaffolds when only support-only references are visible in the final result.
- Reject scaffolds when the upstream aesthetic lane relied on text-only Exa summaries while claiming screenshot-backed evidence.

## MCP routing

- Figma screenshots and metadata first
- Reference packet second
- No code or runtime tools here

## Output defaults

- Return:
  - `Art direction verdict`
  - `What still feels generic`
  - `What must be stronger before code`
  - `Distinctiveness verdict`
  - `Silhouette delta verdict`
  - `Screenshot evidence verdict`
  - `Micro design verdict`
  - `Primitive-kit verdict`
  - `Material-language verdict`
  - `Aesthetic source ceiling verdict`
  - `Screenshot capture verdict`
  - `Anti-reference distance`
  - `Inheritance drift verdict`
  - `Scaffold-ready verdict`
  - `Reference fidelity verdict`
