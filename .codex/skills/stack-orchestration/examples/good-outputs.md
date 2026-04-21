# Good Outputs

## Example: start native QR with backend and AI

- Use `pnpm dev:stack:ai`.
- This starts the supervised stack and then launches native Expo with the QR code in the foreground terminal.
- Health targets after startup:
  - API: `http://127.0.0.1:3001/v1/health`
  - Web: `http://127.0.0.1:8080/login`
  - AI: `http://127.0.0.1:8000/health`
- If the user only needs native Expo without the rest of the stack, use `pnpm dev:mobile`.

## Example: verify whether the stack is already running

- Use `pnpm dev:stack:status` first because `pnpm dev:stack` is supervisor-owned.
- If the manifest and status already show the stack as healthy, do not recommend another start command.
- If the status is stale, point the operator to the relevant `.artifacts/*.log` file before guessing.

## Example: reseed without wiping everything else

- Use `pnpm db:seed:test:additive` first.
- Use `pnpm db:seed:test` only when the operator explicitly wants the destructive reset flow.
