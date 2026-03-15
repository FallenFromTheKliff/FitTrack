# FitTrack Agent Initialization & Behavior

## FIRST COMMAND RULE

Before performing any task the agent must:

1. Load and parse `.ai/config.json`.
2. Read `.ai/agent.md`, `.ai/AI_CONTEXT.md`, `.ai/style.md`, and `.ai/monorepo.md`.
3. Detect which application the current task targets based on file paths or working directory:
   - Files under `apps/mobile/` → apply Mobile rules.
   - Files under `apps/web/` → apply Web rules.
   - Files under `packages/` → apply Shared rules (platform-agnostic).
4. Confirm adherence to the "No Backend", "No Comments", "No Context CRUD Modification", and "No Cross-App Style Bleed" rules.
5. Execute the Visual Workflow: screenshot the current state via Playwright before and after changes, using the correct viewport for the target app.

## Role

Full-stack frontend TypeScript engineer for the FitTrack monorepo. The agent works on two distinct surfaces that share the same design language and logic patterns but differ in framework, rendering approach, audience, and styling system.

| Surface | Framework | Audience | Styling |
|---|---|---|---|
| `apps/mobile` | Expo + React Native | Member-facing | Style factory functions + Reanimated |
| `apps/web` | Next.js 16 App Router | Admin & Staff-facing | Style factory functions + `cn()` / Tailwind for component classes |

## Hard Rules — Both Apps

- **Frontend Only**: Zero backend, API route, server action, or database logic. Do not edit anything outside `apps/`, `packages/`, or `.ai/`.
- **Context Protection**: Core context files are READ-ONLY. No internal logic or CRUD changes to protected files. See `.ai/context-protection.md`.
- **No Comments**: No `//`, `/* */`, or `{/* */}` comments anywhere in source files.
- **Compact Formatting**: No excessive blank lines. No vertical alignment. No trailing commas. Closing `}` must not be followed by a blank line before the next statement or EOF. No extra spaces to align object property values, variable assignments, or import identifiers — every token is separated by a single space only.
- **Import Discipline**: Named imports with 8 or fewer identifiers stay on one line. 9 or more may be multi-line. No unused imports.
- **TypeScript Strict**: All code must pass TypeScript strict mode. No `any`, no suppression comments.

## Hard Rules — Mobile Only

- **Style Factories**: All styles use `makeXxxStyles(colors: ThemeColors)` factory functions. No inline `StyleSheet.create` outside a factory. Call all factories inside `useMemo(() => makeXxxStyles(colors), [colors])`.
- **Reanimated Only**: All animations use `react-native-reanimated`. Never import `Animated` from `react-native`.
- **Fit Components**: Use `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitSearch`, `FitFilter` for all UI. No raw `Text`, `TextInput`, or layout primitives where a Fit equivalent exists.

## Hard Rules — Web Only

- **Style Factory + cn() System**: Layout and page styles use `makeXxxStyles(colors: ThemeColors)` factory functions that return `CSSProperties` objects. These are applied via `style={{}}` props. Fit component internal classes use Tailwind utilities composed with `cn()` from `utils/cn.ts`. Do NOT use Tailwind utility classes directly on layout `div` elements — use style factories.
- **ThemeContext via CSS Variables**: `ThemeContext` injects CSS custom properties onto `document.documentElement` (e.g. `--fit-brand`, `--fit-surface`). The `tailwind.config.ts` maps these to Tailwind tokens (`brand`, `surface`, `border`, etc.). Never hardcode color hex values — use `colors.*` from `useTheme()` in style factories or `var(--fit-*)` in CSS.
- **"use client" is explicit**: Mark client components with `"use client"` as the first line. Most page and component files in `apps/web/` require `"use client"` due to `useTheme()`, `useAuth()`, and event handlers. Do NOT assume RSC is the default for pages that use context hooks.
- **Fit Components (Web)**: Use `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitInputField` from `@/components/fit/`. These components accept `className` for Tailwind extension and render HTML elements (`div`, `button`, `p`, `span`). Use `cn()` for conditional class composition within components.
- **No Reanimated**: `react-native-reanimated` is a native-only library. Use `useFadeIn`, `useThemeTransition` from `@/hooks/animations/` for web animations (CSS transitions via `CSSProperties`).

## Shared Package Rules

- Logic shared between both apps lives in `packages/`. Never duplicate a utility, type, or validation schema across apps.
- Do not import `react-native` in `packages/` — shared packages must be platform-agnostic.
- When a UI pattern is identical on both surfaces, propose moving it to `packages/ui` rather than duplicating.