# Architecture - FitTrack
Reference this file when writing NestJS code for the project.

---

## Repo Layout

Current root layout:

```text
CapstoneBackend/
|- agents/                # agent workflow docs
|- context/               # system design docs by domain
|- tasks/                 # task tracking docs
`- capstone-backend/      # NestJS application
   |- src/
   |- prisma/
   `- test/
```

Important note:
- `agents/`, `context/`, and `tasks/` are real top-level folders.
- Do not use old `ai/...` paths in prompts or docs.
- This `agents/architecture.md` file is the canonical shared architecture
  guide for repo-wide conventions. Do not create competing app-local copies for
  the same rules.

---

## Architecture Authority and Serena

- `agents/architecture.md` is authoritative for repo-wide coding conventions.
- Serena and other MCPs may help inspect existing code patterns, but codebase drift alone does not replace the rules in this file.
- If a task proves a new stable reusable repo convention, the task may update this file explicitly.
- When this file is updated for a proven reusable convention, log the reusable decision in the active domain `decisions.md`.
- Do not update this file for one-off local implementations or speculative improvements.

---

## Current App Structure

Current implemented app modules under `capstone-backend/src/`:

```text
audit/
auth/
common/
config/
files/
jwt/
mail/
membership/
prisma/
queue/
user/
```

Target domain roadmap from the context docs still includes future domains such as payments, bookings, coaching, training, nutrition, inventory, notifications, analytics, and AI. Treat those as planned domains unless the folder already exists in `src/`.

Important naming note:
- The current S3 module path is `src/user/`, not `src/users/`.

Important structure note:
- Some domains can contain multiple business modules.
- Current examples already in the repo:
  - `src/auth/otp/`
  - `src/membership/subscription/`
  - `src/membership/payment/`

---

## Layering Pattern

Use this as the default application flow:

```text
Controller -> Service -> Repository -> BaseRepository -> Prisma
```

Rules:
- Controllers handle routing, guards, params, DTOs, and response metadata.
- Services coordinate business flow, authorization decisions, events, and cross-repository work.
- Repositories encapsulate Prisma access for non-trivial modules.
- `BaseRepository` in `src/common/base-repository/` is the shared CRUD and pagination foundation.
- Never call Prisma directly from controllers.
- Cross-domain business reads should prefer an exported service from the owning domain instead of duplicating another domain's repository or Prisma rules.

Simple modules can still use direct service-to-Prisma access if no repository exists yet, but new non-trivial work should prefer the existing repository pattern.

---

## Current Common Components

Use current names from the repo:

- `HttpExceptionFilter`
- `ResponseInterceptor`
- `JwtAuthGuard`
- `RolesGuard`
- `@CurrentUser()`
- `@Roles()`

Do not assume `@Public()` exists unless it has been added to the repo. Public routes can remain unguarded explicitly until that decorator is introduced.

---

## Auth and JWT Conventions

Current project decision:
- JWT uses HS256 with the configured secret
- RS256 is not the active project standard

Current payload shape:

```ts
interface JwtPayload {
  sub: string;
  role: UserRole;
  status: UserStatus;
  jti: string;
  iat: number;
  exp: number;
}
```

Use `@CurrentUser()` to access the authenticated payload in controllers.

---

## DTO and Validation Pattern

DTOs should:
- use `class-validator`
- use `@ApiProperty` / `@ApiPropertyOptional`
- use shared validators from `src/common/validators/` when the rule already exists
- keep messages user-readable and field-specific

Examples of shared validation that now exist in the repo:
- allowed email domains
- strong password policy
- OTP code validation
- Philippine mobile number format
- trimmed name/string helpers
- date range validation

Do not duplicate large validator stacks inline if a shared decorator already covers the rule.

---

## Controller Pattern

Default controller expectations:
- add `@ApiTags(...)`
- add route-level guards where needed
- use DTOs for body/query params
- keep controllers thin
- do not manually send responses with `res.status().json()` unless there is a very specific framework need

Example shape:

```ts
@ApiTags('users')
@Controller('v1/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.getMyProfile(user.sub);
  }
}
```

---

## Service and Repository Pattern

Service example:

```ts
@Injectable()
export class ResourceService {
  constructor(private readonly repo: ResourceRepository) {}

  async findOne(id: string): Promise<Resource> {
    return this.repo.findByIdOrThrow(id);
  }
}
```

Repository example:

```ts
@Injectable()
export class ResourceRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findByIdOrThrow(id: string) {
    return super.findByIdOrThrow<Resource>(this.prisma.resource, id, 'Resource');
  }
}
```

Use repositories when:
- a module already has one
- multiple Prisma queries or reusable query helpers are involved
- shared pagination, ownership, or base-repository helpers help reduce duplication

---

## Shared Domain Rules

These rules apply to current S4 work and future domain work unless a newer
shared architecture rule explicitly supersedes them.

### Multi-Module Domain Structure

- Keep the domain root thin.
- If a domain contains multiple business modules, each module must live in its
  own subfolder.
- Controllers, services, repositories, DTOs, events, and tests should live
  beside the module that owns them.
- Use this pattern for future domains too, not only current ones.

### Repository Contracts

- Use nullable `find*` methods only when "not found" is a valid business state.
- Use explicit `*OrThrow` methods for required records.
- Services must not rely on raw Prisma failures or null access to prove that a
  record exists.
- Repository methods must convert missing-record persistence failures into
  domain-safe HTTP exceptions.

### Service Null-Safety

- Services must use non-null repository contracts before reading or mutating
  required related data.
- Do not use non-null assertions such as `value!` after manual existence
  checks.
- Do not silently optional-chain required aggregate data.

### Update Mapping

- Do not keep large inline `if (dto.field !== undefined)` ladders inside
  service methods.
- Use mapper helpers such as `pickDefined` for patch inputs.
- Keep special transforms explicit inside those helpers.

### Transactions and Side Effects

- Multi-write database flows must be transactional when the writes must succeed
  together.
- External side effects should happen after the required database state is
  committed.
- Events and audit logs should only be emitted after the underlying state
  transition is valid.
- External payment-provider calls should live behind a dedicated service
  boundary in the payment submodule, not inline in controllers or unrelated
  services.
- Payment initiation flows should converge on shared payment events such as
  `payment.completed` so manual approvals, gateway webhooks, and future domains
  activate the same downstream business logic.

### Testing

- Every meaningful domain refactor should add or preserve tests for:
  - missing required records
  - ownership and access-control boundaries
  - invalid state transitions
  - nullable no-op paths where absence is intentional
  - domain invariants introduced by the refactor

### Reference Domain Notes

- `capstone-backend/docs/architecture/user-domain-principles.md`
- `capstone-backend/docs/architecture/auth-domain-principles.md`
- `capstone-backend/docs/architecture/membership-domain-principles.md`
- `capstone-backend/docs/architecture/domain-folder-conventions.md`

---

## Queues

The current queue stack uses Bull, not BullMQ:

- `@nestjs/bull`
- `bull`

Use current queue patterns from `src/queue/` and existing processors before introducing new queue conventions.

---

## Errors and Responses

Use Nest HTTP exceptions.
Prefer RFC-7807 shaped exception bodies when the module already uses them.

Examples:

```ts
throw new NotFoundException('User not found');

throw new ConflictException({
  type: 'CONFLICT',
  title: 'Email Already Registered',
  status: 409,
  detail: 'An account with this email already exists.',
});
```

Do not throw raw `Error` for request-facing failures.

---

## Testing

Valid test targets include:
- service specs
- repository specs
- DTO specs
- shared validator specs
- e2e tests in `capstone-backend/test/`

Every meaningful new logic path should be covered somewhere appropriate. Not every task must force a service-only test if the change is really in DTOs or validators.

---

## Practical Standards

Good code in this repo means:
- typed method returns
- no Prisma in controllers
- business logic not buried in controllers
- repository helpers used when they reduce duplication
- shared validators reused when appropriate
- no avoidable secrets in responses
- no unapproved packages
- no unnecessary process overhead for small capstone tasks
