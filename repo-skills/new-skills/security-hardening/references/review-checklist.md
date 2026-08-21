# FitTrack Security Review Checklist

## Authentication and session

- Verify the route or workflow requires the correct auth guard.
- Verify refresh or token-storage changes do not silently widen access.
- Verify account-switch or impersonation flows cannot bleed state across users.

## Authorization and exposure

- Verify the role check matches the data returned, not just the route label.
- Verify list endpoints do not expose extra fields through DTO drift.
- Verify error messages do not reveal secrets, identifiers, or internal-only detail unnecessarily.

## Validation and persistence

- Verify DTOs reject unexpected fields and invalid enum or ID values.
- Verify repositories do not accept cross-tenant or cross-user IDs without ownership checks.
- Verify audit or interaction logs do not persist secrets, raw tokens, or sensitive payloads without need.

## External and AI-facing paths

- Verify outgoing payloads to AI or third parties contain only needed data.
- Verify callback or webhook routes validate signatures or trusted context.
- Verify prompt or grounding payloads do not include unnecessary PII.
