import assert from "node:assert/strict";
import test from "node:test";
import {
  MutationObserver,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";

import { cancelAppointmentMutationOptions } from "./appointments";

test("cancel appointment settles before background refreshes finish", async () => {
  const refreshes: Array<() => void> = [];
  const invalidationCalls: Array<{ queryKey?: readonly unknown[] }> = [];
  let cachedAppointments: unknown = [
    {
      coach: { displayName: "Trisha Navarro" },
      id: "appointment-1",
      status: "confirmed",
    },
    { id: "appointment-2", status: "confirmed", unrelated: true },
  ];
  let cachedDetail: unknown = {
    coach: { displayName: "Trisha Navarro" },
    id: "appointment-1",
    status: "confirmed",
  };

  const queryClient = {
    invalidateQueries(input: { queryKey?: readonly unknown[] }) {
      invalidationCalls.push(input);
      return new Promise<void>((resolve) => refreshes.push(resolve));
    },
    setQueriesData(
      _filters: unknown,
      updater: (current: unknown) => unknown,
    ) {
      cachedAppointments = updater(cachedAppointments);
    },
    setQueryData(
      _queryKey: unknown,
      updater: (current: unknown) => unknown,
    ) {
      cachedDetail = updater(cachedDetail);
    },
  };

  const options = cancelAppointmentMutationOptions(
    { appointments: { cancel: async () => undefined } } as never,
    queryClient as never,
  ) as {
    onSuccess?: (data: unknown, variables: unknown) => unknown;
  };

  const result = options.onSuccess?.(undefined, {
    appointmentId: "appointment-1",
    userId: "member-1",
  });

  assert.equal(result, undefined);
  assert.deepEqual(cachedAppointments, [
    {
      coach: { displayName: "Trisha Navarro" },
      id: "appointment-1",
      status: "cancelled",
    },
    { id: "appointment-2", status: "confirmed", unrelated: true },
  ]);
  assert.deepEqual(cachedDetail, {
    coach: { displayName: "Trisha Navarro" },
    id: "appointment-1",
    status: "cancelled",
  });

  const invalidatedFamilies = new Set(
    invalidationCalls
      .map((call) => call.queryKey?.[0])
      .filter((family): family is string => typeof family === "string"),
  );
  for (const family of ["appointments", "coach", "staff", "analytics"]) {
    assert.equal(invalidatedFamilies.has(family), true, family);
  }

  refreshes.forEach((resolve) => resolve());
  await Promise.resolve();
});

test("successful cancel survives a rejected active refresh with QueryClient", async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const appointmentKey = ["appointments", "member-1"] as const;
  const target = {
    coach: { displayName: "Trisha Navarro" },
    id: "appointment-1",
    status: "confirmed",
  };
  const unrelated = {
    id: "appointment-2",
    metadata: { source: "unrelated" },
    status: "confirmed",
  };
  let rejectRefresh = false;
  const observer = new QueryObserver(queryClient, {
    queryKey: appointmentKey,
    queryFn: async () => {
      if (rejectRefresh) throw new Error("background refresh failed");
      return [target, unrelated];
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);

  try {
    await observer.refetch();
    rejectRefresh = true;

    const mutation = new MutationObserver(
      queryClient,
      cancelAppointmentMutationOptions(
        { appointments: { cancel: async () => undefined } } as never,
        queryClient,
      ) as never,
    );
    await mutation.mutate({
      appointmentId: "appointment-1",
      cancelReason: "Member requested cancellation",
      userId: "member-1",
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (observer.getCurrentResult().status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    assert.equal(observer.getCurrentResult().status, "error");
    assert.deepEqual(queryClient.getQueryData(appointmentKey), [
      {
        coach: { displayName: "Trisha Navarro" },
        id: "appointment-1",
        status: "cancelled",
      },
      unrelated,
    ]);
  } finally {
    unsubscribe();
    queryClient.clear();
  }
});
