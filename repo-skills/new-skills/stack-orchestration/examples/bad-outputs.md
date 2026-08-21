# Bad Outputs

- Telling the user to repair Docker Desktop or WSL as if that were part of normal stack orchestration.
- Suggesting `expo start --web` when the user asked for a QR code.
- Giving a command without stating whether it starts web, native QR, or AI-enabled runtime.
- Recommending another `pnpm dev:stack` run without checking whether the supervisor already owns the stack.
- Choosing a destructive seed reset when an additive seed would satisfy the request.
- Treating an Expo restart loop as proof that the whole stack is down without checking status, manifest, or logs.
