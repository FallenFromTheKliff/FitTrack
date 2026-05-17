# Runtime Loop Checklist

Use this reference while executing `browser-runtime-loop`. Keep the loop concrete: route, role, controls, evidence, fix, rerun.

## Click-Through Path

1. Confirm runtime with `runtime-guardrails`.
   - Check `.artifacts/dev-stack-manifest.json` when present.
   - Prefer `.playwright-mcp.json` and `.playwright-fittrack-flow.json` for browser defaults.
   - Use `http://127.0.0.1:8080/login` for web and `http://127.0.0.1:8081/login` for Expo web when relevant.
2. Identify the target route, role, and viewport.
   - If credentials are required, check the current manifest or flow config before using seeded accounts.
   - If no route can be inferred, ask the user for the surface to verify.
3. Navigate directly to the target or login URL.
   - If the browser is blank, stuck, or on `about:blank`, navigate anyway before declaring failure.
   - If protected, verify redirect and login path first.
4. Snapshot before interacting.
   - Use refs from the latest snapshot only.
   - Handle any browser dialog before clicks or typing.
5. Exercise the primary flow.
   - Header/nav/sidebar links related to the route.
   - Primary CTA buttons and icon buttons.
   - Tabs, segmented controls, accordions, filters, and menus.
   - Pagination, sorting, search, and date/role selectors.
   - Modal open, submit/cancel/close, and focus return.
   - Forms: valid submit, required-field validation, disabled/loading state, and success/error state.
   - Empty, loading, permission-denied, and error states when reachable without destructive setup.
6. Re-snapshot after each state change.
   - New route, modal, tab, pagination, form submit, dropdown reveal, reload, or auth redirect means old refs are stale.
7. Capture supplemental evidence.
   - Screenshot for layout, chart/canvas, overlap, responsive fit, or visual bug claims.
   - Console and network details for runtime errors, failed requests, redirects, auth failures, or slow/refetch-heavy paths.
   - DevTools Lighthouse-style checks for accessibility or best-practice concerns when relevant.
8. Fix objective bugs, then rerun the same path.
   - Preserve the original reproduction path so verification proves the fix.

## Evidence Packet

Include these in the final verification summary:

- Route(s) visited and direct URL used.
- Runtime source checked: manifest, status command, health URL, or existing stack.
- Browser tool(s): Playwright MCP, Chrome DevTools MCP, or fallback used.
- Viewport(s): desktop, mobile, or Expo web.
- Role/account source, if auth was required.
- Snapshot-based controls exercised.
- Screenshots captured when visual layout mattered.
- Console errors, warnings, failed network requests, redirects, and notable status codes.
- Gap taxonomy labels and severity.
- Objective fixes made and exact path rerun.
- Residual risks or stop condition reached.

## Gap Taxonomy

- `functional`: crash, broken action, bad navigation, submit failure, missing data, or incorrect visible behavior.
- `unlinked`: visible control has no handler, dead route, inert modal trigger, placeholder action, or disconnected pagination/filter.
- `contract`: DTO, endpoint, route param, response shape, status code, enum, auth header, or query mismatch.
- `async/state`: stale data, race, loading never clears, incorrect disabled state, bad optimistic update, cache miss, or repeated refetch.
- `permission/auth`: login redirect, role guard, forbidden state, token refresh, seeded role, or session persistence problem.
- `layout`: overlap, clipped text, broken responsive behavior, scroll trap, offscreen control, or visual misalignment.
- `copy`: placeholder, misleading label, stale feature name, duplicate text, typo, or missing user-facing state.
- `accessibility`: missing accessible name, bad dialog focus, keyboard trap, missing semantics, contrast concern, or non-announced status.
- `performance`: slow initial render, excessive network calls, long task, heavy asset, or avoidable rerender/refetch.

## Stop Conditions

Stop and ask the user before proceeding when:

- The requested fix requires broad relayout, subjective visual redesign, new product behavior, or changed business rules.
- The issue is only aesthetic preference and screenshots do not show an objective break.
- Fixing requires writes outside the user's allowed scope.
- Verification requires resetting data, stopping another worker's process, killing unknown runtimes, or using credentials not present in the current manifest/flow.
- The target route, role, or expected outcome cannot be inferred.
- Playwright MCP or DevTools remains unavailable after direct navigation, runtime health checks, reload, snapshot, and console/network inspection.
- A production-like external service or payment/email/SMS side effect would be triggered.
