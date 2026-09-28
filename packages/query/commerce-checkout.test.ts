import assert from "node:assert/strict";
import test from "node:test";

import { invalidateSuccessfulCheckoutQueries } from "./commerce-checkout";

test("checkout appointment refresh is gated on successful reconciliation", async () => {
  const calls: unknown[] = [];
  const queryClient = {
    invalidateQueries: async (input: unknown) => {
      calls.push(input);
    },
  };

  await invalidateSuccessfulCheckoutQueries(queryClient as never, "pending");
  assert.deepEqual(calls, []);

  await invalidateSuccessfulCheckoutQueries(queryClient as never, "succeeded");
  assert.deepEqual(calls, [{ queryKey: ["appointments"] }]);
});
