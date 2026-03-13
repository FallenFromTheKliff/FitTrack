# Styling & Design Rules

## Mobile (Expo)
- **Factory Pattern**: Styles must be generated using `makeXxxStyles(colors: ThemeColors)`.
- **Fit Components**: Use `FitText`, `FitButton`, `FitCard`, and `FitSection` for all UI elements.
- **Animations**: Use `react-native-reanimated` and `useThemeTransitionAnim` for theme-aware transitions.

## Web (Next.js)
- Use Tailwind CSS utility classes.
- Use `tailwind-merge` (twMerge) for conditional classes.

## Formatting
- No comments in code.
- Compact spacing: No excessive blank lines or vertical alignment.
- No trailing commas in objects/arrays.