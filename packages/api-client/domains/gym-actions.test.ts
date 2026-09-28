import assert from "node:assert/strict";
import test from "node:test";

import { createGymActionsApi } from "./gym-actions";

test("maps attendance records and pagination from the admin endpoint", async () => {
  const calls: Array<{ path: string; params?: unknown }> = [];
  const transport = {
    get: async (path: string, config?: { params?: unknown }) => {
      calls.push({ path, params: config?.params });
      return {
        data: {
          data: [
            {
              access_source: "free_one_day_pass",
              check_in_at: "2026-08-28T10:00:00.000Z",
              check_in_method: "qr",
              check_out_at: null,
              id: "attendance-1",
              scanned_by: "staff-1",
              user: {
                email: "maria@fittrack.com",
                profile: { first_name: "Maria", last_name: "Santos" },
              },
              user_id: "member-1",
            },
          ],
          meta: { page: 2, limit: 10, total: 11, total_pages: 2 },
        },
      };
    },
  };

  const result = await createGymActionsApi(transport as never).listAttendance({
    endDate: "2026-08-28",
    limit: 10,
    order: "asc",
    page: 2,
    search: " Maria ",
    startDate: "2026-08-01",
  });

  assert.deepEqual(calls, [
    {
      path: "/attendance",
      params: {
        end_date: "2026-08-28",
        limit: 10,
        order: "asc",
        page: 2,
        search: "Maria",
        start_date: "2026-08-01",
      },
    },
  ]);
  assert.deepEqual(result.meta, { page: 2, limit: 10, total: 11, total_pages: 2 });
  assert.deepEqual(result.data[0], {
    accessSource: "free_one_day_pass",
    checkInAt: "2026-08-28T10:00:00.000Z",
    checkInMethod: "qr",
    checkOutAt: null,
    id: "attendance-1",
    memberEmail: "maria@fittrack.com",
    memberName: "Maria Santos",
    scannedBy: "staff-1",
    userId: "member-1",
  });
});

test("posts normalized report fields and returns attachment metadata", async () => {
  let request: { path: string; body: unknown; config?: unknown } | undefined;
  const transport = {
    post: async (path: string, body: unknown, config?: unknown) => {
      request = { path, body, config };
      return {
        data: new ArrayBuffer(4),
        headers: {
          "content-disposition": 'attachment; filename="gym-actions.pdf"',
          "content-type": "application/pdf",
        },
      };
    },
  };

  const result = await createGymActionsApi(transport as never).exportPdf({
    filterSummaries: ["Aug 1 - Aug 28", "Attendance"],
    rows: [
      {
        actor: "Staff A",
        amount: 100,
        occurredAt: "2026-08-28T10:00:00.000Z",
        primary: "Maria Santos",
        secondary: "QR check-in",
        status: "Completed",
      },
    ],
    section: "attendance",
    sectionLabel: "Attendance",
    title: "Gym Actions",
    totalRecords: 1,
  });

  assert.deepEqual(request, {
    path: "/gym-actions/export/pdf",
    body: {
      filter_summaries: ["Aug 1 - Aug 28", "Attendance"],
      rows: [
        {
          actor: "Staff A",
          amount: 100,
          occurred_at: "2026-08-28T10:00:00.000Z",
          primary: "Maria Santos",
          secondary: "QR check-in",
          status: "Completed",
        },
      ],
      section: "attendance",
      section_label: "Attendance",
      title: "Gym Actions",
      total_records: 1,
    },
    config: { responseType: "arraybuffer" },
  });
  assert.equal(result.fileName, "gym-actions.pdf");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.bytes.byteLength, 4);
});
