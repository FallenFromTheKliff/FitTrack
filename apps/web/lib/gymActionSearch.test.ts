import assert from "node:assert/strict";
import test from "node:test";

import { matchesGymActionSearch } from "./gymActionSearch";

test("Gym Actions search matches complete names and individual name terms", () => {
  const values = ["Mickey Mouse", "Payment", "completed"] as const;

  assert.equal(matchesGymActionSearch([...values], "Mickey Mouse"), true);
  assert.equal(matchesGymActionSearch([...values], "Mickey"), true);
  assert.equal(matchesGymActionSearch([...values], "Mouse"), true);
  assert.equal(matchesGymActionSearch(["Mickey", "Mouse"], "Mickey Mouse"), true);
  assert.equal(matchesGymActionSearch([...values], "Donald Duck"), false);
});
