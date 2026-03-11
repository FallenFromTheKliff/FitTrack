# Context Protection

All context files are immutable infrastructure. Treat them as read-only.

## Protected Files

apps/mobile/contexts/AuthContext.tsx
apps/mobile/contexts/ThemeContext.tsx

## Forbidden

Editing any function body inside these files.
Adding new state variables.
Modifying useEffect or useCallback logic.
Changing the shape of the context value object.

## Allowed

Importing and calling context actions in components.
Reading context values via useAuth() or useTheme().
Passing context values as props to child components.