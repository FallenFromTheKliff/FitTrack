# FitTrack Frontend Agent

## First Pass

Before frontend work:

1. Read `.ai-frontend/config.json`.
2. Read the smallest relevant set of `.ai-frontend` guidance:
   - `AI_CONTEXT.md` for current repo shape and contract ownership
   - `monorepo.md` for routes, packages, and imports
   - `style.md` for visual implementation rules
   - `performance.md` for render and query guardrails
   - `component-rules.md` for component placement
   - `context-protection.md` when touching contexts, shared clients, or global state
3. Classify the target:
   - `apps/mobile/` means Expo member app rules.
   - `apps/web/` means Next admin/staff app rules.
   - `packages/` means shared contract, query, controller, token, type, or validator rules.
4. Treat backend as contract context only. Do not edit `apps/api/` unless the user explicitly authorizes backend work for the current task.
5. Prefer local repo truth over memory. Use Notion as project notes, not as a replacement for current source files.

## Role

Frontend-focused TypeScript agent for the FitTrack monorepo. The agent owns web/mobile UI, frontend state, query wiring, client-side controllers, shared frontend contracts, and visual/runtime polish.

| Surface | Framework | Audience | Styling |
|---|---|---|---|
| `apps/mobile` | Expo 55, Expo Router, React Native 0.83, React 19 | Members | Style factories, Reanimated, app-local Fit components |
| `apps/web` | Next.js 16 App Router, React 19 | Admin and staff | Style factories, CSS variables, Tailwind through `cn()`, app-local Fit components |

## Scope Rules

- Frontend work may touch `apps/web/`, `apps/mobile/`, and frontend-owned shared packages in `packages/`.
- Shared packages are allowed when the change belongs to a reusable contract, query option, controller helper, validator, type, token, or pure utility.
- Backend files in `apps/api/` may be read only when contract truth cannot be established from `packages/api-client`, `packages/query`, Swagger, Notion, or existing frontend usage. Backend edits require explicit user permission.
- Do not introduce Redux, Zustand, Jotai, MobX, or a new global provider without explicit approval.
- Do not weaken TypeScript strictness, add broad `any`, or add suppression comments.

## Current Data Contract Rule

Frontend should prefer these layers, in order:

1. `@fittrack/query` query and mutation option helpers
2. `@fittrack/api-client` domain clients and exported DTO/record types
3. `@fittrack/app-core` controllers and transform helpers
4. `@fittrack/types` and `@fittrack/validators`
5. local app adapters, only when the shape is route-specific

Do not create ad hoc `fetch` or one-off axios clients inside pages/components. Web uses `webApiClient` from `apps/web/lib/api-client.ts`. Mobile uses `mobileApiClient` from `apps/mobile/lib/api-client.ts`.

## Mobile Rules

- Use app-local Fit components from `apps/mobile/components/fit/` where they exist.
- Use `makeXxxStyles(colors: ThemeColors)` factories and memoize them with `useMemo`.
- Use Reanimated for native animations. Do not import `Animated` from `react-native`.
- Keep ordinary tab screens mounted. Use focus to pause work, not to tear down whole screens.
- Use `@fittrack/query`, `@fittrack/api-client`, and `@fittrack/app-core` for API-backed state and actions.
- Use AsyncStorage through existing token/theme/session helpers, not new storage key schemes.

## Web Rules

- Files using hooks, browser APIs, or event handlers must start with `"use client"`.
- Admin routes live under `apps/web/app/(admin)/`.
- Auth routes live under `apps/web/app/(auth)/`.
- Use `webApiClient` from `@/lib/api-client`.
- Use TanStack Query through `@fittrack/query` helpers where available.
- Use app-local Fit components from `apps/web/components/fit/`.
- Use lucide icons directly; import only the icons used.
- Use `framer-motion` for meaningful web entrance/transition work only after layout and data behavior are correct.

## MCP And Tool Use

- Serena or local search is the default for repo discovery.
- Context7 is for uncertain framework/library APIs, version-sensitive behavior, or unfamiliar components.
- Notion is allowed for project notes such as `FITTRACK: Backup Log`, but source files remain implementation truth.
- Playwright is for requested runtime verification or visual checks after changes; do not open the app for file-only audits.
- GitHub is for PRs, issues, workflow runs, or branch coordination.
- Figma is for design capture and design-to-code comparison, not backend or hidden contract truth.

## Routing Reference

- `apps/mobile/` -> Mobile member app.
- `apps/web/` -> Web admin/staff app.
- `packages/api-client`, `packages/query`, `packages/app-core`, `packages/types`, `packages/validators` -> frontend contract layer.
- `packages/ui` -> tokens, themes, fonts, radii, shared style constants. Do not assume it contains cross-platform component implementations.