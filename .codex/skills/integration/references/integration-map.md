# Integration Map

This is the seeded repo snapshot for the integration skill. Treat Notion as the long-lived source of truth after setup.

## Long-lived anchors

- Notion parent page: `System Gap Analysis`
- Canonical live execution board: `Task Queue`
- Primary runtime evidence tracker: `Surface Verification Tracker`
- Snapshot and accomplishment log: `Integration Map and Accomplishments`
- Refactor intake: `Refactor Requests`
- Domain detail pages: `Domain - auth`, `Domain - user`, `Domain - membership`, `Domain - bookings`, `Domain - coaching`, `Domain - nutrition`, `Domain - fitness`, `Domain - inventory`, `Domain - analytics`, `Domain - notifications`, `Domain - gym-layout`, `Domain - audit`, `Domain - ai`, `Domain - files`

## Shared integration spine

- Backend lives in `apps/api`
- Web lives in `apps/web`
- Mobile lives in `apps/mobile`
- Shared transport lives in `packages/api-client`
- Shared query and invalidation lives in `packages/query`
- Shared UI orchestration helpers live in `packages/app-core`
- Shared contract types and validators live in `packages/types` and `packages/validators`

## Feature snapshot

| Feature | Backend owner | Frontend consumers | Shared bridge | Current status |
| --- | --- | --- | --- | --- |
| Auth and session | `auth`, `user` | web login and locked, mobile login and register | `api-client/auth`, `api-client/users`, `query/auth`, `app-core/auth` | web and mobile auth flows passed |
| Profile and settings | `user`, `notifications`, `membership` | web profile and settings, mobile profile and settings | `query/profile`, `query/notifications`, `query/membership` | web passed, mobile passed |
| Facilities and gym layout | `gym-layout`, `bookings`, venue data modules | web facilities, mobile facilities | `api-client/venues`, `api-client/gym-layout`, matching query files | web passed, mobile passed |
| Bookings and schedule | `bookings`, `coaching`, `membership` | web schedule, mobile bookings | `query/bookings`, `query/appointments`, `app-core/schedule` | web schedule passed, mobile bookings passed with PayMongo deferred |
| AI chat history and chat | `ai` | web ai, mobile chathistory and chatbot | `api-client/ai`, `query/ai` | passed after session-contract fixes |
| Nutrition | `nutrition` | mobile nutrition | `api-client/nutrition`, `query/nutrition` | mobile passed |
| Fitness, workout, and pose | `fitness` | mobile workout | `api-client/fitness`, `query/fitness` | mobile workout still blocked on camera-capable Expo-web verification |
| Inventory | `inventory` | web inventory | `api-client/inventory`, `query/inventory` | web passed |
| Analytics | `analytics` | web analytics | `api-client/analytics`, `query/analytics` | web passed |
| Payment return pages | `membership/payment` | web payments success and cancel | membership transport and shared config | deferred external while PayMongo initiation remains disabled |

## Shared contract defaults

- Success responses use `{ data, meta? }`
- Errors use RFC7807-style problem details
- Web auth tokens live in `localStorage`
- Mobile auth tokens live in `AsyncStorage`
- Both surfaces route data access through the shared API client and query packages

## Known open follow-ups

- Mobile workout live pose happy path still needs a camera-capable Expo-web session.
- PayMongo checkout initiation remains intentionally deferred.
- Membership-card rollout and return-page behavior still depend on payment-flow follow-up.
- Optional coaching add-on behavior still has product or contract follow-up work.
- Mobile Google OAuth remains backlog work.
- AI floating-chat or chat-launch polish remains backlog work.
