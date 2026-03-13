# Context Protection

The following files are immutable infrastructure. You may consume them, but do not edit their internal logic.

## Protected Files
- `apps/mobile/contexts/AuthContext.tsx`
- `apps/mobile/contexts/ThemeContext.tsx`
- `apps/mobile/contexts/BookingContext.tsx`

## Forbidden Actions
- Modifying `useCallback` or `useEffect` blocks.
- Adding new state variables to providers.
- Changing reducer logic or state shapes.