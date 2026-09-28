import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import { completeWorkoutSessionMutationOptions } from "./fitness";
import { queryKeys } from "./query-keys";

test("workout completion invalidates only the affected plan progression", async () => {
  const queryClient = new QueryClient();
  const affectedKey = queryKeys.fitnessPlanProgression("plan-1");
  const unrelatedKey = queryKeys.fitnessPlanProgression("plan-2");
  queryClient.setQueryData(affectedKey, []);
  queryClient.setQueryData(unrelatedKey, []);

  const options = completeWorkoutSessionMutationOptions(
    {
      fitness: {
        completeSession: async () => ({ planId: "plan-1" }),
      },
    } as never,
    queryClient,
  ) as unknown as {
    onSuccess?: (
      data: { planId: string | null },
      variables: { sessionId: string; userId: string },
    ) => Promise<void>;
  };

  await options.onSuccess?.(
    { planId: "plan-1" },
    { sessionId: "session-1", userId: "member-1" },
  );

  assert.equal(queryClient.getQueryState(affectedKey)?.isInvalidated, true);
  assert.equal(queryClient.getQueryState(unrelatedKey)?.isInvalidated, false);
  queryClient.clear();
});
