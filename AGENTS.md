# FitTrack Codex Overlay

This repository is FitTrack. Its durable project workflow lives in the global `orchestrator` skill, which verifies project identity and routes each request to one scoped execution lane.

## Local routing

- For FitTrack implementation, review, integration, or verification work, use the global `orchestrator` hub and the smallest applicable lane.
- Product-specific truth lives in this repository and the approved Obsidian `Source of Truth/FitTrack/` notes; do not treat archived skill manuals as active instructions.
- Preserve unrelated user and concurrent-worker changes; do not revert or clean up work outside the active request.

## Global Codex configuration

- Reusable worker definitions and MCP registrations live in the global Codex configuration, not under this repository.
- The globally registered Graphify, Storybook, and shadcn servers remain path-bound to this FitTrack workspace and should be activated only for relevant FitTrack work.
- Generic `[agents]` runtime limits are defined once in the global Codex configuration.

## Scope

Do not use FitTrack guidance outside this repository. Do not access credentials, production systems, remote databases, or deployment controls unless the active request explicitly authorizes them.

## Luna/Terra delivery defaults

- Do not use parallel execution or a faster service tier unless the user explicitly requests it.
- The main agent/Sol owns scope, acceptance criteria, orchestration, and the final report.
- Before dispatching Luna, Sol must define the implementation contract: observed failure and evidence, likely root cause, dependency/source-of-truth path, exact files or symbols to inspect or own, the smallest coherent solution, preserved invariants, and executable acceptance checks.
- Sol remains the reasoning and decision lane throughout the task. Evaluate worker evidence and decide repairs directly; do not forward worker suggestions blindly, delegate architecture discovery by default, or ask Luna/Terra to broaden scope.
- Luna is the bounded implementation lane. Execute Sol's file ownership and acceptance contract, add the specified tests, and report only contradictory evidence, an authority/safety blocker, or final results. Do not independently redesign, rescope, or replace the chosen architecture unless repository evidence disproves the contract.
- Terra is the independent verification lane. Verify Sol's acceptance contract and the completed diff, report evidence and grouped defects, and do not redefine product behavior or implementation scope.
- If new evidence invalidates the plan, the worker stops at the contradiction and returns it to Sol; Sol revises the dependency map, file list, solution, and acceptance criteria before implementation resumes.
- One Luna Max worker implements the complete scoped batch sequentially at standard speed.
- One Terra Max worker independently QA-checks the completed batch at standard speed; Terra does not implement in parallel.
- Send Terra's grouped findings back to the original Luna for one repair pass, then recheck only failed criteria.
- Worker reporting is blocker-or-final: workers proactively report only an authority blocker, dangerous finding, or completion. Do not poll routine status; send at most one status nudge after a material overrun.
- Terra receives the same acceptance contract plus changed targets and evidence, checks only the changed surfaces and proportional regressions by default, and reports findings without editing unless fallback repair is explicitly authorized.
- Implement the complete scoped batch first, then run QA, then make one grouped repair pass and recheck failed criteria.
- Do not repeatedly run broad test suites after each partially implemented fix. During implementation, write the required tests and use only minimal compile or feasibility checks needed to keep the batch moving.
- After the full scoped batch is implemented, run one persistent-browser happy-path check for every affected workflow. Group any failures into one repair pass before starting the consolidated automated-test gate.
- Run focused test suites, typechecks, builds, and final Playwright regression checks once the browser happy paths pass. Re-run only failed criteria after a grouped repair instead of restarting every earlier gate.
- For approved UI redesigns, lock the component contract and converge structure/visuals before exhaustive behavior QA. Keep existing handlers wired and use only bounded render/feasibility checks during visual implementation; run full functionality and accessibility checks after the visual gate stabilizes.
- When an approved visual reference exists, layout or responsiveness alone cannot pass: Terra must judge composition, component family, surface boundaries/chrome, action placement, information density, geometry, and responsive transformation. Whole-page scores are informational; a wrong component family, extra major surface, missing or duplicate action, clipped content, or materially failed critical region is an automatic visual failure. Sol orchestrates only, Luna implements, and Terra owns runtime/visual critique.
- For feature additions, feature removals, nontrivial bug fixes, regressions, contract/schema changes, and work spanning multiple modules, use Graphify first as the dependency source of truth for owners, relations, call paths, and upstream/downstream consumers.
- After Graphify establishes the dependency map, use Serena for focused symbol discovery, reference tracing, and exact edit ownership, then use literal search for exact strings, generated files, configuration, and final residual checks. Truly isolated one-file edits may start with Serena. Use the repository-approved patch mechanism for edits.
- For authenticated interaction debugging, prefer the built-in persistent browser so the existing signed-in session and live application state can be reused. Use this first for canvas, drag-and-drop, gesture, modal, and multi-step workflow failures.
- Use Playwright Test after the behavior works as the deterministic interaction-regression and visual-QA gate. Do not make repeated fresh-login Playwright runs the primary debugger when local development compilation or authentication is unstable.
- For browser evidence use Chrome DevTools for DOM, console, network, accessibility, and performance checks; use native browser/Playwright and screenshots for user-visible mobile behavior.
