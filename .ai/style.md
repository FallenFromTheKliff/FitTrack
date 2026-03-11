# Code Style

## Language

TypeScript strict mode only.

## Spacing

Compact. No vertical alignment. No excessive blank lines.

## Comments

Forbidden entirely.

## Styles (Mobile)

Factory functions only: makeXxxStyles(colors: ThemeColors) => StyleSheet.create({})
Never call StyleSheet.create directly inside a component body.
Never duplicate style properties across factory functions.

## Styles (Web)

Tailwind utility classes only. Use tailwind-merge for conditional classes.
No inline style objects unless consuming a dynamic theme color.

## Component Conventions

Mobile text → FitText or AnimatedFitText
Mobile buttons → FitButton with correct variant
Mobile inputs → FitInputField with react-hook-form Controller
Animated views → Animated.View with useAnimatedStyle
Never use React Native's built-in Animated API — always use Reanimated.

## Naming

Style factories: makeXxxStyles
Animation hooks: useXxxAnim
Screen files: match expo-router filename convention

## File Extensions

All files: .ts or .tsx only
Components and pages: .tsx
Utilities, configs, hooks, types: .ts
Never: .js, .jsx, .mjs, .cjs

## Assistant / Agent Rule

- The AI assistant (and automated tools) must never create, convert, or commit any JavaScript files (.js, .jsx, .mjs, .cjs) in this repository.
- All future edits, new files, and automated transformations must produce only `.ts` or `.tsx` files.
- If a JavaScript file is discovered that was created by the assistant in error, the assistant must list it and delete it immediately, then report the deletions.