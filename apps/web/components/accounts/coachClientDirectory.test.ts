function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

async function runCoachClientDirectoryRegression() {
  const {
    filterCoachClientsBySessionStatus,
    mapCoachClientToMember,
    retainOrSelectCoachClient,
  } = await import("./coachClientDirectory");
  const { createApiClient } = await import("@fittrack/api-client");
  const { coachClientsQueryOptions } = await import("@fittrack/query");
  const member = mapCoachClientToMember({
    coach_id: "coach-1",
    created_at: "2026-08-12T00:00:00.000Z",
    id: "relationship-1",
    member: {
      email: "jamie@example.com",
      email_verified: true,
      id: "member-1",
      last_check_in_at: "2026-08-11T08:00:00.000Z",
      membership_card: { status: "active" },
      phone_no: "+639171234567",
      phone_verified: true,
      profile: {
        avatar_url: null,
        activity_level: "active",
        date_of_birth: "1995-01-01",
        fitness_goal: "strength",
        first_name: "Jamie",
        gender: "other",
        height_cm: 170,
        last_name: "Rivera",
        membership_type: "premium",
        weight_kg: 70,
      },
    },
    member_id: "member-1",
    updated_at: "2026-08-12T00:00:00.000Z",
  });

  assertEqual(member?.id, "member-1", "coach relationship maps to the member id");
  assertEqual(
    `${member?.profile?.firstName} ${member?.profile?.lastName}`,
    "Jamie Rivera",
    "coach relationship preserves the member name",
  );
  assertEqual(member?.email, "jamie@example.com", "coach relationship preserves contact email");
  assertEqual(member?.phone_no, "+639171234567", "coach relationship preserves contact phone");
  assertEqual(member?.lastCheckInAt, "2026-08-11T08:00:00.000Z", "coach relationship preserves attendance");
  assertEqual(member?.membershipCard?.status, "active", "coach relationship preserves membership");

  const noUpcomingMember = mapCoachClientToMember({
    coach_id: "coach-1",
    created_at: "2026-08-12T00:00:00.000Z",
    id: "relationship-2",
    member: { id: "member-2", profile: null },
    member_id: "member-2",
    updated_at: "2026-08-12T00:00:00.000Z",
  });
  if (!member || !noUpcomingMember) {
    throw new Error("Expected coach clients to map to directory members");
  }

  const summaries = new Map([
    [member.id, {
      completed: 0,
      nextSessionLabel: "None scheduled",
      nextSessionTime: null,
      notReviewed: 0,
      total: 1,
      upcoming: 1,
    }],
    [noUpcomingMember.id, {
      completed: 0,
      nextSessionLabel: "None scheduled",
      nextSessionTime: null,
      notReviewed: 0,
      total: 1,
      upcoming: 0,
    }],
  ]);
  assertEqual(
    filterCoachClientsBySessionStatus(
      [member, noUpcomingMember],
      "has_upcoming",
      summaries,
    ).length,
    1,
    "Has Upcoming keeps only clients with displayed upcoming sessions",
  );
  assertEqual(
    filterCoachClientsBySessionStatus(
      [member, noUpcomingMember],
      "no_upcoming",
      summaries,
    )[0]?.id,
    noUpcomingMember.id,
    "No Upcoming switches to clients without displayed upcoming sessions",
  );
  assertEqual(
    retainOrSelectCoachClient(member, [member, noUpcomingMember], [noUpcomingMember])?.id,
    member.id,
    "selection stays on a still-filtered client even when the visible page changes",
  );
  assertEqual(
    retainOrSelectCoachClient(member, [noUpcomingMember], [noUpcomingMember])?.id,
    noUpcomingMember.id,
    "selection reselects the first valid row after a filter removes the current client",
  );
  assertEqual(
    retainOrSelectCoachClient(member, [], [])?.id,
    undefined,
    "selection clears when no filtered coach clients remain",
  );

  const requests: string[] = [];
  const api = createApiClient({
    transport: {
      get: async (url: string) => {
        requests.push(url);
        return {
          data: {
            data: [],
            meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
          },
        };
      },
    } as never,
  });
  const clientsQuery = coachClientsQueryOptions(api, { limit: 100, page: 1 });
  if (typeof clientsQuery.queryFn !== "function") {
    throw new Error("Expected a coach clients query function");
  }
  await clientsQuery.queryFn({} as never);
  assertEqual(
    requests[0],
    "/coaching/clients",
    "COACH accounts use the coach-owned clients endpoint instead of admin users",
  );
}

void runCoachClientDirectoryRegression();
