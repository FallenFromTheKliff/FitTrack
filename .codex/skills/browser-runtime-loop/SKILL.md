---
name: browser-runtime-loop
description: FitTrack one-shot integration and runtime UI verification loop using Playwright MCP and Chrome DevTools MCP. Use for integration page verification, browser-visible bug sweeps, click-through verification, Playwright MCP loops, Chrome DevTools runtime diagnosis, unlinked UI components, broken buttons/modals/forms, console or network issues, and post-implementation UI runtime review.
---

# Browser Runtime Loop

Use this skill to prove a FitTrack route works in the browser, find objective runtime gaps, fix them, and rerun the same path until the evidence is clean or a subjective design decision needs the user.

## Core Loop

1. Confirm runtime first with `runtime-guardrails`.
   - Prefer existing stack state, `.artifacts/dev-stack-manifest.json`, and repo health/status commands.
   - Do not start or kill runtimes casually; follow `runtime-guardrails` and `stack-orchestration` when lifecycle ownership matters.
2. Load FitTrack browser defaults before navigating.
   - Prefer `.playwright-mcp.json` for Playwright MCP behavior and artifact paths.
   - Prefer `.playwright-fittrack-flow.json` for route, role, viewport, and expected-flow hints.
   - Default web login: `http://127.0.0.1:8080/login`.
   - Default Expo web login: `http://127.0.0.1:8081/login` when mobile web is relevant.
   - Use seeded credentials only after checking the current manifest or flow config.
3. Navigate directly to the known route, even if the browser starts blank or stuck.
   - Treat `about:blank`, an empty first snapshot, or an idle MCP page as recoverable.
   - Navigate to the target route or login URL, wait for the page, then snapshot before judging tool health.
4. Take a Playwright MCP accessibility snapshot and drive the page from it.
   - Use element refs from the latest snapshot for clicks, typing, selects, hover, tabs, pagination, menus, dialogs, and form submits.
   - Handle browser dialogs before continuing.
   - Re-snapshot after each navigation, modal open/close, tab change, pagination change, form submit, or visible state change.
5. Click through the primary path.
   - Exercise primary controls, buttons, links, tabs, pagination, menus, modals, forms, empty states, and obvious disabled states.
   - Verify the route does not merely render; verify controls are wired to useful behavior.
6. Capture evidence.
   - Use snapshots for structure, refs, accessible names, visible copy, and interaction targets.
   - Use screenshots when visual layout, charts/canvas, responsive fit, overlap, or visual regressions matter; compare desktop and mobile screenshots when layout is the claim.
   - Use Chrome DevTools MCP for console errors, failed network requests, status codes, redirects, storage/auth clues, and Lighthouse-style accessibility/best-practice checks when helpful.
7. Classify every gap before fixing.
   - `functional`: visible behavior is broken or route crashes.
   - `unlinked`: control exists but no route, action, handler, or modal is connected.
   - `contract`: frontend/backend schema, endpoint, route, or status expectation is mismatched.
   - `async/state`: loading, race, stale data, disabled state, optimistic update, cache, or refresh issue.
   - `permission/auth`: guard, redirect, role, token, seeded account, or forbidden-state issue.
   - `layout`: overlap, clipping, responsive break, visual hierarchy, scroll, or viewport issue.
   - `copy`: misleading, stale, missing, duplicated, or placeholder text.
   - `accessibility`: missing names, focus traps, keyboard issues, contrast, semantics, or dialog behavior.
   - `performance`: slow render, excessive requests, long tasks, large assets, or noisy refetching.
8. Auto-fix objective bugs in the touched surface.
   - Fix functional, unlinked, contract, async/state, permission/auth, copy typo, and clear accessibility bugs when the expected behavior is obvious from the app.
   - Keep edits scoped to the user's requested surface and current ownership rules.
   - Stop and ask before broad relayouts, subjective visual redesigns, new product behavior, data resets, or changes outside the allowed write scope.
9. Rerun the same browser path.
   - Navigate from a clean starting point when needed.
   - Repeat the same clicks/forms/tabs/modals that exposed the gap.
   - Recheck console, network, and screenshots for the fixed path.
10. Produce an evidence summary.
   - Include route, runtime source, role/account source if used, viewport(s), primary path clicked, gaps found by taxonomy, fixes made, residual risks, and artifacts/screenshots/log observations.

## UI Evidence Contract

- For user-visible workflow changes, load the canonical UI enforcement contract from `Research/Design/UI-UX-Enforcement/mechanical-enforcement-contract.md` through Obsidian when the vault is available.
- Bind every required proof to route, role, viewport, data fixture, UI state, overlay, and revision. A route screenshot without this metadata is partial evidence.
- Derive an impact-based matrix that includes relevant tabs, overlays, loading/empty/error/success states, disabled or permission-limited states, dense data, long text, and narrow/intermediate/full-width layouts.
- Treat stale actions, broken journeys, overlap, clipping, uncontrolled overflow, unreachable controls, missing scroll ownership, broken modal focus behavior, critical runtime errors, and missing required evidence as hard blockers.
- Screenshots prove appearance only. Pair them with snapshot-driven interaction, console/network checks when relevant, and explicit geometry or overflow inspection.
- If the vault is unavailable, use the equivalent project-local contract and report that the durable standard could not be loaded.
- Do not let an aesthetic critic or aggregate score waive a hard blocker.

## Tool Rules

- Prefer Playwright MCP for page interaction because snapshots provide stable refs and accessibility structure.
- Never click by stale ref after a page change; take a new snapshot first.
- Combine screenshots with snapshots for visual checks; screenshots alone are not enough to prove control wiring.
- If Playwright MCP appears stuck or blank, directly navigate to the route before declaring the browser tool failed.
- Use Chrome DevTools MCP when the evidence needs console output, network failures, storage/auth state, redirects, or Lighthouse-style checks.
- Do not overuse unsafe script execution; normal snapshot-driven interactions should be enough for most FitTrack flows.

## Reference

Read `references/runtime-loop-checklist.md` when running a route sweep, preparing an evidence packet, classifying gaps, or deciding whether to auto-fix versus stop for user confirmation.
