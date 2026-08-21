export function toActionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export async function runAsyncAction(action: () => Promise<void>, fallback: string) {
  try {
    await action();
    return { success: true as const };
  } catch (error: unknown) {
    return { success: false as const, error: toActionErrorMessage(error, fallback) };
  }
}
