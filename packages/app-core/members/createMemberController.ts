import { runAsyncAction, toActionErrorMessage } from "../shared/action-helpers";

export function createMemberController() {
  return {
    toMessage: toActionErrorMessage,
    async runAction(action: () => Promise<void>, fallback: string) {
      return runAsyncAction(action, fallback);
    }
  };
}
