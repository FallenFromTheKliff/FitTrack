# API Client And Query Layer

The frontend data layer is intentionally centralized.

## Shared API client

Core files:

- `packages/api-client/index.ts`
- `packages/api-client/request.ts`
- `packages/api-client/transport/createAxiosTransport.ts`

Rules:

- create or extend domain clients in `packages/api-client/domains/`
- unwrap success data through the shared request helpers
- keep transport concerns like authorization headers and auth-failure handling inside the shared client layer

## Platform clients

Web:

- `apps/web/lib/api-client.ts`
- tokens stored through `createTokenStore` backed by `localStorage`
- auth failure clears tokens and redirects to `/login`

Mobile:

- `apps/mobile/lib/api-client.ts`
- tokens stored through `createTokenStore` backed by `AsyncStorage`
- auth failure fans out through subscribed listeners instead of hard-coded navigation in the transport layer

## Query layer

Core files:

- `packages/query/query-client.ts`
- `packages/query/query-keys.ts`
- domain query files like `packages/query/bookings.ts` and `packages/query/auth.ts`

Rules:

- add query and mutation option factories in `packages/query/<domain>.ts`
- keep invalidation rules close to the mutation options
- use those factories in hooks or contexts, not direct inline `useQuery({ queryFn: ... })` unless the feature is truly one-off and still consistent with nearby code

## Controller helpers

Representative files:

- `packages/app-core/auth/createAuthController.ts`
- `packages/app-core/schedule/createScheduleController.ts`

Use controller helpers when:

- multiple screens or contexts need the same action orchestration
- UI-specific error mapping or session handling should stay out of route files

## Field and contract alignment

Rules:

- keep transport or contract transforms near `packages/api-client` or `packages/query`
- do not scatter raw backend field remapping across components
- prefer one shared transform over repeated manual mapping inside pages or modals
