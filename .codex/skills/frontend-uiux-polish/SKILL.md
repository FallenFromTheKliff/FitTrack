---
name: frontend-uiux-polish
description: "Use for FitTrack frontend visual polish when the main need is layout, spacing, hierarchy, adaptive layout, modal quality, copy restraint, and surface consistency that must preserve the app's distinctive style and reusable surfaces. Use after the orchestrator or owning worker has already clarified contract ownership, and use it first for UI-major revisions before broader frontend integration work."
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
- 2026-04-20: added stricter scaffold-first premium rules for overlay ownership, scroll ownership, stronger motion visibility, and component-level recipes so high-visibility pages and major modals close with more professional UI/UX in one pass.
- 2026-04-20: added explicit fix-versus-enhancement outputs, a modern UX enhancement bank, and anti-generic provenance rules so premium surfaces can prove they came from real references and scaffold decisions.
- 2026-04-20: narrowed the skill so premium motion-system design, component-level animation choice, and Notion motion-bible maintenance now hand off to `ui-animator`.
- 2026-04-20: added stronger static-quality failure rules for annotation leakage, clean-but-generic composition, and admin-family drift so conservative premium work gets rejected before QA.
- 2026-05-17: added `layout-wireframe-gate` and `component-decorator` handoffs for manual relayout approval and post-scaffold component anatomy work.

## First pass

- Use Serena before broad repo scans.
- Confirm whether the issue is presentation-only or whether it also needs `frontend`, `backend`, or `integration` work.
- Read only what is needed:
  - `references/polish-rubric.md`
  - the repo `frontend` skill when reuse architecture or runtime rules matter
  - the nearest touched route, component, or style helper

## Scope boundaries

- Own layout, spacing, hierarchy, theme discipline, modal quality, adaptive layout, readability, and surface consistency.
- Own recommendation-grade flow-shape guidance when a premium result requires different section order, modal versus drawer versus inline treatment, lighter rails, or lower data density.
- Improve the presentation of existing reusable surfaces before inventing new ones.
- Do not own the premium motion system once the surface is structurally sound. Hand final animation selection, ambient-motion decisions, and motion-bible consistency work to `ui-animator`.
- Do not own query wiring, auth semantics, migrations, endpoint design, or cross-surface contract repair.
- If the issue is primarily reusable architecture, hook extraction, helper cleanup, or client data flow, hand it to `frontend`.
- If the issue is an integration or backend gap, hand it to `integration` or `backend`.

## UI-first handoff defaults

- When the touched work is user-facing and the surface shape is still unstable, go first and settle the interaction hierarchy before a broader `frontend` or `backend` pass begins.
- If the polish pass reveals that a control is dead, a state is missing, or a shared helper must change, stop at the nearest boundary and hand the implementation follow-up to `frontend` or `integration`.
- Keep controller, query, and contract ownership stable unless the orchestrator explicitly widened the task.
- If the static surface is strong but the motion still feels weak, inconsistent, generic, or absent, stop and hand the motion lane to `ui-animator` instead of inventing a one-off animation system here.

## Premium gap handoff

- When a `premium-route-rebuild` packet exists, treat the approved route-wide Figma wireframes as the structural source of truth.
- When the user asks for manual layout review or the relayout is subjective, route the structure through `layout-wireframe-gate` before implementing code. That gate may return a compact layout delta packet or screenshot/ASCII direction instead of static HTML when that is enough to make the decision clear.
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
- If the macro layout is approved but cards, tables, filters, pagination, modals, or controls still feel generic, hand the run to `component-decorator` before motion polish.
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
- For each major component, output both:
  - `Fixes`: what must change so the component stops being weak, noisy, confusing, or low-signal
  - `Enhancements`: what restrained, modern UX upgrades could make the same component feel polished and professional after the fixes land
- Enhancements must stay practical and may include:
  - view switchers or layout toggles between table, card grid, gallery, or grouped status views
  - richer member-card anatomy with avatar, secondary metadata, status chip, and stronger row-hover response
  - staggered entrance rhythm, cascade motion, pagination transitions, skeleton loaders, or shimmer placeholders
  - sticky headers, filter chips, debounced search, bulk-action bars, context menus, progressive disclosure, or density toggles
  - slide-over drawers, confirmation dialogs, toast feedback, responsive breakpoint variants, tooltips, breadcrumbs, and polished button hierarchies
  - carousel, horizontal snap, or kanban variants only when the operator job clearly benefits
- Every enhancement suggestion must be labeled `implement_now`, `optional_if_time`, or `reject_for_this_surface` so the skill stays deliberate instead of trend-stacking.
- Run this order for premium-target pages:
  0. approved route wireframe exists when the run is a route-wide rebuild
  1. review
  2. major component scan
  3. reference search by component
  4. FitTrack alignment
  5. redesign or relayout decision
  6. structural and compositional revision
  7. validation check
  8. motion handoff to `ui-animator` when the surface still needs premium animation language
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
- Major modals, drawers, and inspectors are not exempt. If they materially shape the UX, they need their own approved scaffold instead of code-first improvisation.
- Stop and hand the run back when the scaffold is missing the selected, inspect, create, edit, confirm, destructive, empty, loading, or error states the live surface actually needs.
- Keep one primary overlay owner at a time. Do not polish a double-modal or stacked-panel implementation into looking acceptable.
- Do not start motion polish until the scaffold fidelity check passes.
- Do not select or benchmark the final motion system here once the scaffold fidelity check passes. Hand that responsibility to `ui-animator`.

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
- Do not leak board-note language into product UI. Labels such as `Week grid`, `Interaction guardrail`, `Packet note`, or other critique-board phrasing belong in Figma board areas, not in the shipped surface.
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
- Premium admin pages should feel correctly scaled at `100%` zoom on common laptop widths. The primary command surface should fit the first viewport cleanly without accidental desktop scroll traps.
- Desktop inspectors and sidebars should not become independent scroll wells unless the approved scaffold explicitly assigns that behavior.

## Premium component recipes

- Command bars: keep one dominant action cluster, concise filters, short titles, and obvious mode switching. Avoid top bands that spend height without speeding up the main job.
- Dense people rows or cards: combine identity, one secondary line, one or two high-signal status cues, and clear row activation. Remove repetitive badges or columns that say the same thing twice.
- Record inspectors: start with identity and next action, then status and relationship summary, then supporting history. Keep section order calm, compact, and predictable.
- Modals: use a clear title block, a compact body, and one decisive primary action. Large edit or review flows should become first-class task surfaces or drawers before they become giant stacked dialogs.
- Pagination: prefer obvious numbered pagination or a restrained load-more pattern with strong selected-state and transition feedback. Weak tiny pagination is a premium blocker on dense admin lists.
- Empty states: keep tone human, short, and action-oriented. Show the next useful step, not a paragraph apologizing for the absence of data.
- Motion ideas come after these recipes are structurally right, not before.

## Enhancement bank

- Use this bank when the component scan asks for credible enhancement ideas after the fixes are clear.
- Good enhancement candidates:
  - `View switcher / layout toggle`: table view, card grid, gallery, kanban, or grouped-status variants
  - `Member card anatomy`: avatar, name, email, phone, status badge, and one supporting line
  - `Entrance motion`: staggered or cascade list entrance that stays restrained
  - `Hover language`: row highlight, card lift, elevation, and active-state contrast
  - `Loading state`: skeleton or shimmer placeholders that match the final density
  - `Disclosure`: show-more patterns, inline expansion, or click-to-inspect progressive disclosure
  - `Navigation`: sidebar collapse, rail behavior, breadcrumbs, sticky headers, and clear active states
  - `Action systems`: bulk action bars, context menus, confirmation dialogs, toasts, and icon hierarchy cleanup
  - `Search and filters`: debounced search, active-filter chips, density toggles, and responsive filter layouts
  - `Responsive variants`: mobile, tablet, and desktop layout variants that recompose instead of merely shrinking
- Reject enhancements that exist only to look fancy. If the operator job does not get clearer, faster, or calmer, leave the pattern out.

## Motion handoff expectations

- Use this preset for flagged premium surfaces unless the page has a strong reason to diverge:
  - `Micro motion`: `140-180ms`, ease-out, for hover, press, focus, opacity, and tiny elevation changes
  - `State-switch motion`: `180-240ms`, smooth ease, for tabs, segmented controls, filters, and content-mode swaps
  - `Panel motion`: `240-320ms`, smooth ease, for drawers, modals, sticky footers, and larger container reveals
- Keep motion consistent and restrained. It should make the surface feel alive, not busy, and it should be visible enough to materially improve the feel of a previously dead page.
- Navigation experience rules:
  - one dominant command surface per page
  - dedicated task views should replace the main content area, not appear as local nested cards
  - every alternate mode needs an obvious back path or state reversal
  - secondary workflows should become tabs, segmented states, lower containers, or child surfaces before they become permanent competing rails
  - one primary overlay owner at a time unless the approved scaffold explicitly layers a confirm flow
- Data-rendering rules:
  - promote the most actionable dataset or task first
  - keep supporting stats concise and secondary
  - remove decorative or repetitive counts that restate what the main surface already tells the operator
  - compress or remove low-signal columns and repetitive row badges when they make the table feel heavier than the information deserves
  - prefer clearer grouping, status emphasis, and scanability over raw data density
- Use `Magic UI` only as a supporting reference for `ui-animator` once the structural answer is already strong. Do not let it dictate page architecture, information hierarchy, or novelty-heavy effects.

## Motion handoff signals

- Use this section to tell `ui-animator` what the surface still needs. Do not treat it as permission to invent the final motion system inside this skill.
- Base motion:
  - hover, press, focus, opacity, scale, and elevation feedback
- Structural motion:
  - modal open or close, section reveals, filter drawers, tab emphasis, and step transitions
- Reward motion:
  - achievement reveals, streak continuation, XP gain, milestone completion, and major confirmation moments
- Keep celebration effects rare and earned. A milestone burst is good; constant sparkle spam is not.
- Use motion to clarify state and hierarchy, not to hide a weak layout.
- Premium-target admin pages should have motion that is noticeable enough to feel intentional:
  - row hover and selected-state response
  - visible segmented-control, tab, or filter transitions
  - restrained list entrance rhythm on first render
  - restrained pagination transition
  - panel or modal reveal with clean easing
  but never so loud that it turns the page into a novelty demo.
- After implementation, run a human-eye click-through in Browser DevTools on the polished surface:
  - click the primary row or card activation path
  - change one pagination state
  - switch the main filter, tab, or segmented control
  - open and close the main modal, drawer, or inspector-owned task flow
  - trigger one safe confirmation path when the surface owns one
- If the click-through reveals duplicated modal fields, contradictory copy, awkward overlay ownership, or motion that is technically present but still too soft to change the feel, the polish pass is not complete.
- Do not start here. Motion is the finisher after table quality, pagination quality, filter quality, and container composition are already right.
- When the surface reaches that point, hand the final motion decision to `ui-animator` together with:
  - components that still feel dead
  - the desired intensity band
  - animation constraints or novelty risks
  - the current scaffold and reference lane

## UI excellence checklist

- The page has a clear visual starting point.
- Primary action priority is obvious.
- Important data is grouped and chunked well.
- Copy density is restrained; labels beat paragraphs.
- Labels read like product language, not internal tooling language.
- The surface does not read like a polished wireframe or board export.
- Loading, empty, error, retry, and success states feel intentional.
- Modals and dialogs feel contained, readable, and trustworthy.
- The surface has believable interaction feedback instead of feeling static.
- The page still feels coherent at the widths people will actually use.
- Scroll ownership is obvious and free of accidental desktop trap panels.
- Major modals and inspectors feel like first-class product surfaces, not stacked cards.
- Reward moments feel satisfying without becoming noisy.
- The result feels like FitTrack, not a random template drop.
- The result does not feel clean-but-generic or safe-but-bland relative to the approved reference lane.

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
- Every component recommendation on a premium run must point to real provenance:
  - an approved Figma node or frame
  - or a named benchmark source such as Attio, Linear, Aceternity UI, Hover.dev, Cult UI, or Awwwards
- `Reference captures by component` should say what the source contributed: layout, interaction, motion, density, disclosure, or hierarchy.
- If a component suggestion cannot be traced to real provenance, mark it as invented and do not present it as premium-ready.
- Do not ship generic AI-default card piles, rails, or dashboards just because they look superficially clean. If the proposal does not clearly reflect the chosen references and scaffold, stop and re-run the reference lane before implementation.
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
  - `Professional feel verdict`
  - `Annotation leakage verdict`
  - `Admin-family consistency verdict`
- Separate structural issues from micro-polish issues.
- If the polish work begins mutating behavior, contract assumptions, or shared data flow, stop and hand the next step to the owning skill.
- If the page still feels static, cramped, or dead after the pass, say so explicitly instead of calling it done.
- If the target tier is `premium`, do not sign off at `elevated`.
- If the target tier is `premium`, do not sign off when the visual delta is weak or the primary task view still reads as a nested card.
- For scaffold-first runs, also return:
  - `Scaffold fidelity verdict`
  - `Zoom-scale verdict`
  - `Overlay ownership verdict`
  - `Scroll ownership verdict`
