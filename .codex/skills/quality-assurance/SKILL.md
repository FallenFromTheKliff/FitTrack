---
name: quality-assurance
description: "Use for final FitTrack verification when the main need is bug sweeps, edge-case and use-case tests, repo-native lint and typecheck, targeted tests, direct API checks, Swagger confirmation, Browser DevTools, and Playwright MCP evidence. Use after implementation work is complete, and keep verification ordered, risk-aware, and honest rather than broad by default."
---

# FitTrack Quality Assurance

Use this skill for the final verification pass on a touched FitTrack surface, feature, or backend contract.

## Changelog

- 2026-04-17: added Browser DevTools, PostgreSQL-backed truth checks, targeted accessibility and Lighthouse guidance, and explicit UI excellence and anti-bloat closure bars.
- 2026-04-17: added premium-gap closure rules so user-facing revisions must prove tier improvement and blocker resolution before QA signs off.
- 2026-04-18: added premium-target closure rules so deployment-ready admin pages cannot close as merely elevated and must prove reference-lane alignment.
- 2026-04-18: added component-reference and motion-last verification for premium UI work.
- 2026-04-18: upgraded premium verification to Premium UI Enforcement v2 with review-verdict follow-through, missing-component closure checks, and redesign-or-replace honesty for flagged high-visibility surfaces.
- 2026-04-18: added Figma-lane viability checks, visual-delta closure, task-view authenticity checks, and a human-eye premium bar for flagged premium runs.
- 2026-04-18: added a shared premium preset closure bar for motion timing, navigation experience, and data-rendering quality on flagged premium surfaces.
- 2026-04-18: added route-vs-mode honesty and low-signal shell or table checks so one polished submode cannot falsely close the whole page as premium.
- 2026-04-18: added route-wide rebuild verification so flagged admin pages must prove landing, secondary, create, and overlay states against the approved route wireframes.
- 2026-04-19: added keep-replace-remove-add verification so legacy controls, copy, or weak functional patterns cannot sneak back in after a route rebuild.
- 2026-04-20: added hard failures for missing scaffold-state coverage, illegal overlay stacks, scroll-ownership drift, weak 100%-zoom fit, and motion that remains too subtle to materially improve premium admin surfaces.
- 2026-04-20: added component-provenance, fix-versus-enhancement, and data-shape bias closure checks so premium UI cannot pass as generic AI-default work.
- 2026-04-20: added motion-system closure checks for underpowered motion, inconsistent motion voice, ambient-motion overuse, pagination weakness, and modal-or-drawer animation drift.
- 2026-04-20: added hard failures for annotation leakage, separate premium-Figma-file drift, clean-but-generic output, admin-family drift, and conservative scaffolds that still read like polished prototypes.
- 2026-04-20: added anti-reference drift checks so a prior weak scaffold or live surface cannot still dominate the final composition after a premium redesign pass.
- 2026-04-20: added visual-DNA and concept-divergence closure checks so premium UI must prove both workflow strength and screenshot-level identity.
- 2026-05-17: added runtime-guardrails and browser-runtime-loop alignment so blank browser states, Playwright MCP recovery, and click-through evidence are handled consistently.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/verification-matrix.md`
  - the touched package `package.json` files for script truth
  - `.playwright-mcp.json`
  - `.playwright-fittrack-flow.json`
  - `tasks/integration-builder/integration-driver/07-playwright-verification.md`
  - `tasks/integration-builder/integration-driver/08-mcp-policy.md`
- Confirm whether the change is web-only, mobile-only, backend-only, shared-package, or cross-surface.

## MCP verification order

Run verification in this order unless the touched change is clearly exempt from a later step:

0. runtime guardrail check when ports, stack ownership, blank browser state, or Playwright/DevTools availability is uncertain
1. Serena-backed preflight and touched-surface confirmation
2. lint and typecheck
3. targeted tests
4. direct API or runtime checks
5. Prisma Local or PostgreSQL truth checks when DB-backed state matters
6. Swagger confirmation
7. Browser DevTools checks for browser runtime issues, targeted accessibility, or Lighthouse
8. Playwright MCP verification, preferably through `browser-runtime-loop` for browser-visible flows that need click-through evidence
9. final bug, edge-case, use-case, UI-quality, accessibility, and performance report

## Risk-based matrix

- **Simple refactor**
  - Use the smallest honest command set.
  - Verify the touched happy path plus the closest regression-adjacent seam.
- **Normal feature**
  - Follow the full order above unless a phase is irrelevant to the touched surface.
  - Check primary actions, empty/loading/error/success states, and one realistic failure path.
  - If the implementation refactored a shared seam or widened a contract, verify at least one regression-adjacent consumer or shared-client seam from the declared constraint scan.
- **Auth, AI, payment, upload, permission, or sensitive-data change**
  - Treat negative paths as mandatory.
  - Use direct API checks before Swagger.
  - Use Playwright when the user-facing bundle changed.
- **UI-heavy or page-elevation change**
  - Treat UI excellence, interaction quality, and state quality as closure gates.
  - Confirm the page moved honestly from its starting tier toward the requested target tier.
  - Verify that named premium blockers were closed or explicitly deferred.
  - If the target tier is `premium`, fail the closure when the result is only `elevated` unless the target tier was explicitly downgraded.
  - Check that the final page still aligns with the stated reference lane instead of falling back to generic utility styling.
  - Check that major components such as the table, pagination, filters, command bar, and secondary workflow container actually improved, not just the page wrapper.
  - Check that the Figma lane was honestly classified as `usable`, `weak`, or `unavailable`.
  - If Figma was weak or unavailable, confirm the run used a named benchmark lane instead of pretending Figma supplied the reference quality.
  - Check that the implementation packet included `Reference captures by component`, an `Interaction scaffold`, an `Overlay ownership matrix`, a `Scroll ownership plan`, a `Breakpoint composition plan`, `Motion choreography`, a `Scaffold node map`, and `Allowed implementation deviations`.
  - Check that each major component had both `Fixes` and `Enhancements` considered, with unselected enhancements explicitly deferred instead of silently forgotten.
  - Check that a `Motion decision packet` exists when the premium run claims a strong animation finish or a dedicated motion lane.
  - Check that major components can be traced back to real Figma nodes or named benchmark sources. If the surface reads like a generic AI-generated admin template with no component provenance, fail premium closure.
  - Check that the run produced both a `Structural reference lane` and an `Aesthetic reference lane`.
  - Check that the aesthetic lane includes at least two screenshot-backed `high_ceiling` references. If it relies only on support-only product UIs, fail premium closure.
  - Check that an `Aesthetic contact sheet` exists and that it names the exact visual traits being borrowed rather than just listing sources.
  - Check that a `Visual DNA` packet exists and that it is visibly reflected in the final screenshots.
  - Check that `Primitive kit` and `Component grammar` packets exist and are visibly reflected in the final screenshots.
  - Check that a `Concept divergence matrix` exists and that the chosen concept did not collapse back into the anti-reference silhouette.
  - Check that the run used the approved admin-family grammar instead of inventing a new visual language for one page.
  - Fail the run when annotation, guardrail, packet, or board-note language leaks into final product UI.
  - Fail the run when the premium admin scaffold was written into a route-specific file even though a master workspace was required.
  - Check that the review verdict was honored. If the page needed relayout or component replacement, fail the run when the old weak pattern was mostly preserved.
  - Fail the run when a surface that was marked `anti_reference` still dominates the final composition, workflow model, or component anatomy.
  - Fail the run when the final result is a same-layout-reskin of the anti-reference.
  - Fail the run when the final screenshots still read like generic-safe-SaaS despite a premium visual-DNA packet.
  - Fail the run when the final screenshots could be explained entirely by support-only references and safe defaults instead of the approved high-ceiling aesthetic lane.
  - Fail the run when the page has no first-glance identity even if the workflow is stronger.
  - Check that missing-component opportunities that materially affected premium feel were either implemented or explicitly deferred with a real reason.
  - Check that motion was layered on after the component system was already strong, not used as compensation for weak structure.
  - Fail the run when hover, selection, pagination, modal, drawer, toast, validation, and ambient motion do not feel like one consistent motion voice.
  - Fail the run when ambient or background motion competes with the page's primary task instead of supporting it quietly.
  - Fail the run when pagination or content-switch transitions still feel like hard snaps on a surface that claimed premium motion polish.
  - Fail the run when modal or drawer transitions materially differ from the declared motion preset without a real reason.
  - Check that the visual delta is strong enough that a human can see the page materially changed in hierarchy, task architecture, or component quality.
  - Run a live modal and interaction click-through in Browser DevTools for the touched premium surface:
    - activate the primary row or card
    - change pagination
    - change a filter, tab, or segmented control
    - open and close the main modal or drawer
    - trigger one safe confirmation path when it exists
  - Fail the run when that click-through reveals duplicated modal fields, contradictory values, awkward overlay ownership, or motion that is present but still too soft to feel intentional.
  - Fail the run when required scaffold frames are missing for the landing, inspected or selected, create or edit, confirm or destructive, empty, loading, or error states that matter to the surface.
  - Fail the run when two primary dialogs, drawers, or inspectors are active at the same time unless the approved scaffold explicitly allows a confirm overlay on top of a parent flow.
  - Check that row click, detail, edit, and destructive flows follow the approved overlay model instead of stacking local panels ad hoc.
  - Fail the run when desktop scroll ownership drifts into an accidental sidebar or inspector scroll trap that the scaffold did not approve.
- Fail the run when the UI is still compensating for missing canonical labels, status meaning, search or filter support, aggregate data, or action-complete payloads through brittle local workarounds that should have been pushed to `backend` via `integration`.
  - Fail the run when the landing scale still feels oversized at `100%` zoom on a common laptop width or when the primary command surface still spills awkwardly below first paint without a deliberate reason.
  - Check that task views and create flows no longer read like nested cards or embedded forms when the redesign claimed to solve that problem.
  - Check that navigation is obvious, reversible, and free of dead-end local swaps when the redesign claimed a dedicated mode or child surface.
  - Check that the most actionable data is visually dominant and that decorative or repetitive renders do not outrank the operator's main job.
  - Check that the default route mode is premium in its own right when the run claims route-level premium quality. A polished child mode is not enough.
  - Check that the landing state does not still rely on oversized section headers, dead top bands, or low-signal list or table presentation.
  - Check that a route-wide rebuild used the approved Figma route wireframes before implementation began.
  - Check that the final route follows the approved `Keep / Replace / Remove / Add` matrix.
  - Check that implementation did not skip unresolved recommendation-first decisions that were supposed to be settled through the Notion Q&A lane.
  - Fail the route when explicitly removed or replaced legacy clutter still survives in the final screenshots or behavior.
  - Score landing, secondary, create, and overlay states separately when the route claims premium closure.
  - Fail the route if only one state is premium while the others still read as patched internal-tool surfaces.
  - Check that the final screenshots are materially closer to the approved route wireframes, not only cleaner than before.
  - Check that motion stays inside the shared preset unless the run explicitly justified a deviation:
    - micro feedback around `140-180ms`
    - state switches around `180-240ms`
    - larger panels, drawers, or modals around `240-320ms`
  - Fail premium closure if motion is technically present but still too subtle to materially change the feel of a previously static or dead premium surface.
  - Apply a human-eye premium bar: if a design-conscious reviewer would still call it a cleaned-up internal tool from the screenshot alone, fail premium closure.
  - Apply an art-direction bar: if the page still reads like a polished prototype or conservative board export rather than a product surface, fail premium closure.
  - Run targeted Lighthouse or browser accessibility checks on important web pages when the surface changed materially.

## MCP expectations

- Serena is required.
- Prisma Local is preferred for DB-backed verification and required when schema, migration, seed, or local repository state can change runtime truth.
- `postgresReadOnly` is allowed when a raw SQL truth check is faster or clearer than Prisma-level inspection.
- Browser DevTools is allowed for browser-visible runtime issues, targeted accessibility checks, and Lighthouse.
- Swagger is a verification MCP, not an implementation MCP.
- Playwright is a browser-surface verification MCP and should only run after direct API checks pass for runtime-sensitive flows. If Playwright appears blank or stuck, use `runtime-guardrails` and direct route navigation before declaring the MCP unavailable.
- Sentry is optional and future-facing here; use it only when a real FitTrack project exists and the issue is genuinely prod-observed.

## Regression-adjacent selection rules

- Check shared DTOs, validators, controller helpers, query hooks, auth guards, and reusable UI sections adjacent to the touched files.
- When a run widened endpoints, shared hooks, or shared client shapes, fail closure if there is no evidence that the declared constraint scan covered `packages/api-client`, `packages/query`, or the closest adjacent consumer.
- Do not balloon into a monorepo-wide sweep unless the change truly crossed package seams.
- If the verification order cannot be completed honestly because a required MCP is missing, report that as a blocker instead of guessing.

## Output defaults

- Lead with findings ordered by severity.
- Distinguish confirmed failures, blockers, skipped checks, and residual risks.
- Separate findings into:
  - `functional`
  - `ui-excellence`
  - `accessibility`
  - `performance`
- For user-facing revision work, also report:
  - `Wireframe gate status`
  - `Keep / Replace / Remove / Add follow-through`
  - `Route state scoring`
  - `Starting tier`
  - `Final tier`
  - `Target tier`
  - `Figma lane status`
  - `Reference alignment`
  - `Component reference alignment`
  - `Aesthetic source ladder verdict`
  - `Screenshot evidence verdict`
  - `Admin family consistency verdict`
  - `Figma workspace verdict`
  - `Annotation leakage verdict`
  - `Scope honesty`
  - `Navigation quality`
  - `Data rendering quality`
  - `Overlay ownership verdict`
  - `Scroll ownership verdict`
  - `Zoom-scale verdict`
  - `State-frame coverage`
  - `Motion preset alignment`
  - `Visual delta assessment`
  - `Task-view authenticity check`
  - `Unresolved premium blockers`
  - `Missing component opportunities left unresolved`
  - `Motion voice verdict`
  - `Professional feel verdict`
- Call out when MCP order was intentionally narrowed and why that was still honest.
- If a page is technically functional but still static, confusing, inaccessible, or structurally bloated, do not mark it complete.
