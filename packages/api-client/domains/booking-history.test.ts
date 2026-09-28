import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppointmentsApi,
  type AppointmentApiRecord,
} from "./appointments";
import { createBookingsApi, type AmenityBookingApiRecord } from "./bookings";

type PageMeta = {
  limit: number;
  page: number;
  total: number;
  total_pages: number;
};

function paginated<T>(data: T[], meta: PageMeta) {
  return { data: { data, meta } };
}

function bookingRecord(id: string): AmenityBookingApiRecord {
  return {
    amenity: { id: "gym", name: "Gym" },
    ends_at: "2026-09-08T10:00:00.000Z",
    id,
    starts_at: "2026-09-08T09:00:00.000Z",
  };
}

function appointmentRecord(id: string): AppointmentApiRecord {
  return {
    duration_minutes: 60,
    id,
    scheduled_at: "2026-09-08T09:00:00.000Z",
  };
}

test("loads all booking pages with the requested limit and maps every record", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) =>
    bookingRecord(`booking-${index + 1}`),
  );
  const secondPage = [bookingRecord("booking-101")];
  const calls: Array<{ path: string; params?: unknown; signal?: unknown }> = [];
  const transport = {
    get: async (
      path: string,
      config?: { params?: unknown; signal?: unknown },
    ) => {
      calls.push({ path, params: config?.params, signal: config?.signal });
      const page = (config?.params as { page: number }).page;
      return page === 1
        ? paginated(firstPage, { page: 1, limit: 100, total: 101, total_pages: 2 })
        : paginated(secondPage, { page: 2, limit: 100, total: 101, total_pages: 2 });
    },
  };

  const result = await createBookingsApi(transport as never).listMineAll<{
    id: string;
    venue?: { name: string } | null;
  }>();

  assert.equal(result.length, 101);
  assert.equal(result[0].venue?.name, "Gym");
  assert.equal(result[100].id, "booking-101");
  assert.deepEqual(
    calls.map(({ path, params }) => ({ path, params })),
    [
      { path: "/bookings/amenity/my", params: { limit: 100, page: 1 } },
      { path: "/bookings/amenity/my", params: { limit: 100, page: 2 } },
    ],
  );
});

test("loads all appointment pages and forwards one abort signal to every request", async () => {
  const controller = new AbortController();
  const signals: unknown[] = [];
  const transport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number }; signal?: unknown },
    ) => {
      signals.push(config?.signal);
      const page = config?.params?.page;
      return page === 1
        ? paginated([appointmentRecord("appointment-1")], {
            page: 1,
            limit: 1,
            total: 2,
            total_pages: 2,
          })
        : paginated([appointmentRecord("appointment-2")], {
            page: 2,
            limit: 1,
            total: 2,
            total_pages: 2,
          });
    },
  };

  const result = await createAppointmentsApi(transport as never).listMineAll<{
    id: string;
  }>(controller.signal);

  assert.deepEqual(
    result.map(({ id }) => id),
    ["appointment-1", "appointment-2"],
  );
  assert.deepEqual(signals, [controller.signal, controller.signal]);
});

test("accepts legacy array responses for both history endpoints", async () => {
  const bookingTransport = {
    get: async () => ({ data: [bookingRecord("booking-legacy")] }),
  };
  const appointmentTransport = {
    get: async () => ({ data: [appointmentRecord("appointment-legacy")] }),
  };

  const bookings = await createBookingsApi(bookingTransport as never).listMineAll<{
    id: string;
  }>();
  const appointments = await createAppointmentsApi(
    appointmentTransport as never,
  ).listMineAll<{ id: string }>();

  assert.deepEqual(bookings.map(({ id }) => id), ["booking-legacy"]);
  assert.deepEqual(appointments.map(({ id }) => id), ["appointment-legacy"]);
});

test("accepts zero-total page horizons of zero or one and rejects larger horizons atomically", async () => {
  const emptyPageResponses = [
    paginated([], { page: 1, limit: 100, total: 0, total_pages: 0 }),
    paginated([], { page: 1, limit: 100, total: 0, total_pages: 1 }),
  ];

  for (const response of emptyPageResponses) {
    let calls = 0;
    const result = await createBookingsApi({
      get: async () => {
        calls += 1;
        return response;
      },
    } as never).listMineAll<{ id: string }>();

    assert.deepEqual(result, []);
    assert.equal(calls, 1);
  }

  let oversizedCalls = 0;
  await assert.rejects(
    createBookingsApi({
      get: async () => {
        oversizedCalls += 1;
        return paginated([], {
          page: 1,
          limit: 100,
          total: 0,
          total_pages: Number.MAX_SAFE_INTEGER,
        });
      },
    } as never).listMineAll<{ id: string }>(),
    /zero-total pagination horizon is invalid/,
  );
  assert.equal(oversizedCalls, 1);

  let nonEmptyCalls = 0;
  await assert.rejects(
    createBookingsApi({
      get: async () => {
        nonEmptyCalls += 1;
        return paginated([bookingRecord("unexpected")], {
          page: 1,
          limit: 100,
          total: 0,
          total_pages: 1,
        });
      },
    } as never).listMineAll<{ id: string }>(),
    /zero-total pagination is inconsistent/,
  );
  assert.equal(nonEmptyCalls, 1);
});

test("deduplicates overlapping booking pages while retaining the first version", async () => {
  const transport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) =>
      config?.params?.page === 1
        ? paginated([bookingRecord("booking-1"), bookingRecord("booking-2")], {
            page: 1,
            limit: 2,
            total: 4,
            total_pages: 2,
          })
        : paginated(
            [
              { ...bookingRecord("booking-2"), notes: "later duplicate" },
              bookingRecord("booking-3"),
            ],
            { page: 2, limit: 2, total: 4, total_pages: 2 },
          ),
  };

  const result = await createBookingsApi(transport as never).listMineAll<{
    id: string;
    purpose?: string | null;
  }>();

  assert.deepEqual(
    result.map(({ id }) => id),
    ["booking-1", "booking-2", "booking-3"],
  );
  assert.equal(result[1].purpose, null);
});

test("stops after a valid metadata shrink", async () => {
  const calls: number[] = [];
  const transport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) => {
      const page = config?.params?.page ?? 0;
      calls.push(page);
      if (page === 1) {
        return paginated([bookingRecord("booking-1")], {
          page: 1,
          limit: 1,
          total: 3,
          total_pages: 3,
        });
      }
      if (page === 2) {
        return paginated([], { page: 2, limit: 1, total: 1, total_pages: 1 });
      }
      throw new Error(`unexpected page ${page}`);
    },
  };

  const result = await createBookingsApi(transport as never).listMineAll<{
    id: string;
    purpose?: string | null;
  }>();

  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.length, 1);
  assert.equal(result[0].purpose, null);
});

test("rejects an empty later page while its metadata still requires rows", async () => {
  const transport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) =>
      config?.params?.page === 1
        ? paginated([bookingRecord("booking-1")], {
            page: 1,
            limit: 1,
            total: 2,
            total_pages: 2,
          })
        : paginated([], { page: 2, limit: 1, total: 2, total_pages: 2 }),
  };

  await assert.rejects(
    createBookingsApi(transport as never).listMineAll<{ id: string }>(),
    /page data is incomplete/,
  );
});

test("does not resolve a partial history after a later page fails", async () => {
  const transport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) => {
      if (config?.params?.page === 1) {
        return paginated([bookingRecord("booking-1")], {
          page: 1,
          limit: 1,
          total: 2,
          total_pages: 2,
        });
      }
      throw new Error("later page failed");
    },
  };

  await assert.rejects(
    createBookingsApi(transport as never).listMineAll<{ id: string }>(),
    /Unable to load bookings\.|later page failed/,
  );
});

test("rejects non-progressing, growing, or unsafe pagination metadata", async () => {
  const nonProgressingTransport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) =>
      paginated([bookingRecord("booking-1")], {
        page: config?.params?.page === 1 ? 1 : 1,
        limit: 1,
        total: 2,
        total_pages: 2,
      }),
  };
  const growthTransport = {
    get: async (
      _path: string,
      config?: { params?: { page: number; limit: number } },
    ) =>
      config?.params?.page === 1
        ? paginated([bookingRecord("booking-1")], {
            page: 1,
            limit: 1,
            total: 2,
            total_pages: 2,
          })
        : paginated([bookingRecord("booking-2")], {
            page: 2,
            limit: 1,
            total: 3,
            total_pages: 3,
          }),
  };
  const unsafeTransport = {
    get: async () =>
      paginated([bookingRecord("booking-1")], {
        page: 1,
        limit: 100,
        total: Number.MAX_SAFE_INTEGER,
        total_pages: Number.MAX_SAFE_INTEGER + 1,
      }),
  };

  await assert.rejects(
    createBookingsApi(nonProgressingTransport as never).listMineAll(),
    /pagination did not progress/,
  );
  await assert.rejects(
    createBookingsApi(growthTransport as never).listMineAll(),
    /pagination grew during loading/,
  );
  await assert.rejects(
    createBookingsApi(unsafeTransport as never).listMineAll(),
    /invalid pagination metadata/,
  );
});
