# Frontend Surgical Refactor Report

## Files Added

- `packages/app-config/index.ts`
- `packages/app-config/package.json`
- `packages/app-config/calendar.ts`
- `packages/app-config/chat.ts`
- `packages/app-config/mobile-labels.ts`
- `packages/app-config/mobile-settings.ts`
- `packages/app-config/shared-settings.ts`
- `packages/app-config/web-labels.ts`
- `packages/app-config/web-settings.ts`
- `packages/app-core/index.ts`
- `packages/app-core/package.json`
- `packages/app-core/auth/auth-session.ts`
- `packages/app-core/auth/createAuthController.ts`
- `packages/app-core/members/createMemberController.ts`
- `packages/app-core/schedule/createScheduleController.ts`
- `packages/app-core/theme/createThemeController.ts`
- `packages/app-core/theme/theme-state.ts`
- `packages/hooks/useTypewriter.ts`
- `packages/query/profile.ts`
- `packages/utils/collection.ts`
- `packages/utils/contrast.ts`

## Files Moved

- No physical file renames were performed.
- Shared frontend config and orchestration were extracted by copy-and-delete into `packages/app-config` and `packages/app-core`.

## Files Deleted

- `apps/web/data/chat/chat.ts`
- `apps/mobile/data/chat.ts`
- `apps/web/data/ui/calendar.ts`
- `apps/mobile/data/calendar.ts`
- `apps/web/data/ui/labels.ts`
- `apps/mobile/data/labels.ts`
- `apps/web/data/settings/settings.ts`
- `apps/web/hooks/animations/useTypewriter.ts`
- `apps/mobile/hooks/animations/text/useTypewriter.ts`
- `apps/mobile/utils/grouping.ts`
- `apps/web/utils/contrast.ts`

## Duplicate Findings

- Web and mobile shipped duplicate static chat seed data.
- Web and mobile shipped duplicate calendar constants and labels.
- Web and mobile shipped duplicate settings metadata, with mobile additionally coupling shared settings content to platform icons.
- Web and mobile each owned their own `useTypewriter` implementation.
- Web chat history and mobile grouping logic duplicated the same date-bucketing behavior.
- Web maintained its own readable-text-color helper that belonged in shared utilities.
- Web and mobile query client wrappers duplicated the same stable `QueryClient` creation pattern.
- Auth and theme contexts carried duplicated orchestration concerns that were broader than thin provider wrappers.
- Web and mobile profile update flows performed direct app-level transport calls that belonged in the query layer.

## Architectural Improvements Made

- Added `@fittrack/app-config` as the shared home for frontend-only static config:
  - chat data
  - calendar constants
  - shared labels
  - shared settings metadata
- Added `@fittrack/app-core` as the shared home for frontend orchestration:
  - auth session helpers and controller
  - theme state helpers and controller
  - member action controller
  - schedule action/controller mapping
- Reduced app-level API boundary leaks:
  - apps now rely on `@fittrack/query` for profile and booking mutations
  - auth and theme providers now delegate orchestration to shared controllers
  - app-local API client files remain thin bootstrap adapters only
- Reduced context weight:
  - `apps/web/contexts/AuthContext.tsx`
  - `apps/mobile/contexts/AuthContext.tsx`
  - `apps/web/contexts/ThemeContext.tsx`
  - `apps/mobile/contexts/ThemeContext.tsx`
  - `apps/web/contexts/MemberContext.tsx`
  - `apps/web/contexts/ScheduleContext.tsx`
- Centralized generic frontend helpers:
  - shared `useTypewriter` in `@fittrack/hooks`
  - shared `groupItemsByDate` and `getReadableTextColor` in `@fittrack/utils`
- Preserved platform boundaries:
  - web/mobile render components were not merged
  - mobile settings retained a local icon adapter in `apps/mobile/data/settings.ts`
  - platform-specific animation hooks stayed app-local

## Verification

- `pnpm typecheck` passed after the refactor.
- Search verification found no remaining app-level raw `webApiClient.*` or `mobileApiClient.*` calls inside `apps/web` or `apps/mobile`.
- Search verification found no remaining imports of the deleted duplicate chat/calendar/labels/typewriter/grouping/contrast modules.
- No Playwright verification was run because the refactor was internal and typecheck/search verification covered the changed boundaries.

## Unresolved Items

- The git worktree already contained unrelated modified files under `apps/api/` before this refactor. They were left untouched.
- The git worktree also contains unrelated pre-existing changes in other packages outside the surgical frontend scope. They were not normalized or reverted here.
- No backend review or api3 work was performed.

## Future Recommendations

- For a later api3 phase, migrate transport contracts in `packages/api-client` first, then adapt `packages/query`, then update `packages/app-core`, and only then touch app adapters.
- When api3 begins, keep the same boundary rule used here:
  - apps -> query -> api-client
  - shared orchestration -> app-core
  - static frontend metadata -> app-config
- Add dedicated package-level tests around auth/theme controllers before any api3 migration so behavior preservation is easier to validate.
