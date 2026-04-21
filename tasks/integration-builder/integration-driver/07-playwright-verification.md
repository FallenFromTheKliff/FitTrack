# Integration Driver Playwright Verification

Use this file when browser-driven verification is required during the active page-first `verify` phase.

## Goal

Use Playwright MCP to simulate the shortest realistic web and mobile Expo-web flows after the direct API checks for the active surface bundle have already passed.
Playwright verification is not only a reachability check. It is the browser-side confirmation that the page feels finished enough to close under the current `Completion QA` rubric.

## Required Inputs

Read:

- `.playwright-mcp.json`
- `.playwright-fittrack-flow.json`
- the selected surface page
- any required companion surface pages
- the linked domain task page when one exists
- the active `Runtime and Playwright Artifacts` or evidence sections

## Preflight

Before any Playwright verification:

1. rerun `tasks/integration-builder/integration-preflight.cmd -Mode runtime`
2. confirm Playwright MCP tools are available in the current session
3. confirm the configured web base URL is reachable when the bundle includes web
4. confirm the configured mobile Expo-web base URL is reachable when the bundle includes mobile
5. confirm the touched backend services are already healthy from the direct API checks
6. when the active verification depends on a locally started API, prefer the operator-managed watcher stack and use `node dist/src/main.js` from `apps/api` only as fallback recovery

If any preflight step fails, stop and report a blocker instead of silently skipping browser verification.

## Verification Scope Rules

- `verificationMode = web_only` -> verify only the selected web surface
- `verificationMode = mobile_only` -> verify only the selected mobile Expo-web surface
- `verificationMode = cross_surface` -> verify the selected surface plus all required companion surfaces before the bundle may close
- when `SURFACE_PLATFORM_SCOPE` overrides the manifest, record the override reason in the selected surface page `Decision Log`

## Web Flow

For each required web surface:

1. set the browser viewport to the `web` viewport from `.playwright-fittrack-flow.json`
2. navigate to the configured web login route or the task-specific entry route
3. execute the shortest realistic happy path that exercises the integrated behavior
4. exercise every visible primary action that is in scope and decision-safe to test
5. when the surface exposes a modal-driven action, verify the modal can open, close, and submit or cancel cleanly
4. when the page is role-sensitive, also execute the required denial path
6. capture network requests and confirm the touched integrated endpoints are called with the expected status pattern
7. confirm a visible post-action state, not only network activity:
   - updated data
   - success feedback
   - disabled or pending state reset
   - redirect or return path
8. capture console messages and a screenshot when the flow fails

## Mobile Flow

For each required mobile Expo-web surface:

1. set the browser viewport to the `mobile` viewport from `.playwright-fittrack-flow.json`
2. navigate to the configured Expo-web login route or the task-specific entry route
3. execute the shortest realistic happy path that exercises the integrated behavior on the mobile surface
4. exercise every visible primary action that is in scope and decision-safe to test
5. when the surface exposes a modal-driven action, verify the modal can open, close, and submit or cancel cleanly
4. when the page is role-sensitive, also execute the required denial path
6. capture network requests and confirm the touched integrated endpoints are called with the expected status pattern
7. confirm a visible post-action state, not only network activity:
   - updated data
   - success feedback
   - disabled or pending state reset
   - redirect or return path
8. capture console messages and a screenshot when the flow fails

## Evidence Rules

- store Playwright trace and session artifacts under the configured Playwright output directory
- summarize the verified endpoint calls in the relevant surface page `Playwright Evidence` sections
- summarize any `Completion QA` finding that was browser-visible, even if the API contract itself was healthy
- when companion surfaces were required, record web and mobile evidence separately
- record artifact paths in `Runtime and Playwright Artifacts` or the surface evidence sections
- if one required surface is blocked, explain exactly why and include the artifact location
- if the active bundle stops blocked during verification, update `Next Resume Step` with the concrete blocker and next action

## Minimal Verification Standard

The Playwright step is sufficient only when:

- every required surface in the bundle reaches its expected post-action state
- the integrated endpoints for the active bundle appear in Playwright network capture
- role-sensitive surfaces include the required denial path
- modal-driven flows prove open and close behavior when that UI exists on the surface
- success or failure feedback is visible after primary actions when the feature implies it
- failures include artifact evidence instead of a generic note
