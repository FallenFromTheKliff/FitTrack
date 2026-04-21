---
name: premium-route-rebuild
description: "Use for flagged high-visibility FitTrack routes when iterative premium patching has failed and the page needs a route-wide, design-first rebuild packet: live audit, state inventory, operator-first feature scan, keep-replace-remove-add decisions, Figma plus Exa references, mandatory high-fidelity wireframes, a Notion-backed Q&A decision gate, and one-shot implementation slices."
---

# FitTrack Premium Route Rebuild

Use this skill for route-wide premium rebuilds when the user wants a full page handled in one go instead of another patch cycle.

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

## What this skill does not own

- Pure micro-polish on an already-approved route
- Backend-heavy contract repair that is not required for operator-first UX
- Broad product-roadmap ideation
- New modules that exist only to make a page feel richer

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
4. Run the feature scan:
   - what operators need to lookup, triage, review, create, or resolve faster
   - what behaviors are missing
   - what data is missing or over-rendered
   - what navigation or reversibility is missing
5. Run the operator-first opportunity scan:
   - premium people-directory, list, or record-surface improvements
   - command-bar and filter improvements
   - pagination improvements
   - segmented or tabbed workflow switching
   - task-view improvements
   - optional preview or inspector patterns only if they help the main job without clutter
6. Pull reference material in this order:
   - Figma route file and route nodes
   - design-system search inside that file when useful
   - Exa product-pattern references for operator-first gaps, defaulting to Attio first and Linear second for record-centric admin surfaces
7. Decide the route verdict:
   - `good_enough`
   - `needs_relayout`
   - `needs_component_replacement`
   - `blocked_external`
8. Lock the redesign direction for the whole route before code:
   - state model
   - navigation model
   - primary and secondary workflow placement
   - data-rendering priorities
   - component replacements allowed
9. Produce a `Design Decision Checkpoint`:
   - `Keep`
   - `Replace`
   - `Remove`
   - `Add`
   - `Needs user decision`
10. If Notion is available, create or update a child page under `Q&A God Tier Automation` before implementation starts.
11. For collaborative premium runs, include one checkbox for `Approved to scaffold and implement this direction`.
12. Build or update the route-wide high-fidelity Figma scaffold after the direction is explicit.
13. Package the scaffold for 1:1 implementation:
   - frame names
   - node ids
   - composition targets that must stay visually exact
   - FitTrack theming and settings adaptations that are allowed
14. Only after the scaffold exists and high-impact decisions are resolved, produce the one-shot implementation packet and QA gates.

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
  - `Operator-first additions`
  - `Component replacement candidates`
  - `Needs user decision`
  - `Navigation model`
  - `Data-rendering priorities`
  - `Reference lane`
  - `Reference targets by component`
  - `Notion approval gate`
  - `Wireframe frame list`
  - `Figma scaffold source`
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
- If the user is collaborating before implementation, surface `Needs user decision` as direct recommendation-first questions and, when available, mirror them into `Q&A God Tier Automation`.
