# Module Template

Use this as the default shape for new non-trivial backend work.

## Simple module

Use this only when the module stays small and the repo already uses service-to-Prisma directly nearby.

```text
src/<domain>/<module>/
  dto/
    <module>.dto.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.module.ts
  <module>.spec.ts
```

## Preferred non-trivial module

```text
src/<domain>/<module>/
  dto/
    <module>.dto.ts
  events/
    <module>-created.event.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  <module>.module.ts
  <module>.spec.ts
```

## Lifecycle-enabled module

Use this when the flow needs scheduled jobs, delayed state changes, or queue-backed side effects.

```text
src/<domain>/<module>/
  dto/
    <module>.dto.ts
  events/
    <module>-confirmed.event.ts
    <module>-cancelled.event.ts
  <module>.constants.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  <module>-lifecycle.service.ts
  <module>-lifecycle.processor.ts
  <module>.module.ts
```

## Multi-module domain root

Keep the domain root thin when the domain owns multiple business modules.

```text
src/<domain>/
  <domain>.module.ts
  <shared-constants>.ts
  <module-a>/
  <module-b>/
```

Current repo examples:

- `src/auth/otp/`
- `src/membership/subscription/`
- `src/membership/payment/`

## Controller scaffold

```ts
@ApiTags('<Domain Tag>')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('<route>')
export class <Module>Controller {
  constructor(private readonly service: <Module>Service) {}

  @Get()
  @ApiOperation({ summary: '<summary>' })
  list(@Query() dto: <FilterDto>) {
    return this.service.list(dto)
  }
}
```

Rules:

- add `RolesGuard` only when role filtering is needed
- use `@CurrentUser()` for authenticated actor context
- keep method bodies thin

## Service scaffold

```ts
@Injectable()
export class <Module>Service {
  constructor(
    private readonly repo: <Module>Repository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(actorId: string, dto: Create<Module>Dto) {
    const created = await this.repo.create(actorId, dto)
    this.eventEmitter.emit('<event>', { id: created.id })
    return created
  }
}
```

Rules:

- services own orchestration, not raw route parsing
- map DTO patch objects in helpers when the input gets wide
- move repeated Prisma logic down into repositories

## Repository scaffold

```ts
@Injectable()
export class <Module>Repository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string) {
    const record = await this.prisma.<model>.findUnique({ where: { id } })
    if (!record) {
      throw new NotFoundException('<resource> not found.')
    }
    return record
  }
}
```

Rules:

- repositories own Prisma shape, include or select decisions, and transaction-safe helpers
- translate missing-record persistence failures into domain-safe exceptions

## Module wiring scaffold

```ts
@Module({
  controllers: [<Module>Controller],
  providers: [<Module>Service, <Module>Repository],
  imports: [PrismaModule],
  exports: [<Module>Service],
})
export class <Module>Module {}
```

Add queue imports or Bull feature registration only when the module truly owns lifecycle jobs.
