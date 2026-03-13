# Monorepo Structure

## Applications
- **apps/web**: Next.js application.
- **apps/mobile**: Expo application with `expo-router`.

## Shared Packages (@fittrack/*)
- **ui**: Design tokens (R, colors), `Fit` components, and Tailwind presets.
- **types**: Shared TypeScript interfaces like `AuthUser`, `Booking`, and `ThemeColors`.
- **utils**: Helpers for formatting, BMI, and currency.
- **validators**: Zod schemas (e.g., `profilePersonalSchema`, `loginSchema`).
- **query**: TanStack Query client factory.

## Import Rules
- Always use path aliases: `@/*` for local app files.
- Import shared logic from `@fittrack/` packages; never duplicate logic across apps.