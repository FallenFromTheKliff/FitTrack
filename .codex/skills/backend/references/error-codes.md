# Error Codes And Failure Semantics

This reference summarizes the error vocabulary already visible in the repo.

## Standard problem `type` values

| Type | Typical status | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Invalid input, upload failure, malformed request, or bad manual action |
| `UNAUTHORIZED` | 401 | Missing or invalid credentials |
| `FORBIDDEN` | 403 | Authenticated but not allowed for the resource or role |
| `NOT_FOUND` | 404 | Required resource does not exist |
| `CONFLICT` | 409 | State conflict, duplicate action, or already-finalized resource |
| `GONE` | 410 | Resource is intentionally unavailable, archived, or expired |
| `UNPROCESSABLE_ENTITY` | 422 | Validation passed structurally but business data is insufficient |
| `LOCKED` | 423 | Resource is temporarily locked or blocked |
| `TOO_MANY_REQUESTS` | 429 | Throttling or rate-limit response |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeds configured max size |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server failure |

## Security and auth semantics

- Login and identity lookup flows may intentionally use nullable repository reads to preserve `401` semantics instead of leaking whether an account exists.
- Protected endpoints should fail through `JwtAuthGuard` or `RolesGuard`, not ad hoc controller branching.
- Do not convert every absence into `404` when the existing flow intentionally returns `401` or `200` for security reasons.

## Business-rule patterns already visible in the repo

- Subscription-gated attendance and booking flows use `403` when access is denied by business policy.
- Duplicate or conflicting transitions use `409`, such as already checked-in or already finalized operations.
- Pending or archived conversational resources may surface `410` when the client should stop using that resource.
- Empty measurement or structurally valid but unusable body payloads can use `422`.

## File and upload semantics

- Oversized files are normalized to:

```json
{
  "type": "PAYLOAD_TOO_LARGE",
  "title": "File Too Large",
  "status": 413,
  "detail": "Files must be <n> MiB or smaller."
}
```

- Generic malformed upload errors normalize to a `400 BAD_REQUEST` problem body.

## What to avoid

- leaking raw Prisma error codes or SQL errors into HTTP responses
- returning plain `{ message: ... }` objects for new endpoints
- inventing one-off error envelope shapes
- using `500` for business-rule failures that already map to a narrower HTTP status
