---
name: integration
description: "Use for FitTrack full-stack integration work: connect web or mobile flows to backend endpoints, audit contract and completion gaps, coordinate frontend, backend, UI polish, and QA skills, and verify integrated behavior with Serena, Notion, Prisma Local, Swagger, Playwright, Browser DevTools, and approved research MCPs."
---

# FitTrack Integration

This skill is for end-to-end feature wiring, completion audits, and orchestrator-grade routing. Do not skip phases.

## Changelog

- 2026-04-13: aligned the skill to the current tracker hierarchy, added explicit companion-skill routing, and tightened final verification to the QA order of direct API, Swagger, and Playwright evidence.
- 2026-04-14: added adaptive-lean orchestration, required coupling scans, MCP-aware worker packets, and explicit default execution modes for single-worker, dual-worker, and serialized runs.
- 2026-04-17: added the ideation lane, runtime failure classification, UI excellence and anti-bloat enforcement, and MCP routing for Browser DevTools, PostgreSQL, Exa, Context7, Figma, Lighthouse, and the current accessibility lane.
- 2026-04-17: enforced the premium-gap scan as the first pass for user-facing surface revisions and allowed recommendation-first flow, data-density, modal, and motion reshaping before implementation.
- 2026-04-18: tightened premium-target closure, reference-lane requirements, copy-density rules, and secondary-surface containment guidance for deployment-ready admin UI.
- 2026-04-18: added component-first premium flow so major components are scanned, benchmarked against references, aligned to FitTrack, validated, and only then motion-polished.
- 2026-04-18: upgraded the premium lane to Premium UI Enforcement v2 with a hard review verdict, missing-component opportunity scan, redesign-or-replace gate, and required component-reference lane for flagged high-visibility surfaces.
- 2026-04-18: added Figma-lane viability checks, visual-delta assessment, task-view authenticity checks, and a human-eye premium closure bar so weak reference lanes cannot falsely validate premium work.
- 2026-04-18: added a shared premium preset for motion timing, navigation experience, data-rendering discipline, and Magic UI-assisted microinteraction guidance on flagged premium surfaces.
- 2026-04-18: added route-vs-mode honesty, header-compression checks, and low-signal list or table detection so one upgraded subflow cannot falsely mark an untouched default surface as premium.
- 2026-04-18: added the route-wide premium rebuild gate so high-visibility admin pages can be audited, wireframed in Figma, and implemented as one coordinated route instead of iterative patch cycles.
- 2026-04-19: added the keep-replace-remove-add decision checkpoint so premium route rebuilds must surface legacy removals and functional replacements before implementation starts.
- 2026-04-19: added Attio-first and Linear-second benchmark defaults so premium admin reference lanes stop relying on generic template blogs.
- 2026-04-19: added the scaffold-first lane so collaborative premium runs must lock an approved Figma scaffold and implement it 1:1 before motion polish.
- 2026-04-20: hardened the premium UI lane with explicit interaction-scaffold, overlay-ownership, scroll-ownership, breakpoint, motion, and stop-point gates so high-visibility pages and major modals can close in one shot instead of drifting through follow-up refactors.
- 2026-04-20: added an explicit constraint-scan gate before shared refactors or endpoint widening so hidden cross-surface bugs are caught before implementation starts.
- 2026-04-20: added component fix-versus-enhancement requirements, data-shape bias decisions, and component-provenance enforcement so premium UI work can prove it came from real references and scaffold nodes instead of generic AI defaults.
- 2026-04-20: decoupled the premium UI lane into `ui-reference-lane`, `ui-notion-gate`, `figma-scaffold-builder`, `premium-modal-rebuild`, `ui-animator`, and `ui-runtime-review` so references, approvals, scaffold authoring, motion, and browser feel checks stop overlapping.
- 2026-04-20: added `professional-ui-brainstorm`, `admin-design-language`, `figma-workspace-governor`, and `ui-art-direction-review` so premium admin work can lock ambition, shared family grammar, one master Figma workspace, and a hard pre-code art-direction gate.
- 2026-04-20: added purpose-driven reference keyword stacks and sibling-inheritance limits so new premium pages stop over-adapting the nearest existing page instead of using route-specific professional benchmarks.
- 2026-04-20: added adaptation-candidate screening so weak, vibe-coded, or structurally wrong current surfaces become anti-references instead of silent design anchors during premium rebuilds.
- 2026-04-20: added `ui-visual-dna-director` and `figma-concept-explorer` so premium admin work must set a reusable visual DNA and prove real Figma concept divergence before scaffold lock.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only what is needed:
  - `references/integration-map.md`
  - `references/tracker-hierarchy.md`
  - `references/gap-report-template.md`
  - `.playwright-mcp.json`
  - `.playwright-fittrack-flow.json`
  - `tasks/integration-builder/integration-driver/07-playwright-verification.md`
  - `tasks/integration-builder/integration-driver/08-mcp-policy.md`

## Current execution anchors

- `Task Queue` is the canonical live execution board.
- `Surface Verification Tracker` is the runtime evidence and surface-status board.
- `Integration Map and Accomplishments` is the seeded system snapshot and accomplishment log.
- `Refactor Requests` is the long-lived intake for structural follow-up work.

## Adaptive lean orchestration

- The active chat agent is the only orchestrator and shared-state owner.
- Default to one implementation worker. Add a second implementation worker only when the coupling scan proves a disjoint write scope and real parallel value.
- Use this execution rubric:
  - `single-scope`: one worker owns the change
  - `dual-scope`: two bounded workers own disjoint slices
  - `serialized`: shared files or cross-module risk require sequential work
- For user-facing work, run UI-first:
  1. settle the surface shape
  2. re-check coupling
  3. widen backend or shared-client work only if the surface truly requires it
- Never parallelize overlapping write scopes. Serialize them and keep shared files under the orchestrator.

## Premium UI vNext routing

- `integration` is the only implicit orchestrator for the premium UI vNext lane.
- Use this shorthand flow when the run is collaborative and page-first:
  - `request -> notion -> approve -> figma macro -> figma micro -> check -> implement`
- Route ownership for that shorthand is:
  - `ui-notion-gate` = request plus packet plus approval
  - `figma-scaffold-builder` = macro scaffold
  - `component-decorator` = micro component-authorship pass
  - `ui-art-direction-review` = pre-code check
- Route premium UI work in this order:
  1. `professional-ui-brainstorm` when the ask is consultative, vague, or visually weak
  2. `premium-route-rebuild` or `premium-modal-rebuild` for structural diagnosis
  3. `ui-reference-lane` for component-level evidence capture
  4. `ui-visual-dna-director` for design thesis, material language, and visual DNA
  5. `admin-design-language` for shared admin family grammar and canon-ready rules
  6. `ui-notion-gate` for the approval page and machine-readable packet
  7. `figma-workspace-governor` for master-file and page selection
  8. `figma-concept-explorer` for divergent concepts and concept selection
  9. `figma-scaffold-builder` for the implement-ready scaffold
  10. `component-decorator` for component-authorship and control-morphology passes after macro lock
  11. `ui-art-direction-review` for the hard pre-code quality gate
  12. `frontend` for 1:1 implementation
  13. `frontend-uiux-polish` for static quality and copy restraint
  14. `ui-animator` for motion selection, timing, and consistency
  15. `ui-runtime-review` for live browser click-through
  16. `quality-assurance` for final closure
- Treat these new lanes as contained leaf skills by default:
  - `professional-ui-brainstorm`
  - `ui-reference-lane`
  - `ui-visual-dna-director`
  - `admin-design-language`
  - `ui-notion-gate`
  - `figma-workspace-governor`
  - `figma-concept-explorer`
  - `figma-scaffold-builder`
  - `component-decorator`
  - `ui-art-direction-review`
  - `premium-modal-rebuild`
  - `ui-animator`
  - `ui-runtime-review`
- Premium UI work is incomplete if it stops at Exa summaries, weak Figma mood boards, or motion guesswork with no component provenance.
- Exa is discovery-only for the premium UI lane. Browser screenshot capture or equivalent image capture is mandatory before aesthetic references can be treated as proven.
- The same rule applies to the micro lane: `component-decorator` must use screenshot-backed component references, not freestyle decoration.
- If the run cannot produce screenshot-backed browser captures for the aesthetic lane, hard stop the premium aesthetic phase and report the tooling gap instead of continuing with text-led visual assumptions.
- If the macro scaffold is approved but the components still feel generic, do not skip directly to code. Run `component-decorator`, persist the micro packet in Notion, then run `ui-art-direction-review`.

## Coupling scan

- Before spawning any worker, explicitly check:
  - touched routes or screens
  - shared hooks, controllers, helpers, or query shapers
  - `packages/api-client` and `packages/query`
  - DTOs, enums, guards, repositories, and queue paths behind the touched flow
  - companion surfaces that share the same contract
- Record the coupling result before implementation:
  - owned files or modules per worker
  - shared files that stay orchestrator-owned
  - likely regression-adjacent neighbors

## Constraint scan

- Before refactoring shared frontend logic or widening backend seams, run a constraint scan in addition to the coupling scan.
- The constraint scan must check:
  - the touched route or modal and its adjacent states
  - sibling admin surfaces or mobile screens that consume the same helper or contract
  - `packages/api-client`, `packages/query`, shared types, validators, DTOs, and guards behind the flow
  - nearby repositories, services, and enums that could inherit the change unintentionally
- Record:
  - what must remain backward-compatible
  - what can be widened safely
  - what would require coordinated follow-up work
- Default to keeping the backend stable when the UI can close with existing data plus client-side reshaping.
- Only widen endpoints, DTOs, or shared signatures after the constraint scan proves the current seam is insufficient.

## MCP-aware worker packet

- Every non-trivial implementation packet must include:
  - goal
  - owned files or modules
  - allowed skill or skills
  - allowed MCPs by phase
  - constraints and non-goals
  - acceptance criteria
  - stop and report conditions
- Default MCP expectations:
  - `audit`: `Serena` required, `Prisma Local` required when DB-backed, `Exa` allowed for ideation or external product-pattern checks, `Notion` required for page-first work, `Swagger` forbidden, `Playwright` forbidden
  - `resolve`: `Serena` required, `Prisma Local` required for schema, repository, enum, relation, auth-data, or DB-backed invariant work, `postgresReadOnly` allowed when raw DB truth is faster than Prisma-level inspection, `chromeDevtools` allowed for browser runtime diagnosis, `Context7` allowed for library-truth lookups, `Figma` allowed for high-value UI direction, `Magic UI` allowed for motion, hover, and tasteful microinteraction inspiration after the structural direction is chosen, `Swagger` forbidden, `Playwright` forbidden
  - `verify`: `Serena` required, `Prisma Local` preferred for DB-backed verification and required when migration state gates runtime truth, `postgresReadOnly` allowed for raw DB confirmation, `chromeDevtools` allowed for browser runtime, targeted accessibility, or Lighthouse checks, `Swagger` allowed only after direct API checks pass, `Playwright` required for browser-visible flow proof
  - `sync`: `Notion` required for integration-driver state, `Serena.write_memory` required for account-switch or durable handoff requests
- Workers should not redo broad repo discovery if the orchestrator packet already identifies the owning files, MCPs, and constraints.

## Mandatory phase order

### Phase 0: Route rebuild gate

- For flagged high-visibility admin pages, record surfaces, route-wide premium rebuild requests, or pages that have already burned multiple premium patch passes, run `premium-route-rebuild` first.
- For major modals, drawers, and inspectors that act like first-class product surfaces, run `premium-modal-rebuild` first instead of treating them as afterthought polish.
- Treat the route as one coordinated product surface:
  - landing state
  - contained secondary states
  - create or task states
  - important overlays
- Treat major modals as premium surfaces when they own meaningful inspect, edit, confirm, destructive, or secondary-review states. They should use the same scaffold-first lane as full pages.
- The route-rebuild packet must return:
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
  - `Structural reference lane`
  - `Aesthetic reference lane`
  - `Reference captures by component`
  - `Reference targets by component`
  - `Reference keyword stack`
  - `Reference axis map`
  - `Adaptation candidate verdict`
  - `Anti-reference surfaces`
  - `Design thesis`
  - `Emotional keywords`
  - `Signature opportunity`
  - `Visual DNA`
  - `Material language`
  - `Typography posture`
  - `Contrast and lighting model`
  - `Shape and edge policy`
  - `Signature moves`
  - `Family variant rules`
  - `Professional blockers`
  - `Fixes by component`
  - `Enhancements by component`
  - `Design language fit`
  - `Signature elements`
  - `Banned generic patterns`
  - `Sibling inheritance rule`
  - `Interaction scaffold`
  - `Overlay ownership matrix`
  - `Scroll ownership plan`
  - `Breakpoint composition plan`
  - `Motion choreography`
  - `Wireframe frame list`
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
  - `Allowed implementation deviations`
  - `Implementation slices`
  - `QA gates`
  - `Reference lane owner`
  - `Design language owner`
  - `Notion gate owner`
  - `Workspace governor owner`
  - `Scaffold owner`
  - `Art direction owner`
  - `Motion owner`
  - `Runtime review owner`
- Block implementation until the route-wide high-fidelity wireframes exist in Figma.
- Block implementation until the interaction scaffold, overlay ownership matrix, scroll ownership plan, breakpoint composition plan, motion choreography, scaffold node map, and allowed implementation deviations are explicit.
- Block implementation until the `Keep / Replace / Remove / Add` decisions are explicit.
- Block implementation until `ui-art-direction-review` returns a passing `Scaffold-ready verdict`.
- If the current live surface or scaffold is marked `anti_reference`, do not use it as the compositional starting point. Use it only as a problem audit and rejection source.
- Block scaffolding until the Figma phase has produced three divergent concepts and one chosen concept.
- The wireframe gate is mandatory for flagged route rebuilds even when implementation is expected to continue in the same run.
- If the route is replacing or removing high-impact legacy functionality, present the recommendation checkpoint to the user before implementation unless the user already explicitly authorized autonomous replacement.
- When `Needs user decision` is non-empty and Notion is available, create or update a child page under `Q&A God Tier Automation` before implementation proceeds.
- Use this Notion decision format for each unresolved route question:
  - question heading
  - three recommended checkbox options in ranked order
  - one checkbox for `Custom option`
  - one short note explaining the recommended default
- For collaborative premium UI runs, also include one checkbox for `Approved to scaffold and implement this direction`.
- Treat that checkbox as the handoff from route decision-making into scaffold and code.
- For collaborative premium UI runs, default stop points are:
  - after the Notion recommendation page
  - after the Figma phase
  - after the full UI implementation
  - before deeper integration or behavior expansion unless the user explicitly keeps going
- Do not let implementation guess through unresolved high-impact decisions when the user asked for recommendation-first collaboration.

### Phase 0: Ideation lane

- Use this lane only when the request is still fuzzy, product-shaped, or clearly under-scoped.
- When a `premium-route-rebuild` packet already exists, use this lane to refine operator-first additions, route risks, and FitTrack couplings instead of re-auditing the whole page from scratch.
- Run:
  1. `professional-ui-brainstorm` when the surface needs premium UI consultation, stronger ambition, or anti-generic pressure
  2. `brainstorm` for holes, constraints, MVP cuts, and practical option framing
  3. `system-adapt` for FitTrack-native couplings, product coherence, and anti-module-sprawl guidance
- Do not let this lane inflate the implementation scope by default.
- The ideation lane should return:
  - recommended immediate scope
  - deferred ideas
  - system-fit guardrails
  - known risks to avoid during implementation

### Phase 1: Audit

- If a `premium-route-rebuild` packet exists, inherit it as the route-level source of truth and use the premium-gap scan to validate or sharpen the route packet, not to reopen the page as isolated patch targets.
- For flagged high-visibility user-facing pages, screens, dashboards, and major modals, start with a `Premium Gap Scan` before changing code.
- The premium-gap scan must return:
  - `Review verdict`: `good_enough`, `needs_relayout`, `needs_component_replacement`, or `blocked_external`
  - `Current tier`: `broken`, `functional`, `complete`, `elevated`, or `premium`
  - `Target tier`
  - `Figma lane status`: `usable`, `weak`, or `unavailable`
  - `Major component scan`
  - `Missing components`
  - `Missing behaviors`
  - `Weak components`
  - `Alternative render patterns`
  - `Table or list replacement candidates`
  - `Recommended interaction model`
  - `Reference lane`
  - `Reference captures by component`
  - `Reference targets by component`
  - `Interaction scaffold`
  - `Overlay ownership matrix`
  - `Scroll ownership plan`
  - `Breakpoint composition plan`
  - `Motion choreography`
  - `Scaffold node map`
  - `Allowed implementation deviations`
  - `Premium blockers`
  - `Redesign or relayout recommendation`
  - `Component replacements allowed`
  - `Structural revisions`
  - `Flow revisions`
  - `Data to remove`
  - `Data to add`
  - `Copy-density cuts`
  - `Header compression plan`
  - `Responsive plan`
  - `Navigation experience plan`
  - `Data rendering priorities`
  - `Untouched surface risks`
  - `Motion preset alignment`
  - `Visual delta assessment`
  - `Task-view authenticity check`
  - `Motion and delight plan`
  - `MVP-safe implementation order`
- For scaffold-first premium runs, use this audit order before implementation begins:
  1. Serena route and component scan
  2. Browser DevTools live-state scan
  3. feature and state inventory
  4. Figma existing frame and node scan
  5. `ui-reference-lane` evidence capture by component
- The premium-gap scan is recommendation-first. Do not start rewriting the surface until the scan explains why the current composition undershoots the target tier.
- The route-rebuild and premium-gap scans are preservation-hostile by default: weak legacy layout, copy, controls, and functional patterns should not survive just because they already exist.
- Bad current UI is not an adaptation candidate by default. It must earn `adaptation_candidate` status explicitly; otherwise treat it as `family_cue_only` or `anti_reference`.
- If the `Review verdict` is `needs_relayout` or `needs_component_replacement`, the audit phase must choose or recommend the redesign direction before resolve work starts.
- If the `Review verdict` is `blocked_external`, do not fake a premium implementation plan. Downgrade or defer the run explicitly.
- The scan may recommend:
  - replacing or splitting stacked sections
  - converting modal, drawer, rail, or inline flows
  - reducing duplicated metrics or low-value renders
  - compressing oversized section headers, dead top bands, and low-signal shell chrome
  - adding missing context panels, summaries, or action rails
  - changing pacing, hierarchy, or reward moments when the page still feels static or utility-stacked
- The scan must also run a `Missing Component Opportunity Scan` for flagged premium surfaces:
  - what components are missing
  - what behaviors are missing
  - what data render is missing
  - what navigation or drill-in behavior is missing
  - whether the default route mode is still weaker than a newly improved child mode
  - whether the current table, list, filter, or pagination pattern is still the right one
  - whether the current list or table is carrying low-signal columns, repetitive values, oversized row chrome, or mostly-empty data that should be regrouped, muted, or removed
  - whether the surface should become a hybrid card or list, split-pane, preview drawer, tabs or segmented modes, sticky action footer, bulk-action bar, condensed KPI strip, or richer empty or loading state
- For every major component in the premium scan, return both:
  - `Fixes`: changes required to remove blockers, clarify the task, or match the operator job
  - `Enhancements`: restrained upgrades that make the component feel modern and premium after the fixes land
- Treat enhancements as professional UX options, not novelty. Candidate patterns include:
  - view switchers or layout toggles such as table versus card grid, gallery, or kanban when the job benefits
  - stronger member-card anatomy, avatars, status chips, tooltips, row-hover highlight, and hover elevation
  - staggered entrance rhythm, pagination transition, skeleton or shimmer loading, and micro-interaction polish
  - sticky headers, filter chips, debounced search, bulk-action bars, context menus, progressive disclosure
  - slide-over drawers, confirmation dialogs, toasts, breadcrumbs, responsive density toggles, and layout-density variants
  - carousel, horizontal snap, or alternate grouped views only when the operator job clearly improves
- Mark each enhancement as `implement_now`, `optional_if_time`, or `reject_for_this_surface` so the run does not quietly accumulate every trendy pattern at once.
- For premium-target surfaces, scan the major components explicitly before broad page polish:
  - shell or hero
  - top-band density and section-header weight
  - command bar
  - filters
  - tabs or segmented controls
  - table or primary list
  - pagination
  - secondary workflow container
  - modal or drawer patterns
- Use Browser DevTools snapshots, full-page captures, targeted Lighthouse, and optional Figma capture or critique for high-value pages when those help the premium-gap scan stay concrete.
- For premium-target admin pages, require a `reference lane` before implementation starts:
  - Figma capture, critique, or composition reference when available
  - or a clearly named external benchmark direction
- Build the benchmark lane from a `Reference keyword stack`, not from whichever nearby premium route already exists.
- The `Reference keyword stack` must include:
  - domain keywords
  - admin-management keywords
  - page-purpose keywords
  - component keywords
  - quality keywords
  - negative keywords
- Use the page purpose to choose the benchmark family first. Example:
  - members -> record workspace or directory references
  - schedule -> planner, staffing, booking, or operations-calendar references
  - inventory -> stock, procurement, fulfillment, or operations-table references
- Sibling premium pages may contribute family language only after the benchmark family is explicit.
- Do not let a route inherit the composition of another route just because they both live inside the same admin shell.
- Default external benchmark lane for member, user, customer, and record-management admin surfaces:
  - `Attio` first for record pages, supporting-detail hierarchy, actions, tabs, and right-sidebar composition
  - `Linear` second for dense lists, filters, display-property discipline, and preview mechanics
- Default interaction-pattern lane after structure is chosen:
  - `Aceternity UI` first for named, implementable components and interaction patterns
  - `Hover.dev` second for animated React and Tailwind components and sections
  - `Cult UI` third for design-engineer-grade shadcn-compatible components and blocks
- Use the structural reference lane in this order for premium admin surfaces:
  1. existing Figma route or modal frames
  2. official Attio references
  3. official Linear references
  4. Aceternity UI
  5. Hover.dev
  6. Cult UI
  7. Awwwards only after the structural answer is already stable
- Use the aesthetic reference lane in this order for premium admin surfaces when the page still risks looking generic:
  1. Awwwards captures in `UI Design`, `Interaction`, or `Animation`
  2. Cult UI
  3. Hover.dev
  4. Aceternity UI
  5. Magic UI direct MCP for supporting motion and tasteful finish
  6. branded performance-product references only as support
  7. utility SaaS references only as support
- `Awwwards` should be used only as a late inspiration lane:
  - prefer `UI Design`, `Animation`, and `Interaction` categories
  - do not let gallery inspiration outrank more concrete component sources
- Do not use `Magic UI` as part of the Exa benchmark lane. Use the direct Magic UI MCP when that library is the chosen implementation or reference source.
- Generic admin templates and roundup blogs are fallback-only references. They should not be the primary benchmark when official Attio and Linear sources, or the named component sources above, already answer the component problem.
- For route-wide rebuild runs, the Figma lane is not only a critique lane. It must hold the approved route wireframes for the landing state, secondary states, create or task states, and important overlays before implementation starts.
- For scaffold-first premium runs, the approved Figma scaffold becomes the structural source of truth for implementation:
  - preserve section order
  - preserve container proportions
  - preserve command-surface hierarchy
  - preserve row or card anatomy
  - preserve inspector or task-surface placement
  - preserve overlay or modal placement
  - preserve what shows, hides, replaces, or slides during mode changes
  - preserve scroll ownership
  - adapt FitTrack theming and settings without re-composing the layout through a generic shell
- One primary overlay owner is allowed at a time on scaffold-first premium runs. Nested dialog-on-dialog stacks are forbidden unless the approved scaffold explicitly uses a confirm overlay on top of a parent flow.
- Desktop inspectors and sidebars should not become independently scrollable by default. The page owns the scroll unless the scaffold explicitly assigns that ownership elsewhere.
- If the approved scaffold is weak, incomplete, or still missing required states, fail or stop the premium run before code instead of improvising through the gap.
- Use `Magic UI` as a secondary inspiration lane for hover language, transitions, microinteraction patterns, and tasteful effects only after the structural reference lane is chosen. Do not let Magic UI replace Figma, runtime evidence, or the page's information architecture.
- The component-reference lane is mandatory for flagged premium runs. If neither Figma nor a clearly named benchmark lane is available, the run must fail or be explicitly downgraded before implementation.
- `Figma lane status` is `usable` only when the run has a real file, node, library, or non-empty component-search result to work from. If Figma auth exists but the component results are empty or no concrete file or library target exists, mark the lane `weak`, not `usable`.
- If the Figma lane is `weak` or `unavailable`, do not claim Figma-driven reference alignment. Use a named benchmark lane instead and say so explicitly.
- The premium-gap scan must call out where the live page still diverges from that reference lane.
- Use the reference lane at the component level, not just the page-vibe level. Search and compare tables, pagination, filters, tabs, headers, and modal patterns individually when those are the major blockers.
- Record a `Sibling inheritance rule` for premium admin runs:
  - what the nearest sibling page may contribute
  - what it must not dictate structurally
- `Reference captures by component` must include, for each major component:
  - source type plus URL, or Figma file key plus node id
  - the composition or interaction decision being borrowed
  - what must stay scaffold-faithful versus what will be adapted to FitTrack theming or settings
- For premium-target admin pages, the aesthetic lane is `usable` only when it includes:
  - at least two screenshot-backed `high_ceiling` references
  - a named `Aesthetic contact sheet`
  - exact visual-trait extraction rather than source names alone
- Do not accept page-vibe references without component-level provenance. If a proposed component cannot be traced to a real source or scaffold node, mark it as invented and do not treat it as premium-ready.
- The approved scaffold must show the chosen fixes and enhancements as real states, frames, or node-level decisions instead of mentioning them only in prose.
- For flagged premium runs, use MCPs in this order unless a narrow exemption is obvious:
  1. Serena review
  2. Browser DevTools live evidence
  3. Figma or named benchmark lane by component
  4. Exa confirmation of the benchmark lane using official product or docs sources when external references are needed
  5. Magic UI lookup when the page still needs refined motion, hover, or transition language
  6. redesign or relayout decision
  7. Context7 only after the design direction is chosen and implementation details matter
- Start with Serena-backed scans of:
  - backend controllers, DTOs, services, repositories, and shared filters or guards
  - frontend route files, feature hooks, helpers, contexts, and app-core controllers
  - `packages/api-client` and `packages/query`
- When the flow is DB-backed or seed-sensitive, use Prisma Local early instead of guessing from static code alone.
- When the issue is product-shaped or UX-shaped and needs outside pattern checks, use Exa before broad free-form web digging.
- When Exa is used for premium admin benchmarks, prefer official Attio and Linear sources before template galleries or marketing roundup posts.
- After the structural benchmark is clear, use Exa on Aceternity UI, Hover.dev, and Cult UI for concrete interaction patterns before falling back to broad inspiration galleries.
- Reserve Awwwards for widening taste and interaction ambition, not for selecting the first implementable component recipe.
- Produce a structured gap report before changing code.
- Audit page completion and system clarity, not only wiring:
  - `Affordance gaps`
  - `Flow gaps`
  - `Data usability gaps`
  - `Async state gaps`
  - `Contract-to-UI gaps`
  - `Parity gaps`
  - `Confusing UI/UX gaps`
  - `Missing feature gaps`
  - `UI excellence gaps`
  - `Anti-bloat gaps`
- For user-facing pages, the structured gap report must include the premium-gap scan first and then the ordinary gap categories underneath it.
- Require a `Page Completion` subsection in the gap report.
- For premium-target surfaces, require a `Reference alignment` subsection that explains whether the current proposal still feels like a cleaned-up utility surface instead of a deployment-ready premium surface.
- Require a `Component reference alignment` subsection that explains which major components are already premium enough and which still need redesign pressure.
- Require a `Scope honesty` subsection that explains whether the claimed improvement applies to:
  - the default route surface
  - a child mode or task view only
  - both
- For flagged premium runs, require a `Premium Review Packet` subsection that includes:
  - `Review verdict`
  - `Current tier`
  - `Target tier`
  - `Figma lane status`
  - `Major component scan`
  - `Missing components`
  - `Missing behaviors`
  - `Weak components`
  - `Reference lane`
  - `Reference targets by component`
  - `Redesign or relayout recommendation`
  - `Component replacements allowed`
  - `Visual delta assessment`
  - `Task-view authenticity check`
- Classify every active finding as exactly one of:
  - `autofix_now`
  - `blocked_external`
  - `blocked_hard`
  - `product_followup`
- Also classify each finding by failure type:
  - `runtime-ui`
  - `contract-drift`
  - `db-truth`
  - `stack-runtime`
  - `missing-completion`
  - `prod-observed`
  - `anti-bloat`
- Default audit output location: `.artifacts/integration-audits/<timestamp>/`.
- Use `scripts/run-audit.ps1` when you need a seeded report and candidate file list.

### Phase 2: Resolve

- When a `premium-route-rebuild` packet exists, implement the full route from that approved packet instead of isolated patch targets. Do not reopen the route shape unless a real blocker appears.
- When the packet includes an approved scaffold, implement it 1:1 before widening into tasteful deviation or motion.
- Use the adaptive-lean routing rubric before writing code:
  - simple refactor: coordinator plus one worker only
  - normal feature: coordinator, then UI worker first, then optional second worker if a separate backend or shared-client slice is proven
  - high-risk change: normal feature flow plus the relevant review lane such as `security-hardening` or an AI-domain wrapper
- Default to keeping the backend stable only when it already exposes the canonical product truth and the gap is local UI shaping.
- Record a `Data-shape bias decision` before widening a seam or compensating around one:
  - bias to `frontend` when the gap is presentation, grouping, local formatting, density, local sorting of already-loaded data, progressive disclosure, or view-mode changes
  - bias to `backend` when the UI needs canonical labels or statuses, server-backed search or filter or sort, aggregate or joined data, permission-aware actions, or action-complete response fields
  - if a weak backend contract is forcing awkward UI workarounds, the backend compensates; do not bend the UX around underspecified data
- Route work to the owning skill:
  - `professional-ui-brainstorm` when a premium admin page or modal is visually weak, generic, or still needs fix-versus-enhancement consultation before the rebuild locks
  - `brainstorm` when the feature request is still vague and likely to bloat or drift
  - `system-adapt` when a generic feature idea must become a FitTrack-native feature set
  - `admin-design-language` when the reference lane needs to become a shared FitTrack admin grammar instead of one-off inspiration
  - `figma-workspace-governor` before scaffold authoring so premium admin scaffolds land in the master Figma workspace
  - `ui-art-direction-review` after scaffold authoring and before code so clean-but-generic scaffolds fail early
  - `frontend` for reusable UI, hooks, helpers, controllers, query shaping, anti-bloat cleanup, and client architecture
  - `frontend-uiux-polish` for layout, spacing, hierarchy, theme, responsive quality, modal quality, copy restraint, and presentation polish once the flow is logically sound
  - `ui-animator` for premium motion language, component-level animation choices, consistency, and Notion motion-bible writeback once the static surface is already strong
  - `backend` for endpoint, contract, auth, migration, or DB-backed invariant work
  - `security-hardening` for auth, permissions, PII, external integrations, uploads, payments, AI endpoints, or sensitive logging
  - `ai-contract-core` plus exactly one domain wrapper for pose, chatbot, or business-analytics AI work
  - `quality-assurance` only for final verification, not implementation
- Treat obvious page-completion gaps as normal resolve work, not optional polish.
- Treat static-but-functional surfaces as incomplete when they still fail hierarchy, adaptive layout, modal quality, or interaction quality.
- Treat giant multi-responsibility pages as structural failures, not stylistic nitpicks.
- If the premium-gap scan says the current composition itself is the blocker, allow the resolve phase to revise section order, modal usage, side rails, supporting data, and action grouping before micro-polish starts.
- If the `Review verdict` is `needs_relayout` or `needs_component_replacement`, do not preserve the current shell, table, rail, or task-view pattern out of inertia. Pick the stronger redesign direction first, then implement it.
- Do not protect low-value data density or legacy panel count just because the current page already renders it. Removing or relocating noisy information is allowed when it produces a clearer premium surface.
- For flagged premium runs, apply the shared preset before micro-polish:
  - one dominant command surface per page
  - navigation states must be obvious and reversible
  - supporting data must stay secondary to the current job
  - motion timing should stay restrained and consistent: `140-180ms` for micro feedback, `180-240ms` for state switches, and `240-320ms` for drawers, panels, and modals
  - premium surfaces should feel correct at `100%` zoom on common laptop widths: the primary command surface should fit the first viewport cleanly and avoid awkward desktop scroll traps
- If only one child mode or task view was upgraded, do not let the route inherit that premium claim automatically. The default landing mode must earn its own tier.
- For route-wide rebuild runs, default architecture should split by route state:
  - route shell or controller
  - landing command deck
  - primary directory, list, or record surface
  - contained secondary surfaces
  - create or task surface
  - overlay manager for scan, details, confirm, and destructive flows
- Free component replacement is allowed for flagged premium runs when it improves premium quality without harming operator efficiency:
  - table to hybrid card or list or grouped grid
  - side rail to tabs, toggles, lower container, or child surface
  - inline form card to a dedicated task view
  - weak pagination to premium numbered pagination
  - weak CTA placement to sticky footers or action bars
- If a secondary workflow competes with the primary command center, prefer a contained pattern over a permanent side rail:
  - tab or segmented view inside the page
  - toggle between primary and secondary operational surfaces
  - stacked secondary container below the dominant command surface
  - a dedicated child surface when the workflow has enough depth to deserve separation
- Treat verbose helper paragraphs and repeated operational sentences as premium blockers on admin pages unless they are truly necessary for trust or safety.
- Motion polish comes after structure and component alignment. Do not try to animate your way out of weak hierarchy, weak pagination, weak filters, or poor container choices.
- Require a `Motion decision packet` before a premium surface claims a strong animation finish.
- The `Motion decision packet` must include:
  - `Motion intent by component`
  - `Approved motion pattern by component`
  - `Pattern provenance`
  - `Timing and easing`
  - `Trigger and state ownership`
  - `Reduced-motion fallback`
  - `Ambient motion plan`
  - `Rejected motion options`
  - `Consistency notes`
  - `Implementation notes`
- For scaffold-first runs:
  - `frontend` owns scaffold-faithful implementation
  - `frontend-uiux-polish` owns the static quality finish after fidelity is already right
  - `ui-animator` owns the final motion system and Notion motion-bible writeback after fidelity is already right
  - structural drift goes back through Figma before the code layout is re-composed
- `autofix_now` means the surface cannot close until that item is fixed in the same run.
- Keep field transforms close to the client or query layer instead of renaming fields across the entire codebase.
- Close auth gaps on the correct side:
  - missing guard or role protection on backend
  - missing token attachment, refresh, or `401` handling on frontend
- Escalate only when the gap is:
  - ambiguous product behavior
  - structurally large
  - externally blocked
  - cross-domain enough to deserve a durable task

### Phase 3: Verify

- For route-wide rebuild runs, score the route states separately:
  - landing state
  - contained secondary state
  - create or task state
  - important overlays
- For non-trivial bundle closure, follow the `quality-assurance` order:
  1. preflight
  2. lint and typecheck
  3. targeted tests
  4. direct API checks
  5. DB truth checks when the flow is data-sensitive
  6. Swagger confirmation
  7. targeted Browser DevTools checks for browser-visible runtime issues, accessibility, or Lighthouse
  8. Playwright MCP verification
  9. final bug, edge-case, use-case, UI-quality, accessibility, and performance report
- Use `.playwright-mcp.json` and `.playwright-fittrack-flow.json` as the runtime source of truth.
- Require web and mobile verification when the touched feature belongs to both surfaces.
- Require negative paths for role-sensitive behavior.
- When runtime depends on seeded accounts or seeded business data, re-check the current manifest or report before trusting old screenshots or credentials.
- Verify page completion, not only endpoint success:
  - every visible primary action is working, intentionally hidden, or explicitly documented as blocked
  - modal-triggered flows open, close, and submit or cancel cleanly when they exist
  - premium web surfaces must get a live click-through after implementation: activate the primary row or card, change pagination, switch filters or tabs, open and close the main modal or drawer, and trigger one safe confirm path when that flow exists
  - use that click-through to classify modal-stack mistakes, duplicated modal fields, contradictory data labels, weak motion strength, and awkward state transitions before the run can close
  - default that click-through to `ui-runtime-review` before `quality-assurance` unless the surface is too small to justify the extra lane
  - loading, empty, error, and pending states are acceptable for the touched flow
  - obvious sort, filter, label, layout, animation, and responsive mismatches are either fixed or classified
  - important web pages that changed materially should get a targeted Lighthouse or equivalent DevTools check
- For user-facing revision work, verify the premium-gap scan was actually closed:
  - premium blockers are resolved or explicitly deferred
  - the page tier improved honestly
  - the final surface no longer feels utility-stacked, dead, or crowded relative to the stated target
- If the `Target tier` is `premium`, `elevated` is still a miss. The run should close as incomplete, follow-up required, or blocked unless the premium target is explicitly downgraded.
- For flagged premium runs, fail verification if:
  - the Figma lane was claimed as usable without a real file, library, or component-hit result
  - the reference lane was skipped
  - the review verdict said redesign or replacement was needed but the implementation preserved the weak pattern
  - major weak components were not improved
  - missing-component opportunities that materially improved the page were ignored without explanation
  - navigation is still confusing, dead-ended, or locally swapped when a dedicated mode or child surface was required
  - important data is still buried under decorative or low-value renders
  - the page claims route-level premium quality even though only a child mode or secondary state materially changed
  - the default route mode still has oversized headers, dead shell bands, or low-signal list or table design
  - motion was added before the component system was already strong
  - the visual delta is still weak enough that the before and after screenshots read as essentially the same surface
  - a supposed task view still reads like a nested card or embedded form state instead of a first-class task mode
- Verify the sequence stayed honest:
  - review verdict happened first
  - component scan happened first
  - reference lane informed the design
  - redesign or relayout was chosen before implementation
  - FitTrack alignment happened before implementation
  - motion came after the layout and component quality were already strong
  - visual delta and task-view authenticity were checked before calling the page premium
- Do not mark the integration complete if auth or security handling still fails.
- Do not mark the integration complete while `autofix_now` page-completion findings remain open.
- Use `scripts/run-playwright-checks.ps1` to stage runtime preflight and artifact folders.

## Notion workflow

- Long-lived integration memory lives in Notion, not in a repo-root integration map.
- The starting parent page is `System Gap Analysis`.
- Read these pages when doing real integration work:
  - `Task Queue`
  - `Surface Verification Tracker`
  - `Integration Map and Accomplishments`
  - `Refactor Requests`
  - relevant `Domain - *` pages
  - `God Tier Multi Agentic Pipeline` when the request touches the staged automation system
- For recommendation-first route rebuilds, use `Q&A God Tier Automation` as the parent page for implementation-blocking design decisions.
- Use `FitTrack UI Motion Bible` as the durable motion-consistency page for premium UI work. `ui-animator` should update it and append a compact `Motion Decision Packet` to the current route or modal review page.
- Use `FitTrack Admin UI Canon` as the durable admin-family design-language page for premium admin UI work. `admin-design-language` should supply the canon packet and `ui-notion-gate` should update it.
- Under `Q&A God Tier Automation`, the default child-page format is:
  - one page per route or rebuild pass
  - each decision written as a question
  - three recommended checkbox options
  - one checkbox for `Custom option`
  - one short recommendation note and why it is the default
- For scaffold-first premium UI runs, also include:
  - page or modal purpose
  - premium blockers from live scan
  - reference keyword stack
  - reference lane by component
  - sibling inheritance rule
  - `Keep / Replace / Remove / Add` checkpoint
  - professional blockers
  - fixes by component
  - enhancements by component
  - design language fit
  - signature elements
  - banned generic patterns
  - interaction scaffold summary
  - overlay ownership matrix
  - scroll ownership plan
  - breakpoint composition plan
  - recommended motion direction
  - workspace target file
  - target page
  - art direction verdict
  - scaffold-ready verdict
  - scaffold target frame or node list when known
  - one checkbox for `Approved to scaffold and implement this direction`
- No code implementation starts while that checkbox is unchecked on collaborative runs.

## Output defaults

- Write audit artifacts under `.artifacts/integration-audits/<timestamp>/`.
- Keep the repo copy of `references/integration-map.md` as a seeded baseline snapshot.
- Treat Notion as the evolving source for cross-run integration memory.
- Do not close a bundle on reachability alone. The visible flow must feel complete enough to survive a real user path.
- Keep worker packets compact and decision-complete so bounded workers can execute without broad repo rescans or guesswork.
- If a page is functional but still static, crowded, confusing, dead-feeling, or structurally bloated, it is not complete.
- If a premium-target admin page still reads like a cleaned-up internal tool instead of a polished command center, it is not ready to ship.
- If a premium-target task flow still looks like a nested card or local form patch instead of a first-class task view, it is not ready to ship.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
