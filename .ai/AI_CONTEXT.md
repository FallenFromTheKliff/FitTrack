# FitTrack Architectural Context

## Overview
FitTrack is a unified fitness platform for SertFit Gym. The codebase is a Turborepo monorepo sharing logic between a Next.js web dashboard and an Expo mobile app.

## Key Architectures
- **Theme-Driven UI**: The UI reacts instantly to theme changes (Dark/Light/Brand) via `ThemeContext` and Reanimated. This requires style factories that regenerate styles on theme change.
- **Shared Validation**: Form schemas are centralized in `packages/validators` to ensure consistent data entry on both platforms.
- **Component System**: The "Fit" system (e.g., `FitCard`) is the building block for all screens, providing consistent padding, borders, and interaction feedback.

## Operational Expectations
- The agent must always verify its work via Playwright screenshots.
- The agent must respect the "Frontend Only" boundary at all costs.