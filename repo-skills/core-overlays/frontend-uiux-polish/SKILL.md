---
name: frontend-uiux-polish
description: "Use for FitTrack frontend visual polish when the main need is layout, spacing, hierarchy, adaptive layout, modal quality, motion, and surface consistency that must preserve the app's distinctive style and reusable surfaces. Use after the orchestrator or owning worker has already clarified contract ownership, and use it first for UI-major revisions before broader frontend integration work."
---

# FitTrack Frontend UI UX Polish

Use this skill when the main need is presentation polish after the flow, ownership, and contract boundaries are understood.

## Changelog

- 2026-04-17: added adaptive-layout standards, motion and delight guidance, UI excellence enforcement, and selective Figma support for high-value surfaces.
- 2026-04-17: added premium-gap handoff rules so polish work starts with diagnosis, target tier, and blocker-driven surface recommendations.
- 2026-04-18: added premium admin-surface rules for lower copy density, stronger composition restraint, contained secondary workflows, and visible but appropriate motion.
- 2026-04-18: added component-level reference workflow and explicit motion-last sequencing for premium surfaces.
- 2026-04-18: upgraded premium-target work to Premium UI Enforcement v2 with review verdicts, missing-component opportunity scans, redesign-or-replace decisions, and required component-reference lanes on flagged high-visibility surfaces.
- 2026-04-18: added Figma-lane viability rules, visual-delta checks, and task-view authenticity checks so premium UI work cannot self-grade from a weak reference lane.
- 2026-04-18: added a shared premium preset for motion timing, navigation experience, data-rendering discipline, and Magic UI-assisted microinteraction guidance on flagged premium surfaces.
- 2026-04-18: added route-vs-mode honesty, header-compression rules, and list-signal checks so untouched default surfaces cannot ride along on a polished child mode.
- 2026-04-18: added the route-wide premium rebuild gate so flagged admin pages must pass through a full-route Figma wireframe before polish work claims premium closure.
- 2026-04-19: added explicit keep-replace-remove-add guidance so weak legacy copy, layout, labels, and controls are not preserved out of habit.
- 2026-04-19: added Attio-first and Linear-second benchmark defaults so record-centric admin surfaces stop drifting toward generic dashboard references.
- 2026-04-19: added scaffold-fidelity enforcement so premium UI runs compare the live surface to the approved scaffold before motion polish.

## First pass

- Use Serena before broad repo scans.
- Confirm whether the issue is presentation-only or whether it also needs `frontend`, `backend`, or `integration` work.
- Read only what is needed:
  - `references/polish-rubric.md`
  - the repo `frontend` skill when reuse architecture or runtime rules matter
  - the nearest touched route, component, or style helper

## Scope boundaries

- Own layout, spacing, hierarchy, theme discipline, modal quality, adaptive layout, motion quality, readability, and surface consistency.
- Own recommendation-grade flow-shape guidance when a premium result requires different section order, modal versus drawer versus inline treatment, lighter rails, or lower data density.
- Improve the presentation of existing reusable surfaces before inventing new ones.
- Do not own query wiring, auth semantics, migrations, endpoint design, or cross-surface contract repair.
- If the issue is primarily reusable architecture, hook extraction, helper cleanup, or client data flow, hand it to `frontend`.
- If the issue is an integration or backend gap, hand it to `integration` or `backend`.

## UI-first handoff defaults

- When the touched work is user-facing and the surface shape is still unstable, go first and settle the interaction hierarchy before a broader `frontend` or `backend` pass begins.
- If the polish pass reveals that a control is dead, a state is missing, or a shared helper must change, stop at the nearest boundary and hand the implementation follow-up to `frontend` or `integration`.
- Keep controller, query, and contract ownership stable unless the orchestrator explicitly widened the task.

## Premium gap handoff

- When a `premium-route-rebuild` packet exists, treat the approved route-wide Figma wireframes as the structural source of truth.
- Do not reopen the page as isolated component tweaks when the route packet already locked:
  - landing state
  - secondary states
  - create or task states
  - important overlays
- If the route wireframes do not exist yet, stop and hand the run back to `integration` or the route-rebuild lane instead of improvising premium structure from prose alone.
- Confirm the `Keep / Replace / Remove / Add` decisions before polishing so the pass does not quietly preserve weak legacy structure.
- If an approved scaffold exists, treat it as the exact composition source of truth. Do not keep only its tokens while rebuilding the page through a generic shell.

- When the orchestrator routes a page through a premium-gap scan, treat that scan as the source of truth for why the current surface still undershoots the target tier.
- If the approved route packet still has unresolved `Needs user decision` items, stop at recommendation quality. Do not quietly freeze those decisions in polish code.
- Start by confirming:
  - `Review verdict`
  - `Current tier`
  - `Target tier`
  - `Figma lane status`
  - `Major component scan`
  - `Missing components`
  - `Missing behaviors`
  - `Weak components`
  - `Premium blockers`
  - `Redesign or relayout recommendation`
  - `Structural revisions`
  - `Motion and delight plan`
- For premium-target admin pages, also confirm:
  - `Reference lane`
  - `Benchmark lane default`
  - `Reference targets by component`
  - `Alternative render patterns`
  - `Table or list replacement candidates`
  - `Recommended interaction model`
  - `Copy-density cuts`
  - `Component replacements allowed`
  - `Secondary workflow containment plan`
- Also confirm:
  - `Header compression plan`
  - `Navigation experience plan`
  - `Data rendering priorities`
  - `Untouched surface risks`
  - `Motion preset alignment`
  - `Visual delta assessment`
  - `Task-view authenticity check`
- If the `Review verdict` is `needs_relayout` or `needs_component_replacement`, do not settle for surface polish. Choose the stronger replacement or relayout direction before implementation details start.
- If the unresolved decision is high-impact, expect `integration` to surface it in `Q&A God Tier Automation` before this skill continues with implementation-facing polish.
- It is acceptable to recommend:
  - removing or replacing weak functionality patterns when the operator experience improves
  - removing duplicated metrics or noisy helper copy
  - adding context cards, summary rails, or stronger hero framing
  - changing section order and visual pacing
  - converting modal-heavy flows into drawers, inline reveals, or lighter supporting rails
- For flagged premium pages, also run a `Missing Component Opportunity Scan`:
  - what components are missing
  - what behaviors are missing
  - whether the default route mode is still weaker than an improved child mode or task view
  - whether the current table, list, filter, pagination, task-view, or CTA pattern is still the right one
  - whether the current table or list is carrying low-signal columns, repetitive values, empty states masquerading as columns, or oversized row chrome
  - whether a hybrid list, grouped grid, split-pane, preview drawer, segmented mode, sticky action footer, or richer state surface is the stronger answer
- Run this order for premium-target pages:
  0. approved route wireframe exists when the run is a route-wide rebuild
  1. review
  2. major component scan
  3. reference search by component
  4. FitTrack alignment
  5. redesign or relayout decision
  6. structural and compositional revision
  7. validation check
  8. motion and animation polish
- During validation, compare the current proposal against the before state directly. If the visual delta is still subtle enough that the page mostly reads the same, do not call the result premium.
- For task modes and create flows, explicitly ask whether the current proposal still reads like a nested card or embedded form state. If yes, redesign again before micro-polish.
- If the polished work mostly affects a child mode or task view, compare the unchanged default route state separately. Do not let the page claim route-level premium if the landing state is still elevated.
- For pages that mix a primary command surface with a secondary review or moderation workflow, prefer:
  - tabbed or segmented containers
  - toggleable sub-surfaces
  - a stacked secondary container below the dominant surface
  - a child page or drill-in surface
  instead of a permanent side rail when the side rail still competes visually with the main job.
- Do not rewrite contracts or query ownership here. If the premium answer requires real behavior changes, stop at the nearest boundary and hand the next step to `frontend` or `integration`.
- For route-wide rebuilds, polish should cover the entire route family:
  - landing state
  - secondary states
  - create or task states
  - important overlays
  and keep them visually coherent under one route grammar.

## Scaffold fidelity mode

- Use this mode when a premium run already has an approved Figma scaffold.
- Compare the live result against the scaffold at the composition level:
  - section order
  - container proportions
  - command-surface hierarchy
  - list or table density
  - inspector or task-view placement
  - visible scroll ownership
- Desktop sidebars and inspectors should not be independently scrollable by default. The page should own the scroll unless the design has a strong reason not to.
- Do not start motion polish until the scaffold fidelity check passes.

## Major revision mode

- Start with scan path, section rhythm, action hierarchy, adaptive layout, and modal quality before micro-polish.
- Preserve the page intent and the existing action model unless the orchestrator changed the product flow.
- Upgrade reusable surfaces in place when possible instead of introducing parallel variants during churn-heavy revisions.
- Treat "looks polished but still confusing" as unfinished work.

## Visual system rule

- Preserve the app's special styles. Polish should make the surface feel more intentional, not more generic.
- Prefer the current FitTrack visual language over importing a new design-system feel.
- Preserve identity, not old composition. Theme, tokens, and typography voice may stay while weak layout, copy, and controls are replaced freely.
- Tighten hierarchy and surface rhythm before reaching for more colors, borders, or effects.
- Prefer user-facing product language over internal admin jargon when the clearer label is obvious.
- For people, account, and approval surfaces, default toward labels such as `People directory`, `Member profile`, `Approvals`, `Add account`, and `Profile panel` unless the product already has a better domain-specific term.
- Avoid defaulting to colder terms such as `live roster`, `proof moderation`, `selected member`, `task view`, or other system-flavored labels when a more human, professional label would improve trust and clarity.
- For premium admin pages, prefer concise labels and short support copy. If a sentence does not increase trust, clarity, or action speed, cut it.
- The premium bar is closer to Stitch-style restraint than to dashboard maximalism.
- The external benchmark for record-centric admin surfaces should be closer to Attio-grade record composition and Linear-grade list discipline than to generic template dashboards.
- Premium admin surfaces should feel correct at `100%` browser zoom on common laptop widths. If the shell is oversized before the main job starts, compress the shell before adding polish.
- Fonts can be overridden selectively when the change clearly improves authority, readability, and FitTrack coherence, but typography changes should be deliberate, not novelty-driven.
- Oversized all-caps section headers, dead shell bands, and top rows that consume space without adding action value are premium blockers on admin pages.

## Adaptive layout rule

- Design for narrow mobile, normal desktop, and wide admin widths when the surface supports them.
- Reflow intentionally. Do not just shrink cards until they technically fit.
- Tables, filters, analytics cards, forms, and side panels should have clear collapse or wrap behavior.
- Modals should stay readable, scannable, and safely closable across likely viewport widths.

## Shared premium preset

- Use this preset for flagged premium surfaces unless the page has a strong reason to diverge:
  - `Micro motion`: `120-160ms`, ease-out, for hover, press, focus, opacity, and tiny elevation changes
  - `State-switch motion`: `180-220ms`, smooth ease, for tabs, segmented controls, filters, and content-mode swaps
  - `Panel motion`: `220-280ms`, smooth ease, for drawers, modals, sticky footers, and larger container reveals
- Keep motion consistent and restrained. It should make the surface feel alive, not busy.
- Navigation experience rules:
  - one dominant command surface per page
  - dedicated task views should replace the main content area, not appear as local nested cards
  - every alternate mode needs an obvious back path or state reversal
  - secondary workflows should become tabs, segmented states, lower containers, or child surfaces before they become permanent competing rails
- Data-rendering rules:
  - promote the most actionable dataset or task first
  - keep supporting stats concise and secondary
  - remove decorative or repetitive counts that restate what the main surface already tells the operator
  - compress or remove low-signal columns and repetitive row badges when they make the table feel heavier than the information deserves
  - prefer clearer grouping, status emphasis, and scanability over raw data density
- Use `Magic UI` for microinteraction patterns and tasteful motion ideas when the structural answer is already strong. Do not let it dictate page architecture, information hierarchy, or novelty-heavy effects.

## Motion and delight ladder

- Base motion:
  - hover, press, focus, opacity, scale, and elevation feedback
- Structural motion:
  - modal open or close, section reveals, filter drawers, tab emphasis, and step transitions
- Reward motion:
  - achievement reveals, streak continuation, XP gain, milestone completion, and major confirmation moments
- Keep celebration effects rare and earned. A milestone burst is good; constant sparkle spam is not.
- Use motion to clarify state and hierarchy, not to hide a weak layout.
- Premium-target admin pages should have motion that is noticeable enough to feel intentional:
  - card hover or press response
  - segmented-control or tab transitions
  - panel reveal or drawer easing
  - restrained section entrance rhythm
  but never so loud that it turns the page into a novelty demo.
- Do not start here. Motion is the finisher after table quality, pagination quality, filter quality, and container composition are already right.

## UI excellence checklist

- The page has a clear visual starting point.
- Primary action priority is obvious.
- Important data is grouped and chunked well.
- Copy density is restrained; labels beat paragraphs.
- Labels read like product language, not internal tooling language.
- Loading, empty, error, retry, and success states feel intentional.
- Modals and dialogs feel contained, readable, and trustworthy.
- The surface has believable interaction feedback instead of feeling static.
- The page still feels coherent at the widths people will actually use.
- Reward moments feel satisfying without becoming noisy.
- The result feels like FitTrack, not a random template drop.

## MCP expectations

- Serena is required for local pattern discovery.
- `Figma` is allowed when a high-value surface needs stronger design direction or a design-to-code reference.
- For premium-target surfaces, Figma or an explicitly named design-reference lane should be used whenever the surface still risks drifting into generic utility UI.
- For route-wide rebuilds, Figma is mandatory and should already contain the approved route frames before implementation polish begins.
- Use Figma to search or compare component patterns, not just page-level mood boards. The most valuable targets are usually table systems, pagination, filters, segmented controls, command bars, and modal or drawer patterns.
- `Exa` is allowed and should be used to validate the external benchmark lane before broad web searching.
- Default benchmark lane for record-centric admin surfaces:
  - `Attio` first for record pages, supporting-detail hierarchy, actions, tabs, and right-sidebar composition
  - `Linear` second for dense lists, filters, display-property discipline, and preview behavior
- For implementable interaction and micro-surface patterns after the structural benchmark is chosen:
  - `Aceternity UI` first for named, implementable interaction components and motion-backed UI patterns
  - `Hover.dev` second for animated UI sections, cards, navbars, tables, and other interaction-heavy React patterns
  - `Cult UI` third for design-engineer-style components and polished shadcn-compatible blocks
- `Awwwards` is inspiration-only here:
  - use `UI Design`, `Animation`, and `Interaction` categories for visual ambition and interaction references
  - do not treat Awwwards as the primary implementation source when component libraries already answer the pattern
- Do not use `Magic UI` as part of the Exa benchmark lane. If Magic UI is relevant, use the direct MCP instead of searching for it through Exa.
- Generic admin template blogs and dashboard kit roundups are fallback-only references. They should not outrank official Attio or Linear sources, or the named component sources above, when those already fit the component problem.
- `Magic UI` is allowed when motion language, hover states, or transition patterns need stronger reference material after layout and component structure are already correct.
- When Figma is unavailable or weak, name the replacement benchmark lane explicitly and keep it component-level, not vibe-level.
- Do not mark Figma as a strong lane just because auth works. It is only strong when a concrete file, library, or non-empty component result exists for the target components.
- Broad shell reads are a fallback, not the first move.
- Playwright is allowed only when the orchestrator explicitly requests runtime verification after logic and ownership are already sound.

## Output defaults

- Return a narrowed surface summary and the concrete visual issues addressed.
- For premium-gap work, return:
  - `Review verdict`
  - `Current tier`
  - `Target tier`
  - `Figma lane status`
  - `Reference lane`
  - `Major component scan`
  - `Missing components`
  - `Missing behaviors`
  - `Weak components`
  - `Reference targets by component`
  - `Alternative render patterns`
  - `Table or list replacement candidates`
  - `Recommended interaction model`
  - `Premium blockers`
  - `Redesign or relayout recommendation`
  - `Structural revisions`
  - `Micro-polish revisions`
  - `Copy-density cuts`
  - `Header compression plan`
  - `Component replacements allowed`
  - `Secondary workflow containment plan`
  - `Navigation experience plan`
  - `Data rendering priorities`
  - `Untouched surface risks`
  - `Motion preset alignment`
  - `Visual delta assessment`
  - `Task-view authenticity check`
  - `Motion and delight recommendations`
- Separate structural issues from micro-polish issues.
- If the polish work begins mutating behavior, contract assumptions, or shared data flow, stop and hand the next step to the owning skill.
- If the page still feels static, cramped, or dead after the pass, say so explicitly instead of calling it done.
- If the target tier is `premium`, do not sign off at `elevated`.
- If the target tier is `premium`, do not sign off when the visual delta is weak or the primary task view still reads as a nested card.
- For scaffold-first runs, also return:
  - `Scaffold fidelity verdict`
  - `Zoom-scale verdict`
