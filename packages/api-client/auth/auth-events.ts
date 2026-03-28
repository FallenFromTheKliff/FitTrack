import type { Awaitable } from "./token-store";

export interface AuthEvents {
  onAuthFailure?: () => Awaitable<void>;
}
