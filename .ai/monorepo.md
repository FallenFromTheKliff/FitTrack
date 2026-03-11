# Monorepo Structure

Turborepo + pnpm workspaces.

## Applications

apps/web — Next.js web application
apps/mobile — Expo mobile application (expo-router, file-based routing)

## Shared Packages

packages/ui — @fittrack/ui — themes, design tokens, tailwind preset
packages/types — @fittrack/types — all shared TypeScript interfaces
packages/utils — @fittrack/utils — date, BMI, currency, slot helpers
packages/validators — @fittrack/validators — all Zod schemas
packages/query — @fittrack/query — TanStack Query client factory

## Import Rules

Always import shared types from @fittrack/types.
Always import theme colors and tokens from @fittrack/ui.
Always import utilities from @fittrack/utils.
Always import Zod schemas from @fittrack/validators.
Never re-declare types or utilities that already exist in packages.

## Path Aliases

apps/mobile: @/_ → apps/mobile/_
apps/web: @/_ → apps/web/_
