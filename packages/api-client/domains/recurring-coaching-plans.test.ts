import assert from "node:assert/strict";
import test from "node:test";

import { createRecurringCoachingPlansApi } from "./recurring-coaching-plans";

test("maps the nullable monthly coach name and keeps a calm legacy fallback", async () => {
  const transport = {
    get: async () => ({
      data: [
        {
          coach_id: "coach-1",
          coach_name: "  Maria Santos  ",
          completed_sessions: 0,
          end_date: "2026-09-30",
          frequency: "monthly",
          id: "plan-1",
          member_id: "member-1",
          preferred_days: [],
          preferred_time: "09:00",
          quoted_amount: "12000.00",
          start_date: "2026-09-01",
          status: "active",
          total_sessions: 4,
        },
        {
          coach_id: "coach-2",
          completed_sessions: 0,
          end_date: "2026-09-30",
          frequency: "monthly",
          id: "plan-2",
          member_id: "member-1",
          preferred_days: [],
          preferred_time: "09:00",
          quoted_amount: "12000.00",
          start_date: "2026-09-01",
          status: "active",
          total_sessions: 4,
        },
      ],
    }),
  };

  const plans = await createRecurringCoachingPlansApi(transport as never).list();

  assert.equal(plans[0]?.coachName, "Maria Santos");
  assert.equal(plans[1]?.coachName, null);
});
