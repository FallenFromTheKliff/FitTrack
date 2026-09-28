import type { VisualRole, VisualSurface } from "../visual-fixtures.ts";

export type VisualSeedScenario =
  | "realistic-seed-admin-gym-operations"
  | "realistic-seed-member-home";

export type VisualSeedContract = {
  id: VisualSeedScenario;
  role: VisualRole;
  surface: VisualSurface;
  viewports: readonly string[];
  knownState: string;
};

const visualSeedContracts: Record<VisualSeedScenario, VisualSeedContract> = {
  "realistic-seed-admin-gym-operations": {
    id: "realistic-seed-admin-gym-operations",
    role: "admin",
    surface: "web",
    viewports: ["desktop-1920x1080"],
    knownState: "Authenticated admin Gym Operations schedule landing",
  },
  "realistic-seed-member-home": {
    id: "realistic-seed-member-home",
    role: "member",
    surface: "mobile",
    viewports: ["mobile-390x844"],
    knownState: "Authenticated member home shell at mobile viewport",
  },
};

export type VisualFixtureIdentity = {
  role: VisualRole;
  surface: VisualSurface;
  viewport: string;
};

export function getVisualSeedContract(
  scenario: string,
): VisualSeedContract | undefined {
  return visualSeedContracts[scenario as VisualSeedScenario];
}

/**
 * This is intentionally fail-closed: a case cannot merely name a plausible
 * seed. It has to use the allowlisted role, surface, viewport, and known state.
 */
export function assertVisualSeedScenario(
  scenario: string,
  fixture: VisualFixtureIdentity,
  expectedState?: string,
): VisualSeedContract {
  const contract = getVisualSeedContract(scenario);
  if (!contract) {
    throw new Error(`Unknown visual seed scenario: ${scenario || "<missing>"}`);
  }
  if (contract.role !== fixture.role) {
    throw new Error(
      `Visual seed scenario ${scenario} requires role ${contract.role}, received ${fixture.role}.`,
    );
  }
  if (contract.surface !== fixture.surface) {
    throw new Error(
      `Visual seed scenario ${scenario} requires surface ${contract.surface}, received ${fixture.surface}.`,
    );
  }
  if (!contract.viewports.includes(fixture.viewport)) {
    throw new Error(
      `Visual seed scenario ${scenario} is not approved for viewport ${fixture.viewport}.`,
    );
  }
  if (expectedState && contract.knownState !== expectedState) {
    throw new Error(
      `Visual seed scenario ${scenario} does not establish the declared expected state.`,
    );
  }
  return contract;
}
