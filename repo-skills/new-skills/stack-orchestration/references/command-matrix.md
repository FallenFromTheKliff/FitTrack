# FitTrack Stack Command Matrix

## Primary commands

| Intent | Command | Notes |
|---|---|---|
| Start standard stack | `pnpm dev:stack` | Supervisor-managed stack plus native Expo QR in the foreground |
| Start stack with AI | `pnpm dev:stack:ai` | Includes AI microservice plus native Expo QR |
| Check stack status | `pnpm dev:stack:status` | Reads the supervisor status |
| Stop supervised stack | `pnpm dev:stack:stop` | Stops the supervisor-owned processes |
| Start native Expo only | `pnpm dev:mobile` | Native Expo with QR |
| Start Expo web only | `pnpm dev:mobile:web` | Browser-focused Expo web run |
| Start infra only | `pnpm infra:up` | PostgreSQL and Redis |
| Stop infra only | `pnpm infra:down` | Shuts local infra down |
| Tail infra logs | `pnpm infra:logs` | Shows recent Docker Compose logs |

## Runtime shapes

| Shape | Primary command | Expected result |
|---|---|---|
| `api-only` | `pnpm dev:api` | Nest API only on `3001` |
| `web-plus-api` | `pnpm dev:stack` | Web on `8080`, API on `3001`, native Expo QR in foreground |
| `full-standard` | `pnpm dev:stack` | Standard local stack without AI microservice |
| `full-ai` | `pnpm dev:stack:ai` | Standard local stack plus AI microservice on `8000` |
| `native-only` | `pnpm dev:mobile` | Native Expo QR without the rest of the supervised stack |
| `expo-web-only` | `pnpm dev:mobile:web` | Expo web on `8081` |

## Health defaults

| Surface | Health or reachability signal |
|---|---|
| API | `http://127.0.0.1:3001/v1/health` |
| Web | `http://127.0.0.1:8080/login` |
| Mobile web | `http://127.0.0.1:8081/login` |
| AI | `http://127.0.0.1:8000/health` |
| Supervisor state | `.artifacts/dev-stack-manifest.json` plus `pnpm dev:stack:status` |

## Database helpers

| Intent | Command | Notes |
|---|---|---|
| Ensure local DB exists | `pnpm db:ensure-local` | Local DB bootstrap step |
| Generate Prisma client | `pnpm db:generate` | Required after schema changes |
| Push schema | `pnpm db:push` | Development-only schema push |
| Run migrate dev | `pnpm db:migrate` | Standard Prisma migration flow |
| Seed default data | `pnpm db:seed` | General seed entry point |
| Reset test seed | `pnpm db:seed:test` | Destructive test data reset |
| Additive test seed | `pnpm db:seed:test:additive` | Safer additive test data flow |
| Open Prisma Studio | `pnpm db:studio` | Local DB inspection |

## Log locations

| Source | Location |
|---|---|
| Supervisor manifest | `.artifacts/dev-stack-manifest.json` |
| Supervisor stdout | `.artifacts/dev-stack-supervisor.out.log` |
| Supervisor stderr | `.artifacts/dev-stack-supervisor.err.log` |
| API log | `.artifacts/api-stack.out.log` and `.artifacts/api-stack.err.log` |
| Web log | `.artifacts/web-stack.out.log` and `.artifacts/web-stack.err.log` |
| Mobile web log | `.artifacts/mobile-stack.out.log` and `.artifacts/mobile-stack.err.log` |
| AI log | `.artifacts/ai-stack.out.log` and `.artifacts/ai-stack.err.log` |

## Operator rules

- Prefer supervised stack commands over ad hoc start sequences when they exist.
- Prefer `pnpm dev:stack:status` before another start when the stack may already be watcher-owned.
- Prefer native QR commands when the user wants Expo Go.
- Prefer additive seed flows over destructive reset flows unless the request explicitly wants a reset.
- Treat missing Docker or missing system services as a machine issue, not a stack-orchestration issue.
