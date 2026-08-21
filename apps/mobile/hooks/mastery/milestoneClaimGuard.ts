export function createMilestoneClaimGuard() {
  const inFlight = new Set<string>();

  return {
    isInFlight(milestoneDefinitionId: string) {
      return inFlight.has(milestoneDefinitionId);
    },
    async run(
      milestoneDefinitionId: string,
      claim: () => Promise<void>,
    ): Promise<boolean> {
      if (inFlight.has(milestoneDefinitionId)) return false;
      inFlight.add(milestoneDefinitionId);
      try {
        await claim();
        return true;
      } finally {
        inFlight.delete(milestoneDefinitionId);
      }
    },
  };
}
