---
name: premium-route-rebuild
description: "Use for flagged high-visibility FitTrack routes when iterative premium patching has failed and the page needs a route-wide, design-first rebuild packet: live audit, state inventory, operator-first feature scan, keep-replace-remove-add decisions, Figma plus Exa references, mandatory high-fidelity wireframes, a Notion-backed Q&A decision gate, and one-shot implementation slices."
---

# FitTrack Premium Route Rebuild

Use this skill for route-wide premium rebuilds when the user wants a full page handled in one go instead of another patch cycle.

> Changelog 2026-04-20: added stricter one-shot scaffold requirements for interaction modeling, overlay ownership, scroll ownership, breakpoint composition, stronger Figma packaging, collaborative stop points, component fix-versus-enhancement outputs, reference provenance, and decoupled handoffs to the consultation, reference, design-language, Notion, workspace, scaffold, art-direction, modal, motion, and runtime-review lanes.

## First pass

- Use Serena before broad repo scans.
- Start from the live route, not from old QA claims.
- Read only what is needed:
  - the nearest route shell and stateful route components
  - the current `integration`, `frontend-uiux-polish`, `brainstorm`, `system-adapt`, and `quality-assurance` skills when the rebuild is likely to go straight into implementation
  - the Figma lab file or known route nodes when a route wireframe already exists

## What this skill owns

- Full-route audit rather than isolated component patching
- State inventory:
  - landing state
  - secondary route modes
  - create or task states
  - important overlays such as scan, detail, confirm, destructive, and success flows
- Feature inventory:
  - current jobs the page supports
  - missing behaviors
  - missing components
  - operator-first additions only
- Route verdict:
  - `good_enough`
  - `needs_relayout`
  - `needs_component_replacement`
  - `blocked_external`
- Route-wide redesign decision before code implementation starts
- Design-decision checkpoint before code implementation starts
- Mandatory high-fidelity Figma wireframe creation or update before implementation starts
- Route implementation slicing for one-shot execution
- Recommendation-first Notion Q&A capture for unresolved high-impact tradeoffs
- Collaborative approval gating before scaffold and code on recommendation-first premium runs
- Reference captures by component
- Interaction scaffold
- Overlay ownership matrix
- Scroll ownership plan
- Breakpoint composition plan
- Motion choreography
- Design thesis and visual-DNA direction
- Concept divergence gating before scaffold lock
- Scaffold node map
- Allowed implementation deviations
- Major modal scaffolds when a modal is a first-class part of the route job
- Route-level direction for downstream leaf skills:
  - `professional-ui-brainstorm`
  - `ui-reference-lane`
  - `ui-visual-dna-director`
  - `admin-design-language`
  - `ui-notion-gate`
  - `figma-workspace-governor`
  - `figma-concept-explorer`
  - `figma-scaffold-builder`
  - `ui-art-direction-review`
  - `ui-animator`
  - `ui-runtime-review`

## What this skill does not own

- Pure micro-polish on an already-approved route
- Backend-heavy contract repair that is not required for operator-first UX
- Broad product-roadmap ideation
- New modules that exist only to make a page feel richer
- Direct Chrome DevTools evidence capture once the reference lane is delegated
- Direct Notion page authoring once the decision packet is delegated
- Direct Figma scaffold authoring once the structure is explicit
- Final motion-system selection after implementation
- Post-implementation browser click-through once runtime review starts

## Workflow

1. Restate the route's main operator job in plain product terms.
2. Inventory every meaningful route state:
   - default landing state
   - contained secondary states
   - task views
   - overlays
3. Audit the current route live and classify:
   - current tier
   - weakest state
   - weakest components
   - missing behaviors
4. Classify the current live route, the current scaffold, and the nearest sibling premium surface as:
   - `adaptation_candidate`
   - `family_cue_only`
   - `anti_reference`
   If a surface still reads as generic, vibe-coded, polished-wireframe-like, annotation-leaking, or wrong for the route's operator job, it must default to `anti_reference`.
5. Run the feature scan:
   - what operators need to lookup, triage, review, create, or resolve faster
   - what behaviors are missing
   - what data is missing or over-rendered
   - what navigation or reversibility is missing
6. Run the operator-first opportunity scan:
   - premium people-directory, list, or record-surface improvements
   - command-bar and filter improvements
   - pagination improvements
   - segmented or tabbed workflow switching
   - task-view improvements
   - optional preview or inspector patterns only if they help the main job without clutter
7. Before benchmark capture, define a `Reference keyword stack` from:
   - domain keywords
   - admin-management keywords
   - page-purpose keywords
   - component keywords
   - quality keywords
   - negative keywords
8. Hand component-level benchmark capture to `ui-reference-lane` in this order:
   - Figma route file and route nodes
   - existing route or modal frames inside that file
   - design-system search inside that file when useful
   - official Attio references for operator-first composition
   - official Linear references for dense-list behavior
   - Aceternity UI, then Hover.dev, then Cult UI for named interaction building blocks
   - Awwwards only after the structural answer is already stable
9. Hand the captured evidence to `ui-visual-dna-director` so the route gets a non-page-specific design thesis, visual DNA, and signature moves before Figma concepting starts.
10. Decide the route verdict:
   - `good_enough`
   - `needs_relayout`
   - `needs_component_replacement`
   - `blocked_external`
11. Lock the redesign direction for the whole route before code:
   - state model
   - navigation model
   - primary and secondary workflow placement
   - data-rendering priorities
   - design thesis
   - visual DNA
   - component replacements allowed
   - interaction scaffold
   - overlay ownership
   - scroll ownership
   - breakpoint composition
   - motion choreography
12. Produce a `Design Decision Checkpoint`:
   - `Keep`
   - `Replace`
   - `Remove`
   - `Add`
   - `Needs user decision`
13. Record a `Sibling inheritance rule` so nearby premium pages can influence family language without dictating the page's structural benchmark.
14. Hand the reference packet to `admin-design-language` so the route gets page-family rules, signature elements, copy-density rules, visual DNA, and banned generic patterns before the Figma phase.
15. If Notion is available, hand the page authoring to `ui-notion-gate` and create or update a child page under `Q&A God Tier Automation` before implementation starts.
16. For collaborative premium runs, include one checkbox for `Approved to scaffold and implement this direction`.
17. Hand workspace governance to `figma-workspace-governor` so the Figma phase lands in the master admin file and correct page instead of drifting into a route-only file.
18. Hand the approved direction to `figma-concept-explorer`. The Figma phase must produce three divergent concepts and one chosen concept before scaffolding starts.
19. Hand the chosen concept to `figma-scaffold-builder` after it is explicit. The scaffold must be implement-ready, not a vibe board.
20. Package the scaffold for 1:1 implementation:
   - named frames for default landing, selected or inspected, create or edit, confirm or destructive, and empty or loading or error states when they matter
   - frame names
   - node ids
   - reference captures by component
   - structural reference lane
   - aesthetic reference lane
   - reference axis map
   - adaptation candidate verdict
   - anti-reference surfaces
   - design thesis
   - visual DNA
   - material language
   - typography posture
   - contrast and lighting model
   - shape and edge policy
   - signature moves
   - family variant rules
   - professional blockers
   - design language fit
   - signature elements
   - banned generic patterns
   - concept divergence matrix
   - selected concept
   - selected concept rationale
   - composition targets that must stay visually exact
   - row or card anatomy
   - what shows, hides, replaces, or slides during interactions
   - scroll ownership
   - workspace target file
   - target page
   - FitTrack theming and settings adaptations that are allowed
   - allowed implementation deviations
21. Hand the scaffold to `ui-art-direction-review` before code. If the verdict is still conservative, generic, annotation-leaking, or structurally inherited from an `anti_reference`, stop there and strengthen the scaffold first.
22. Only after the scaffold exists, the workspace is correct, and art direction passes, produce the one-shot implementation packet and QA gates.
23. Treat motion as a downstream handoff. After implementation and static polish, send the surface to `ui-animator` for the final motion system and to `ui-runtime-review` for the live browser feel check.
24. For collaborative premium runs, stop after the Notion recommendation page and after the Figma phase unless the user explicitly asks to continue into implementation.

## Guardrails

- Treat the route as one product surface with coordinated states, not as a list of unrelated patch targets.
- Keep feature expansion operator-first:
  - speed up lookup
  - speed up triage
  - speed up review
  - speed up creation
  - improve navigation and reversibility
  - improve data usefulness
- Do not add broad new modules just to make the page feel richer.
- Default preservation is narrow:
  - keep brand theme and tokens
  - keep typography voice unless a deliberate upgrade is clearly stronger
  - keep business-critical jobs and required data
  - everything else must earn its place
- Route labels, headings, CTA text, and panel names should read like product language that operators can understand quickly. Do not preserve internal tooling jargon when friendlier, more professional copy is clearly stronger.
- Weak legacy copy, layout, controls, columns, labels, badges, stats, and even weak functional patterns may be removed or replaced when the route improves.
- Do not let one polished child mode justify a route-level premium claim.
- The landing state must earn premium in its own right.
- The wireframe gate is mandatory for flagged route rebuilds. Do not start implementation from text-only taste claims when the route still needs relayout or component replacement.
- The scaffold must encode composition, not just tokens. Implementation should not keep the colors while quietly changing the page grammar.
- Do not start code until the interaction scaffold, overlay ownership matrix, scroll ownership plan, breakpoint composition plan, motion choreography, scaffold node map, and allowed implementation deviations are explicit.
- Do not start code until `ui-art-direction-review` passes the scaffold.
- Do not let the nearest sibling premium page act as the primary structural answer when the current route has a different page family and operator job.
- Use sibling pages for family coherence only after the purpose-driven benchmark lane is explicit.
- Do not let the current route or scaffold stay in the benchmark lane once it has been classified as `anti_reference`.
- Do not allow the Figma phase to skip concept divergence. Three concepts and one selected concept are mandatory for premium route rebuilds.
- Do not accept three concept variants that share the same silhouette with only surface-level label or color changes.
- One primary overlay owner is allowed at a time. Nested dialog-on-dialog stacks are forbidden unless the approved scaffold explicitly uses a confirm overlay on top of a parent flow.
- Desktop inspectors and sidebars should not be independently scrollable by default. The page should own the scroll unless the approved scaffold assigns that ownership elsewhere.
- The decision checkpoint is mandatory before implementation. Do not jump from audit straight into code while keep-versus-replace questions are still implicit.
- When `Needs user decision` is non-empty, present concise recommendation-first questions such as:
  - keep this or replace it
  - keep this or remove it
  - keep this interaction model or switch to the stronger one
  before implementation starts.
- The Notion Q&A lane should use this structure:
  - one child page per route or rebuild pass under `Q&A God Tier Automation`
  - each unresolved decision as its own question section
  - three recommended checkbox options in ranked order
  - one checkbox for `Custom option`
  - one short note explaining the recommended default and why
- For collaborative premium runs, also include one checkbox for `Approved to scaffold and implement this direction`.

## MCP routing

- Serena is required for route and state discovery.
- Browser DevTools is required for live-route truth and screenshots.
- Figma is required for the route wireframe gate.
- Use Figma in this order:
  1. `get_libraries`
  2. `search_design_system`
  3. `get_design_context`
  4. `use_figma`
- Exa is required when outside premium admin patterns improve route decisions.
- For record-centric admin routes such as members, users, customers, and CRM-like directories, default the Exa benchmark lane to:
  - `Attio` first for record-page composition and supporting detail structure
  - `Linear` second for dense-list behavior, filtering, and preview mechanics
- After the route structure is clear, use Exa for implementable interaction patterns in this order:
  - `Aceternity UI`
  - `Hover.dev`
  - `Cult UI`
- Use `Awwwards` only for inspiration pressure on UI, animation, and interaction after the route shape is already stable.
- Do not use `Magic UI` in the Exa lane here; use the Magic UI MCP directly if it becomes the right motion or component source.
- Generic admin template blogs are fallback-only references here.
- Magic UI is optional and only for motion and microinteraction reference after structure is approved.
- Context7 is optional and only after the structural direction is chosen and implementation details matter.
- Notion is required when recommendation-first questions need to be captured before implementation.

## Output defaults

- Return:
  - `Route verdict`
  - `Current tier`
  - `Target tier`
  - `Route state map`
  - `Feature inventory`
  - `Keep / Replace / Remove / Add matrix`
  - `Missing components`
  - `Missing behaviors`
  - `Weak components`
  - `Professional blockers`
  - `Fixes by component`
  - `Enhancements by component`
  - `Adaptation candidate verdict`
  - `Anti-reference surfaces`
  - `Design thesis`
  - `Emotional keywords`
  - `Signature opportunity`
  - `Anti-reference verdict`
  - `Reference keyword stack`
  - `Structural reference lane`
  - `Aesthetic reference lane`
  - `Reference axis map`
  - `Operator-first additions`
  - `Component replacement candidates`
  - `Needs user decision`
  - `Navigation model`
  - `Data-rendering priorities`
  - `Reference lane`
  - `Reference captures by component`
  - `Reference targets by component`
  - `Reference provenance by component`
  - `Sibling inheritance rule`
  - `Design language fit`
  - `Page family`
  - `Visual DNA`
  - `Material language`
  - `Typography posture`
  - `Contrast and lighting model`
  - `Shape and edge policy`
  - `Signature moves`
  - `Family variant rules`
  - `Signature elements`
  - `Banned generic patterns`
  - `Notion approval gate`
  - `Interaction scaffold`
  - `Overlay ownership matrix`
  - `Scroll ownership plan`
  - `Breakpoint composition plan`
  - `Motion choreography`
  - `Wireframe frame list`
  - `Figma scaffold source`
  - `Concept divergence matrix`
  - `Selected concept`
  - `Selected concept rationale`
  - `Scaffold node map`
  - `Workspace target file`
  - `Target page`
  - `Art direction verdict`
  - `Distinctiveness verdict`
  - `Silhouette delta verdict`
  - `Anti-reference distance`
  - `Inheritance drift verdict`
  - `Scaffold-ready verdict`
  - `Reference fidelity verdict`
  - `Data-shape bias decisions`
  - `Allowed implementation deviations`
  - `1:1 implementation notes`
  - `Implementation slices`
  - `QA gates`
- For high-visibility admin routes, also include:
  - `Landing-state score`
  - `Secondary-state score`
  - `Create-task score`
  - `Overlay score`
  - `Route-level premium blockers`
  - `Scope cuts`
- Keep the output decision-complete enough that `integration`, `frontend-uiux-polish`, `frontend`, and `quality-assurance` can execute without reopening the route shape.
- For each major component, the packet must say:
  - what is broken now
  - which fix closes that problem
  - which enhancement options are worth considering after the fix
  - which enhancement is approved for the first implementation, if any
- Each enhancement must cite real source evidence from Figma or the named benchmark lane. Generic dashboard taste without provenance is not enough.
- If a chosen component direction depends on better canonical data semantics, record a `Data-shape bias decision` instead of leaving the frontend to improvise around the gap.
- If the user is collaborating before implementation, surface `Needs user decision` as direct recommendation-first questions and, when available, mirror them into `Q&A God Tier Automation`.
