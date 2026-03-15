# FitTrack Agent — Redirect

All configuration, behavioral rules, and architectural context for FitTrack are located in the `.ai/` directory.

| Rule file | Contents |
|---|---|
| `.ai/agent.md` | Initialization procedure, role definition, hard rules per platform |
| `.ai/AI_CONTEXT.md` | Full architecture for both Mobile and Web, audience split, auth flows, routing |
| `.ai/monorepo.md` | Package structure, routing conventions, data layer, hooks, style file locations |
| `.ai/style.md` | Mobile factory + Reanimated, Web factory + cn() + Tailwind, shared token mapping |
| `.ai/context-protection.md` | Protected files list, forbidden actions, permitted additive changes |
| `.ai/component-rules.md` | Fit component system for both platforms, modal rules, file location rules |
| `.ai/performance.md` | Reanimated rules (Mobile), style factory memoization, Web Recharts/Tailwind/data rules |

## Quick Routing Reference

- Working on `apps/mobile/`? → Mobile rules apply (Expo, React Native, Reanimated, StyleSheet factories).
- Working on `apps/web/`? → Web rules apply (Next.js, HTML, CSSProperties factories, cn()/Tailwind).
- Working on `packages/`? → Shared rules apply (platform-agnostic, no RN, no Next imports).

## Key Differences at a Glance

| | Mobile | Web |
|---|---|---|
| Style system | `StyleSheet.create({})` factories | `CSSProperties` object factories |
| Animation | `react-native-reanimated` | CSS transitions via `useFadeIn`, `useThemeTransition` |
| "use client" | N/A (all client) | Required on any file using hooks, state, or events |
| Component classes | N/A | `cn()` with Tailwind utilities inside Fit components |
| Modals close on outside tap | Never (blocked) | Yes (standard web UX) |
| Auth context API | login, logout, updateUser, changePassword, deleteUser, sendOTP, verifyOTP, commitLogin, markOTPVerified | login, logout, updateUser, register, sendOTP, verifyOTP |
| Dev port | 8081 | 8080 |