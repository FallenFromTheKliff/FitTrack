---
name: ui-reference-lane
description: "Use internally for premium FitTrack UI work when component-level benchmark evidence must be captured from Figma, Exa, and Chrome DevTools before scaffold or implementation starts. This skill is for real provenance, not vibe-level inspiration."
---

# FitTrack UI Reference Lane

Use this skill as a contained premium-UI leaf lane. Do not use it as the first orchestrator.

## First pass

- Read the current route or modal packet first.
- Read `references/component-evidence-packet.md`.
- Read `references/aesthetic-source-ladder.md`.
- If Figma nodes already exist, inspect them before opening outside references.
- Use Exa to find the narrowest relevant source pages.
- Verify that browser screenshot capture is actually available before approving any aesthetic lane.
- Open chosen sources in Chrome DevTools and capture structure before approving them.

## What this skill owns

- Component-level reference capture
- Component anatomy supplements for decorator passes
- Reference-source selection and rejection
- Provenance by component
- Evidence-backed adaptation notes for FitTrack
- Structural and interaction benchmarks for premium surfaces
- Structural reference lane selection
- Aesthetic reference lane selection
- Reference-axis mapping by source
- Design-language seeds for shared admin grammar
- Purpose-driven search queries by domain, page job, and component

## What this skill does not own

- Route or modal architecture decisions by itself
- Notion approval authoring
- Figma scaffold authoring
- Final motion-system choice after implementation
- Generic inspiration dumps with no capture evidence

## Workflow

1. Start from the current component blockers and page purpose, not from broad page taste.
2. For each major component, identify the exact evidence need:
   - layout
   - hierarchy
   - density
   - disclosure
   - interaction
   - motion
3. When the macro scaffold is already correct but the page still feels generic, switch the lane into `component anatomy supplement` mode:
   - identify the weak zones
   - identify the weak controls
   - identify missing evidence objects or iconography
   - target those components directly instead of reopening route architecture
4. Build a `Reference keyword stack` before external search:
   - domain keywords
   - admin-management keywords
   - page-purpose keywords
   - component keywords
   - quality keywords
   - negative keywords
5. Split the evidence hunt into:
   - `Structural reference lane`
   - `Aesthetic reference lane`
   and declare what each lane is allowed to contribute.
6. Before approving the current live surface, existing scaffold, or sibling nodes as references, classify them as:
   - `adaptation_candidate`
   - `family_cue_only`
   - `anti_reference`
   Anything generic, vibe-coded, annotation-leaking, polished-wireframe-like, or structurally wrong for the page family should default to `anti_reference`.
7. Check existing Figma nodes first when they already answer the component question.
8. Search Exa for the narrowest useful sources using the keyword stack and page-purpose search strings, not sibling-page resemblance.
9. Before approving the aesthetic lane, verify a real browser capture path exists:
   - Chrome DevTools screenshot capture
   - or a known browser/Playwright screenshot tool that can produce image files for the run
   If only Exa text extraction is available, mark the lane `blocked` and hard stop with a diagnosis instead of pretending the visual evidence exists.
10. Open approved candidates in Chrome DevTools and capture:
   - a text snapshot
   - a screenshot when visuals matter
   - interaction notes when hover, tabs, or panels matter
11. For the aesthetic lane, build an `Aesthetic contact sheet`:
   - at least two screenshot-backed high-ceiling references
   - cropped callouts for the exact visual traits being borrowed
   - one note for what each source must not contribute
   Mid-ceiling product UIs may support workflow truth or domain fit, but they cannot lead the aesthetic lane alone.
12. When the downstream blocker is component flatness, also build a `Component anatomy contact sheet`:
   - one row per weak zone or component class
   - screenshot crop or approved node for the chosen trait
   - one note for what the component should not copy
   - control morphology implication
   - iconography or evidence-object implication
13. Record a `Reference axis map` for every approved source:
   - workflow
   - hierarchy
   - material
   - type
   - contrast
   - motion
14. Record a `Source ceiling` for every approved source:
   - `high_ceiling`
   - `mid_ceiling`
   - `low_ceiling`
   and state whether the source is:
   - `lead`
   - `support_only`
   - `reject`
15. Reject references that are:
   - generic admin template blogs
   - vague gallery shots with no usable structure
   - novelty-first patterns that would overpower the operator job
   - polished-but-safe utility products that are being asked to lead the whole aesthetic direction
16. Package the results by component and note what should become reusable admin-family grammar versus route-specific styling.

## Structural source order

Use this order unless the current packet already locks a stronger one:

1. Existing Figma route or modal frames
2. Official Attio references for record composition
3. Official Linear references for dense-list behavior
4. Aceternity UI for implementable interaction patterns
5. Hover.dev for animated component behavior
6. Cult UI for design-engineer-grade blocks
7. Awwwards only after the component type is already chosen

## Aesthetic source ladder

Use this ladder when the run needs stronger visual identity, authored material language, or a more distinctive premium feel:

1. Awwwards `UI Design`, `Interaction`, or `Animation` captures for ambition pressure and first-glance identity
2. Cult UI for design-engineer-grade surfaces, shader, blur, and premium component atmosphere
3. Hover.dev for strong animated sections, surface silhouettes, and interaction-heavy visual language
4. Aceternity UI for named patterns with clear visual signatures
5. Magic UI direct MCP for supporting motion, lighting, and tasteful component-level flourish after the page family is already chosen
6. Branded performance or fitness product UIs such as Garmin only as `support_only`
7. Utility SaaS products such as Cal.com, Linear, Attio, BellaBooking, or Gymdesk only as `support_only` unless the packet explicitly proves they are supplying a specific visual trait rather than safe polish

An aesthetic lane is `weak` when it is led only by mid-ceiling or support-only sources.

## Guardrails

- Exa is for finding sources, not for approving them alone.
- Exa-only summaries are not enough for premium approval.
- Exa fetch output is text evidence, not screenshot evidence.
- Every approved reference must be backed by:
  - a Figma node
  - or a Chrome DevTools capture
- If the lane cannot produce real screenshot files or browser image captures for the run, mark it `blocked` and stop the premium aesthetic lane there.
- Do not let motion references outrank structural references.
- Do not accept a page-vibe reference when the real problem is a table, modal, pagination, or command bar.
- Do not hand a flat component problem to `component-decorator` without a `Component anatomy contact sheet`.
- If a component cannot be tied to a real source, mark it as invented and reject it.
- Do not let sibling admin pages drift into unrelated design families when the component problem can be solved inside one shared grammar.
- Do not let a sibling page such as Members become the primary benchmark for a different page family such as Schedule, Analytics, or Inventory.
- Sibling surfaces may inform family cues only after the page-purpose benchmark lane is already explicit.
- Do not use the current page or scaffold as a structural benchmark once it has been classified as `anti_reference`.
- Screenshots are not enough on their own. The packet must state which axis the source contributes and what should not be copied from it.
- Do not average several strong references into one bland output. If sources disagree, record the chosen axis and reject the rest.
- Do not approve the aesthetic lane without at least two screenshot-backed `high_ceiling` sources unless the packet explicitly downgrades the ambition bar.
- Do not let `support_only` sources become the unspoken visual lead just because they are more practical or easier to copy.
- If the aesthetic captures cannot show exact material, type, contrast, or component-anatomy cues, mark the lane `weak` and reopen benchmark hunting.
- If the run cannot prove browser screenshot availability, do not silently continue with a text-led contact sheet.

## MCP routing

- Figma first when the file already contains relevant nodes
- Exa second for source discovery
- Chrome DevTools third for evidence capture
- Magic UI is not part of this lane unless the request is specifically about motion patterns and the structure is already settled

## Output defaults

- Return:
  - `Reference lane`
  - `Structural reference lane`
  - `Aesthetic reference lane`
  - `Reference keyword stack`
  - `Aesthetic source ladder verdict`
  - `Screenshot capture verdict`
  - `Visual evidence availability`
  - `Aesthetic contact sheet`
  - `Component anatomy contact sheet`
  - `Adaptation candidate verdict`
  - `Anti-reference surfaces`
  - `Reference axis map`
  - `Source ceiling by reference`
  - `Lead versus support-only reference roles`
  - `Reference captures by component`
  - `Reference provenance by component`
  - `Design language handoff`
  - `Signature elements by component`
  - `Banned generic patterns`
  - `Sibling inheritance verdict`
  - `Rejected references`
  - `FitTrack adaptation notes`
  - `Components still under-referenced`
  - `Decorator component blockers`
