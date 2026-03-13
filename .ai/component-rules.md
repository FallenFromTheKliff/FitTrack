# Component Rules

- UI components that appear in both Web and Mobile must be moved to `packages/ui`.
- Mobile components must use the "Animated" variants (e.g., `AnimatedFitText`) when they need to react to theme changes.
- All forms must use `react-hook-form` and shared Zod validators.