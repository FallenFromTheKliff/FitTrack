import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { allAppointmentsQueryOptions } from "./appointments";
import { allBookingsQueryOptions } from "./bookings";
import {
  invalidateAppointmentQueries,
  invalidateBookingQueries,
} from "./cache";

test("all history query options use the existing family prefixes and pass signal", async () => {
  const controller = new AbortController();
  const bookingSignals: unknown[] = [];
  const appointmentSignals: unknown[] = [];
  const bookingOptions = allBookingsQueryOptions(
    {
      bookings: {
        listMineAll: async (signal?: AbortSignal) => {
          bookingSignals.push(signal);
          return [];
        },
      },
    } as never,
    "member-1",
  );
  const appointmentOptions = allAppointmentsQueryOptions(
    {
      appointments: {
        listMineAll: async (signal?: AbortSignal) => {
          appointmentSignals.push(signal);
          return [];
        },
      },
    } as never,
    "member-1",
  );

  assert.deepEqual(bookingOptions.queryKey, ["bookings", "member-1", "all"]);
  assert.deepEqual(appointmentOptions.queryKey, [
    "appointments",
    "member-1",
    "all",
  ]);

  await bookingOptions.queryFn?.({ signal: controller.signal } as never);
  await appointmentOptions.queryFn?.({ signal: controller.signal } as never);
  assert.deepEqual(bookingSignals, [controller.signal]);
  assert.deepEqual(appointmentSignals, [controller.signal]);
});

test("existing prefix invalidation includes all history queries", async () => {
  const queryClient = new QueryClient();
  const bookingKey = ["bookings", "member-1", "all"] as const;
  const appointmentKey = ["appointments", "member-1", "all"] as const;
  queryClient.setQueryData(bookingKey, []);
  queryClient.setQueryData(appointmentKey, []);

  await invalidateBookingQueries(queryClient, "member-1");
  await invalidateAppointmentQueries(queryClient, "member-1");

  assert.equal(queryClient.getQueryState(bookingKey)?.isInvalidated, true);
  assert.equal(queryClient.getQueryState(appointmentKey)?.isInvalidated, true);
  queryClient.clear();
});
