# Professional UI/UX Skill Upgrade Pack

Date: 2026-04-19

This file records the skill-system changes needed to make premium admin UI work happen in one coordinated pass.

## Status

- The shared playbook is now documented in [professional-uiux-one-shot-playbook.md](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/docs/ai/professional-uiux-one-shot-playbook.md).
- This session could not write into `.codex/skills/` because the sandbox denied writes to that directory.
- The changes below are the exact setup upgrade that should be mirrored into the skill files when the folder is writable.

## Goal

When the user says something like:

- "Enhance this member page UI"
- "Make this admin route premium"
- "Do this 1:1 from Figma"

the system should default to this order:

1. scan the live route and repo truth
2. scan real route states and features
3. pull exact Figma composition plus narrow Exa benchmarks
4. create a collaborative Notion page under `Q&A God Tier Automation`
5. wait for `Approved to scaffold and implement this direction`
6. build the Figma scaffold
7. implement the route 1:1 from the scaffold
8. add restrained dynamic polish
9. verify against the scaffold and the original UX complaint

## Shared behavioral changes

- Figma must be treated as a composition lane, not just a token lane.
- The approved Figma scaffold becomes the structural source of truth.
- Implementation may adapt FitTrack theming, settings-driven fonts, accessibility, and reusable component boundaries, but should not re-compose the page through a generic shell.
- Professional admin motion belongs at the end of the run, after scaffold fidelity is already correct.
- The default desktop inspector should not be independently scrollable unless there is a very strong reason.
- The default external benchmark lane should be `Attio` first and `Linear` second for record-centric admin work.

## Exa benchmark decision

Using Exa research, the strongest default reference for FitTrack admin member and record-management surfaces is:

- `Attio` as the primary benchmark
- `Linear` as the secondary benchmark

Why `Attio` wins for this setup:

- Its official record-page guidance maps closely to FitTrack members and user-management workflows.
- It explicitly combines:
  - table rows as the list surface
  - record pages as the main detail surface
  - top highlights
  - record actions
  - tabs for activity, notes, tasks, files, and relationships
  - a right sidebar with structured sections
- That is a much better fit for member directories and operator-facing person records than generic dashboard templates.

Why `Linear` stays in the lane:

- Its official docs are strong for:
  - display-property discipline
  - grouping and ordering
  - filters
  - fast preview behavior through Peek
- This makes it the better reference for list density and interaction speed, even though it is less person-record-centric than Attio.

## Skill changes to apply

## `premium-route-rebuild`

Add these behaviors:

- Read `docs/ai/professional-uiux-one-shot-playbook.md` in the first pass.
- Extend the route workflow so it explicitly becomes:
  - route and feature scan
  - Figma and Exa reference lane
  - Notion collaboration page
  - approval checkbox
  - Figma scaffold
  - implementation packet
- Upgrade the Notion gate:
  - not only unresolved questions
  - also route goal, blockers, state map, feature inventory, and reference summary
  - plus the checkbox `Approved to scaffold and implement this direction`
- Add guardrail text:
  - scaffold encodes composition, not just tokens
  - do not let reusable shells override scaffolded page grammar
- Add reference-lane text:
  - default external benchmark is `Attio` for record-centric admin routes
  - use `Linear` as the secondary benchmark for list density, filtering, and preview mechanics
- Expand output defaults with:
  - `Notion approval gate`
  - `Figma scaffold source`
  - `1:1 implementation notes`
  - `Dynamic polish plan`

## `integration`

Add these behaviors:

- Read `docs/ai/professional-uiux-one-shot-playbook.md` in the first pass.
- Add a new phase after route rebuild for one-shot professional UI approval:
  - Serena and live-route scan
  - Figma plus Exa reference lane
  - Notion child page
  - approval checkbox
  - scaffold
  - 1:1 implementation
  - dynamic polish
- Treat the checkbox `Approved to scaffold and implement this direction` as the collaborative gate before scaffold and code.
- Update Notion workflow guidance so one-shot UI runs always carry:
  - route goal
  - blockers
  - feature inventory
  - reference summary
  - scaffold targets when known
  - approval checkbox
- Update reference-lane guidance so the orchestrator defaults to:
  - `Attio` for member, customer, user, and record-management admin surfaces
  - `Linear` for dense operational list behavior
- In resolve guidance:
  - `frontend` owns scaffold-faithful implementation
  - `frontend-uiux-polish` owns the motion and dynamic finish after fidelity is proven

## `frontend`

Add these behaviors:

- Read `docs/ai/professional-uiux-one-shot-playbook.md` in the first pass.
- If an approved scaffold exists, implement it 1:1 before making tasteful adjustments.
- Theme adaptation is allowed; composition drift is not.
- Componentize under the scaffold instead of changing the scaffold to fit a generic reusable shell.
- When Figma is part of an approved route packet, implementation should use exact nodes via `get_design_context` and `get_screenshot`.

## `frontend-uiux-polish`

Add these behaviors:

- Read `docs/ai/professional-uiux-one-shot-playbook.md` in the first pass.
- Add a dedicated `Scaffold fidelity mode`.
- In that mode, compare the live page to the scaffold at the composition level:
  - layout hierarchy
  - command-surface shape
  - roster density
  - inspector proportions
  - scroll ownership
  - action placement
- Add explicit rules:
  - professional admin pages should feel correct at `100%` desktop zoom
  - page-owned scroll is the default on desktop
  - motion begins only after fidelity is already right
- Add benchmark-lane defaults:
  - `Attio` first for record-centric admin composition
  - `Linear` second for dense-list behavior and preview interaction
  - generic admin-template blogs are not acceptable as the primary benchmark when these two references fit
- Expand outputs with:
  - `Scaffold fidelity verdict`
  - `Zoom-scale verdict`

## `skill-improver`

Add these failure families:

- Figma scaffold drift where implementation kept tokens but lost composition
- missing approval or collaboration gates on premium UI work

Add this maintenance rule:

- for recurring premium UI drift, patch the shared premium playbook and orchestrating skills before tightening the leaf implementation skills

## Recommended exact Figma lane

For one-shot premium UI work, the preferred tool order is:

1. `get_libraries`
2. `search_design_system`
3. `get_design_context`
4. `get_screenshot`
5. `use_figma`

## Recommended Exa lane

For premium admin routes, use Exa to validate or supplement the Figma lane in this order:

1. official `Attio` docs or product pages for record-centric admin composition
2. official `Linear` docs for dense-list, filter, and preview behavior
3. only then narrower benchmark searches if neither of the above answers the component problem

Avoid using template roundups, UI kits, or generic dashboard blog posts as the default quality bar.

## Recommended dynamic polish defaults

- hover and press: `120-160ms`
- filter, tab, or pagination state change: `180-220ms`
- panel, drawer, modal, or sticky-footer motion: `220-280ms`

Good finishing motions:

- subtle row or card entrance rhythm
- restrained pagination re-render transitions
- confident hover elevation and border response
- smooth inspector, drawer, or footer reveal

Avoid:

- bounce-heavy springs
- novelty loaders
- persistent shimmer spam
- loud reveal choreography on operational pages

## Why this upgrade matters

The current system already knows how to gate, audit, and avoid bloat. The missing piece is scaffold-faithful execution. This upgrade closes that gap by making premium UI work approval-aware, Figma-first, 1:1, and motion-last.
