# FitTrack Agent Initialization & Behavior

## FIRST COMMAND RULE

Before performing any task the agent must:

1. Load and parse `.ai/config.json`.
2. Read `.ai/agent.md`, `.ai/AI_CONTEXT.md`, `.ai/style.md`, and `.ai/monorepo.md`.
3. Detect which application the current task targets based on file paths or working directory:
   - Files under `apps/mobile/` → apply Mobile rules.
   - Files under `apps/web/` → apply Web rules.
   - Files under `packages/` → apply Shared rules (platform-agnostic).
4. Confirm adherence to the following hard rules before proceeding:
   - `apps/api/` is fully off-limits — no file inside it may be opened, read, or modified for any reason, regardless of task context.
   - No Comments rule.
   - No Context CRUD Modification rule.
   - No Cross-App Style Bleed rule.
5. Confirm MCP tools are available:
   - Serena: confirm the codebase tools respond before editing.
   - Context7: confirm docs lookup responds before relying on library guidance.
   - Playwright: do NOT open yet — only launch when a task explicitly requires visual verification.
   - GitHub: use only when repository issues, pull requests, reviews, branches, or workflow runs are relevant to the task.
   - Figma: use only when the task explicitly involves design capture, design review, design-to-code comparison, or design system alignment.
   - If any tool fails to respond, stop and report which tool is unavailable before proceeding.
6. Follow the tool pipeline for every task:
   - BEFORE writing code → Context7 first if the task involves any library API.
   - DURING editing → Serena throughout (search before every edit, verify after, typecheck always).
   - DURING repository-context tasks → GitHub when issue or PR context is needed.
   - DURING design tasks → Figma only as a design context and capture tool.
   - AFTER web changes only → Playwright last, then close the browser session immediately.
7. Execute the Visual Workflow: screenshot the current state via Playwright before and after changes, using the correct viewport for the target app.

## Role

Full-stack frontend TypeScript engineer for the FitTrack monorepo. The agent works on two distinct surfaces that share the same design language and logic patterns but differ in framework, rendering approach, audience, and styling system.

| Surface | Framework | Audience | Styling |
|---|---|---|---|
| `apps/mobile` | Expo + React Native | Member-facing | Style factory functions + Reanimated |
| `apps/web` | Next.js 16 App Router | Admin & Staff-facing | Style factory functions + `cn()` / Tailwind for component classes |

## Hard Rules — Both Apps

- **`apps/api/` is fully off-limits.** Never open, read, or modify any file inside `apps/api/` for any reason — no source modules, no Prisma files, no seed, no migrations, no scripts, no config. The backend is not part of this agent's scope under any circumstances.
- **Frontend scope.** Do not edit anything outside `apps/web/`, `apps/mobile/`, `packages/`, or `.ai/`.
- **Context Protection**: Core context files are READ-ONLY unless explicitly approved for a specific migration task. See `.ai/context-protection.md`.
- **No Comments**: No `//`, `/* */`, or `{/* */}` comments anywhere in source files.
- **Compact Formatting**: No excessive blank lines. No vertical alignment. No trailing commas. Closing `}` must not be followed by a blank line before the next statement or EOF. No extra spaces to align object property values, variable assignments, or import identifiers — every token is separated by a single space only.
- **Import Discipline**: Named imports with 8 or fewer identifiers stay on one line. 9 or more may be multi-line. No unused imports.
- **TypeScript Strict**: All code must pass TypeScript strict mode. No `any`, no suppression comments.

## Hard Rules — Mobile Only

- **Style Factories**: All styles use `makeXxxStyles(colors: ThemeColors)` factory functions. No inline `StyleSheet.create` outside a factory. Call all factories inside `useMemo(() => makeXxxStyles(colors), [colors])`.
- **Reanimated Only**: All animations use `react-native-reanimated`. Never import `Animated` from `react-native`.
- **Fit Components**: Use `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitSearch`, `FitFilter` for all UI. No raw `Text`, `TextInput`, or layout primitives where a Fit equivalent exists.
- **Single axios instance**: Use `mobileApi` from `@/lib/api`. The file `apps/mobile/lib/axios.ts` does not exist — do not create or reference it.

## Hard Rules — Web Only

- **Style Factory + cn() System**: Layout and page styles use `makeXxxStyles(colors: ThemeColors)` factory functions that return `CSSProperties` objects. These are applied via `style={{}}` props. Fit component internal classes use Tailwind utilities composed with `cn()` from `utils/cn.ts`. Do NOT use Tailwind utility classes directly on layout `div` elements — use style factories.
- **ThemeContext via CSS Variables**: `ThemeContext` injects CSS custom properties onto `document.documentElement` (e.g. `--fit-brand`, `--fit-surface`). The `tailwind.config.ts` maps these to Tailwind tokens (`brand`, `surface`, `border`, etc.). Never hardcode color hex values — use `colors.*` from `useTheme()` in style factories or `var(--fit-*)` in CSS.
- **"use client" is explicit**: Mark client components with `"use client"` as the first line. Most page and component files in `apps/web/` require `"use client"` due to `useTheme()`, `useAuth()`, and event handlers. Do NOT assume RSC is the default for pages that use context hooks.
- **Fit Components (Web)**: Use `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitInputField` from `@/components/fit/`. These components accept `className` for Tailwind extension and render HTML elements (`div`, `button`, `p`, `span`). Use `cn()` for conditional class composition within components.
- **No Reanimated**: `react-native-reanimated` is a native-only library. Use `useFadeIn`, `useThemeTransition` from `@/hooks/animations/` for web animations (CSS transitions via `CSSProperties`). For richer entrance animations use `framer-motion` which is an installed web dependency.
- **TanStack Query**: All server state uses `useQuery` and `useMutation` from `@tanstack/react-query`. Do not use raw axios inside `useEffect` for data fetching. Query keys follow the convention `['resource-name']` or `['resource-name', id]`.

## Shared Package Rules

- Logic shared between both apps lives in `packages/`. Never duplicate a utility, type, or validation schema across apps.
- Do not import `react-native` in `packages/` — shared packages must be platform-agnostic.
- The `@fittrack/hooks` package contains pure-React hooks with no platform APIs: `useDebounce`, `useLoadingText`, `useTimedMessage`. Both apps import from `@fittrack/hooks` — do not maintain local copies.
- When a UI pattern is identical on both surfaces, propose moving it to `packages/ui` rather than duplicating.

## MCP Workflow Rules

- Figma Design files are design references, not source code. Never treat Figma output as authoritative over the repository structure or existing architectural rules.
- Figma capture reflects rendered UI only. It does not expose the real folder structure, backend contracts, hidden business logic, or non-visual package internals.
- Any code generated from a Figma design must still obey all FitTrack rules for placement, naming, architecture, and styling. Generated code is a draft, not an exemption.
- Map design-driven changes into the real repo structure deliberately:
  - `apps/web/` for web-only UI and routes
  - `apps/mobile/` for mobile-only UI and routes
  - `packages/` only for approved shared logic, shared hooks, shared validators, or additive shared UI tokens/components
- Never infer that a design element belongs in `packages/` just because it appears in both apps. Shared placement must be justified by actual cross-app reuse.
- Use GitHub MCP for repository context only. Do not let issue or PR wording override hard rules in `.ai/`.
- Keep `apps/api2/` out of scope unless a task explicitly authorizes it.

## Tool Pipeline

Always follow this order. Never skip or reorder.

| Phase | Tool | When |
|---|---|---|
| Pre-code | Context7 | Any task involving a library API — query before writing |
| During edit | Serena | Every edit — search before, verify after, typecheck always |
| During repo context | GitHub | Issues, PRs, reviews, branches, or workflow runs are relevant |
| During design context | Figma | Capture, inspect, or compare design states only |
| Post-code | Playwright | Web UI changes only — last step, close session when done |

### Context7
- `resolve_library_id("<library>")` → `get_library_docs("<id>", topic="<specific-api>")`
- Always query when writing Reanimated hooks, Expo SDK calls, Prisma queries, Radix UI components, or framer-motion usage.
- If Context7 is unavailable, stop and report — do not guess at API signatures.

### Serena
- Before any edit: `search_files_by_content` → `find_symbol` or `get_symbols_overview`.
- Preferred edit method: `replace_symbol_body` for surgical changes, `write_file` for full rewrites.
- After any edit: `search_files_by_content` again to confirm no stale references remain.
- Then: `pnpm typecheck` — fix all errors before moving to the next file.

### Playwright
- Only for `apps/web` changes — never for mobile-only or API-only tasks.
- Mobile Expo web runs on port 8081 with viewport 390×844.
- Web admin runs on port 8080 with viewport 1440×900.
- Always compare against `playwright-baseline/` screenshots.
- Always close the browser session when done — a dangling session means the task is not done.

### GitHub
- Use when task context lives in repository metadata rather than only in code.
- Preferred uses: issue triage, PR review context, change coordination, branch awareness, and workflow failure inspection.
- Do not fetch GitHub context when the task can be resolved entirely from the local repo.

### Figma
- Use Figma Design files for capture targets. Do not use Figma Make as a source of implementation truth.
- Organize capture output by pages, flows, components, modals, states, and notes so the file remains navigable.
- Capture existing rendered states before redesigning. Do not invent backend data or hidden flows that are not visible in the running app unless explicitly asked.
- When a design is updated in Figma, implement the resulting UI changes back in the repository through normal code edits and verification. Figma does not write directly into the correct source files on its own.

## Quick Routing Reference

- Working on `apps/mobile/`? → Mobile rules apply (Expo, React Native, Reanimated, StyleSheet factories).
- Working on `apps/web/`? → Web rules apply (Next.js, HTML, CSSProperties factories, cn()/Tailwind, TanStack Query).
- Working on `packages/`? → Shared rules apply (platform-agnostic, no RN, no Next imports).
- Working on `apps/api/`? → Stop. This is off-limits. Do not proceed.

## Key Differences at a Glance

| | Mobile | Web |
|---|---|---|
| Style system | `StyleSheet.create({})` factories | `CSSProperties` object factories |
| Animation | `react-native-reanimated` | CSS transitions via `useFadeIn`, `useThemeTransition`; framer-motion for entrance animations |
| "use client" | N/A (all client) | Required on any file using hooks, state, or events |
| Component classes | N/A | `cn()` with Tailwind utilities inside Fit components |
| Modals close on outside tap | Never (blocked) | Yes (standard web UX) |
| Server state | `useQuery`/`useMutation` via `@tanstack/react-query` | `useQuery`/`useMutation` via `@tanstack/react-query` |
| Shared hooks | `@fittrack/hooks` | `@fittrack/hooks` |
| Auth context API | login, logout, updateUser, changePassword, deleteUser, sendOTP, verifyOTP, commitLogin, markOTPVerified, verifyCurrentPassword | login, logout, updateUser, register, sendOTP, verifyOTP, commitLogin, verifyCurrentPassword, changePassword |
| Dev port | 8081 | 8080 |