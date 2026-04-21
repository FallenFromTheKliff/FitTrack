# Route Map

This is the current discovered route and surface map for the repo.

## Web routes

Public:

- `/login` -> `apps/web/app/(auth)/login/page.tsx`
- `/locked` -> `apps/web/app/(auth)/locked/page.tsx`
- `/payments/success` -> `apps/web/app/payments/success/page.tsx`
- `/payments/cancel` -> `apps/web/app/payments/cancel/page.tsx`

Admin or staff:

- `/dashboard` -> `apps/web/app/(admin)/dashboard/page.tsx`
- `/ai` -> `apps/web/app/(admin)/ai/page.tsx`
- `/settings` -> `apps/web/app/(admin)/settings/page.tsx`

Role-conditioned management:

- `/members` -> `apps/web/app/(admin)/members/page.tsx`
- `/schedule` -> `apps/web/app/(admin)/schedule/page.tsx`
- `/profile` -> `apps/web/app/(admin)/profile/page.tsx`

Admin-only surfaces:

- `/facilities` -> `apps/web/app/(admin)/facilities/page.tsx`
- `/inventory` -> `apps/web/app/(admin)/inventory/page.tsx`
- `/analytics` -> `apps/web/app/(admin)/analytics/page.tsx`

## Mobile Expo Router routes

Auth group:

- `/(auth)/login` -> `apps/mobile/app/(auth)/login.tsx`
- `/(auth)/register` -> `apps/mobile/app/(auth)/register.tsx`

Tabs group:

- `/(tabs)/index` -> `apps/mobile/app/(tabs)/index.tsx`
- `/(tabs)/home` -> `apps/mobile/app/(tabs)/home.tsx`
- `/(tabs)/facilities` -> `apps/mobile/app/(tabs)/facilities.tsx`
- `/(tabs)/bookings` -> `apps/mobile/app/(tabs)/bookings.tsx`
- `/(tabs)/nutrition` -> `apps/mobile/app/(tabs)/nutrition.tsx`
- `/(tabs)/workout` -> `apps/mobile/app/(tabs)/workout.tsx`
- `/(tabs)/chathistory` -> `apps/mobile/app/(tabs)/chathistory.tsx`
- `/(tabs)/chatbot` -> `apps/mobile/app/(tabs)/chatbot.tsx`
- `/(tabs)/profile` -> `apps/mobile/app/(tabs)/profile.tsx`
- `/(tabs)/settings` -> `apps/mobile/app/(tabs)/settings.tsx`

## Current verification snapshot from Notion

Passed web surfaces:

- login
- locked
- dashboard
- members
- schedule
- ai
- settings
- profile
- facilities
- inventory
- analytics

Deferred external web surfaces:

- payments-success
- payments-cancel

Passed mobile Expo-web surfaces:

- login
- register
- home
- facilities
- bookings
- nutrition
- chathistory
- chatbot
- profile
- settings

Current mobile blocker:

- workout live pose happy path still needs a camera-capable Expo-web session
