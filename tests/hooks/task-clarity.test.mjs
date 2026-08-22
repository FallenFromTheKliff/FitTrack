import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildContext,
  classifyPrompt,
  handleEvent,
} from "../../.codex/hooks/task-clarity.mjs";

const hookPath = resolve(process.cwd(), ".codex", "hooks", "task-clarity.mjs");
const configPath = resolve(process.cwd(), ".codex", "hooks.json");

const cases = [
  ["explicit-bug", "Fix the broken save button in FitButton.tsx"],
  ["explicit-bug", "Fix the payment bug in apps/web/components/CheckoutButton.tsx"],
  ["vague-feature-design", "Create a better way to track meals"],
  ["reference-1to1", "Make the route match the screenshot 1:1"],
  ["read-only", "Review this code and explain the risk"],
  ["read-only", "Inspect the database schema read-only; no changes"],
  ["current-verification", "Verify the current supported version"],
  ["authority-sensitive", "Deploy the database migration to production"],
];

for (const [expected, prompt] of cases) {
  assert.equal(classifyPrompt(prompt), expected, `classification for ${prompt}`);
}

assert.equal(buildContext(cases[0][1]), "", "clear explicit bugs stay silent");
assert.equal(buildContext(cases[1][1]), "", "payment bugs with a target stay silent");
assert.match(buildContext(cases[2][1]), /compact brainstorm/);
assert.match(buildContext(cases[3][1]), /authoritative/);
assert.equal(buildContext(cases[5][1]), "", "read-only database inspection stays silent");
assert.match(buildContext(cases[7][1]), /one question only/);
assert.equal(classifyPrompt("Reset the production database"), "authority-sensitive");
assert.match(buildContext("Reset the production database"), /one question only/);
assert.equal(classifyPrompt("Process a payment refund"), "authority-sensitive");

const context = buildContext(cases[2][1]);
assert.ok(context.length <= 1200, "context stays below the 300-token character budget");
assert.ok(context.split(/\s+/).length <= 300, "context stays below 300 tokens");

const secret = "fixture-secret-do-not-persist";
const beforeHook = (await stat(hookPath)).mtimeMs;
const beforeConfig = (await stat(configPath)).mtimeMs;
const output = handleEvent({ prompt: `${cases[2][1]} ${secret}` });
assert.ok(output);
assert.doesNotMatch(JSON.stringify(output), new RegExp(secret));
assert.equal((await stat(hookPath)).mtimeMs, beforeHook);
assert.equal((await stat(configPath)).mtimeMs, beforeConfig);
assert.doesNotMatch(await readFile(configPath, "utf8"), new RegExp(secret));

assert.equal(handleEvent({ prompt: "Fix spacing in FitButton.tsx" }), null);
assert.equal(handleEvent({ prompt: "" }), null);
console.log("task-clarity classifier, budget, and no-secret persistence tests passed");
