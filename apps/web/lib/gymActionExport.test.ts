import assert from "node:assert/strict";
import test from "node:test";

import { normalizeGymActionPdfRows } from "./gymActionExport";

test("normalizes nullable text and numeric amounts for gym action exports", () => {
  assert.deepEqual(
    normalizeGymActionPdfRows([
      {
        primary: "  Attendance   check-in ",
        secondary: "  Open\naccess ",
        actor: null,
        status: " completed ",
        amount: "PHP 1,250.50",
        occurredAt: " 2026-08-28T08:00:00.000Z ",
      },
      { primary: "   ", amount: "not-a-number" },
    ]),
    [
      {
        primary: "Attendance check-in",
        secondary: "Open access",
        status: "completed",
        amount: 1250.5,
        occurredAt: "2026-08-28T08:00:00.000Z",
      },
    ],
  );
});

