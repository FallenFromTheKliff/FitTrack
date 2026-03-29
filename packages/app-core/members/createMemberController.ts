function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export function createMemberController() {
  return {
    toMessage,
    async runAction(action: () => Promise<void>, fallback: string) {
      try {
        await action();
        return { success: true as const };
      } catch (error: unknown) {
        return { success: false as const, error: toMessage(error, fallback) };
      }
    }
  };
}