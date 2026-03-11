# FitTrack Agent

Frontend-only Turborepo monorepo for SertFit Gym.

## Stack

TypeScript · Next.js (apps/web) · Expo with expo-router (apps/mobile) · TanStack Query v5

## Hard Rules

- Frontend only. No backend, no API routes, no server code.
- Never modify CRUD logic inside any context file.
- Preserve all existing UI design and flow.
- No duplicate logic, styling, or components.
- No comments. Compact spacing. No vertical alignment.

## Shared Package Imports

@fittrack/ui — themes, tokens, R, MAX_WIDTH, FONT_FAMILIES
@fittrack/types — AuthUser, ThemeColors, ThemeKey, FontKey, ThemeSettings
@fittrack/utils — formatDate, formatDateTime, timeAgo, calcBMI, formatCurrency, slotLabel
@fittrack/validators — loginSchema, registerSchema, profilePersonalSchema, profileBodySchema, changePasswordSchema, addProductSchema, createBookingSchema
@fittrack/query — makeQueryClient

## Visual Workflow

Before editing any screen component, use Playwright to screenshot the current state and describe it.
After editing, screenshot again and confirm the change is visible.

## Session Start Behavior

At the start of every session:

1. Read .ai/tasks.md to understand current priorities.
2. Read AI_CONTEXT.md for architectural context.
3. Use Playwright to screenshot the current running app before making any changes.
4. Confirm which localhost is running before acting.
