# Context Protection

Context and shared-client files are high blast-radius surfaces. Read them when needed, but keep edits narrow and contract-preserving.

## Mobile Protected Surfaces

### High Caution

- `apps/mobile/contexts/AuthContext.tsx`
- `apps/mobile/contexts/ThemeContext.tsx`
- `apps/mobile/contexts/FABStateContext.tsx`
- `apps/mobile/contexts/FitnessContext.tsx`
- `apps/mobile/lib/api-client.ts`
- `apps/mobile/lib/queryClient.tsx`

### Mobile Rules

- Do not change token storage keys, AsyncStorage schemas, or auth failure semantics without explicit approval.
- Do not add global state to a provider when feature-local state, query cache, or an app-core controller is enough.
- Public context APIs should be additive and backward-compatible.
- Theme changes must preserve existing theme keys, font keys, animation levels, and transition behavior.

## Web Protected Surfaces

### High Caution

- `apps/web/contexts/AuthContext.tsx`
- `apps/web/contexts/ThemeContext.tsx`
- `apps/web/contexts/MemberContext.tsx`
- `apps/web/contexts/ScheduleContext.tsx`
- `apps/web/contexts/AnalyticsSectionFilterContext.tsx`
- `apps/web/lib/api-client.ts`
- `apps/web/lib/queryClient.tsx`
- `apps/web/lib/portal-access.ts`

### Web Rules

- Do not change CSS variable injection or `dark` class behavior in `ThemeContext` without explicit approval.
- Do not change localStorage token key formats or auth redirect behavior casually.
- Keep public context APIs backward-compatible for existing consumers.
- Prefer `@fittrack/query` and `@fittrack/app-core` for context internals instead of embedding request and transform logic in providers.
- When changing context values, scan all consumers first.

## Shared Package Protection

| Package | Rule |
|---|---|
| `packages/api-client` | Additive domain clients/types preferred; do not break exported API shape |
| `packages/query` | Query keys, option factories, and invalidation helpers must stay backward-compatible |
| `packages/app-core` | Controllers/transforms should be pure, platform-neutral, and covered by consumer scans |
| `packages/types` | Additive type changes preferred; avoid renames/removals |
| `packages/validators` | Do not weaken schemas without explicit product reason |
| `packages/ui` | Do not rename tokens, theme keys, fonts, radii, or exported constants casually |
| `packages/hooks` | Keep hooks pure React and platform-neutral |
| `packages/utils` | Keep helpers platform-neutral and deterministic |

## Backend Boundary

- Backend edits are outside frontend-agent scope unless explicitly requested.
- Backend reads should be rare and used only when contract truth cannot be resolved through shared packages, current frontend usage, Swagger, or Notion.
- Never copy secrets from `.env`, Notion, logs, or config into docs or chat responses.